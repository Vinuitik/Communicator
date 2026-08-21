package com.communicator.chrono.service;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.communicator.knowledgecore.service.KnowledgeChunkTriggerClient;
import communicate.Friend.Config.EmaProperties;
import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendService.AnalyticsService;
import communicate.Friend.FriendService.EmaMathService;
import communicate.Friend.FriendService.FlashcardBankruptcyService;
import communicate.Friend.FriendService.FlashcardReviewSettingsService;
import communicate.Friend.FriendService.FlashcardSpreadService;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.FsrsNeglectService;
import communicate.Friend.FriendEntities.FlashcardReviewSettings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChronoJobService {

    // Same JVM as friend now (see PathPrefixConfig) — called as plain Spring
    // beans instead of over HTTP, which used to round-trip through nginx.
    private final FriendService friendService;
    private final AnalyticsService analyticsService;
    private final ChronoProperties chronoProperties;
    private final EmaMathService emaMathService;
    private final EmaProperties emaProperties;
    private final FsrsNeglectService fsrsNeglectService;
    private final FlashcardBankruptcyService flashcardBankruptcyService;
    private final FlashcardSpreadService flashcardSpreadService;
    private final FlashcardReviewSettingsService flashcardReviewSettingsService;
    // Reconciliation backstop for knowledge-chunk trigger loss (see
    // reconcileMissingKnowledgeChunks) — RabbitMQ closes the "ai-agent was down at
    // publish time" gap, but not "JVM crashed between DB commit and successfully
    // publishing to the queue" (commit and publish aren't atomic). JdbcTemplate is
    // auto-configured transitively (spring-boot-starter-data-jpa, pulled in via
    // knowledge-core now depending on it here), same as backup's DbBackupService.
    private final JdbcTemplate jdbcTemplate;
    private final KnowledgeChunkTriggerClient knowledgeChunkTriggerClient;

    /**
     * Runs every day at midnight to apply decay for friends who didn't have interactions yesterday
     */
    @Scheduled(cron = "0 0 0 * * ?")
    public void applyDailyDecay() {
        log.info("Starting daily decay process");
        LocalDate yesterday = LocalDate.now().minusDays(1);
        
        try {
            // Get total friend count to calculate total pages
            long totalFriends = friendService.getFriendsCount();
            int pageSize = chronoProperties.getFriendService().getFriendPageSize();
            int totalPages = (int) Math.ceil((double) totalFriends / pageSize);

            log.info("Processing {} friends across {} pages (page size: {})",
                    totalFriends, totalPages, pageSize);

            int processedFriends = 0;
            int decayedFriends = 0;

            // Process each page of friends
            for (int page = 0; page < totalPages; page++) {
                log.debug("Processing page {} of {}", page + 1, totalPages);

                // Get this page of friends
                List<ShortFriendDTO> friends = friendService.getFriendsPaginatedForChrono(page, pageSize);

                if (friends.isEmpty()) {
                    log.debug("No friends found on page {}, ending pagination", page);
                    break;
                }

                // Extract friend IDs for batch interaction check
                List<Integer> friendIds = friends.stream()
                        .map(ShortFriendDTO::id)
                        .collect(Collectors.toList());

                // Batch check: which friends had interactions yesterday
                List<Integer> friendsWithInteractions = analyticsService
                        .getFriendsWithInteractionsOnDate(friendIds, yesterday);

                // Apply decay to friends who didn't have interactions
                for (ShortFriendDTO friend : friends) {
                    if (!friendsWithInteractions.contains(friend.id())) {
                        applyDecayToFriend(friend, yesterday);
                        decayedFriends++;
                    }
                    processedFriends++;
                }

                log.debug("Page {} complete: {} friends processed", page + 1, friends.size());
            }
            
            log.info("Daily decay process completed: {} friends processed, {} decayed",
                    processedFriends, decayedFriends);

        } catch (Exception e) {
            log.error("Error during daily decay process", e);
        }

        // Same nightly cron slot, separate concern (design doc Next Steps #8):
        // FSRS/bandit scheduling state's chronic-neglect lapse, independent of
        // the EMA visualization decay above.
        try {
            fsrsNeglectService.applyNightlyLapse();
        } catch (Exception e) {
            log.error("Error during FSRS neglect lapse process", e);
        }

        // Flashcard-review (design doc "Feature D") nightly lapse + daily-cap
        // spread — same slot, independent of the two concerns above. Order
        // matters: bankruptcy/neglect lapses first (they redistribute their
        // own overdue rows via least-loaded-day), then a global spread pass
        // enforces maxDailyReviews across the WHOLE pool (including rows
        // bankruptcy just rescheduled).
        try {
            FlashcardReviewSettings settings = flashcardReviewSettingsService.get();
            flashcardBankruptcyService.run(settings.getBankruptcyLimit(), settings.getChronicNeglectDays());
            flashcardSpreadService.run(settings.getMaxDailyReviews());
        } catch (Exception e) {
            log.error("Error during flashcard review nightly job", e);
        }

        // Same nightly cron slot, independent concern: republish the chunk-trigger for
        // any Group/Connection knowledge item that ended up with zero knowledge_chunks
        // rows — the one gap RabbitMQ itself can't close (JVM crashing between the DB
        // commit and successfully publishing to the queue; commit+publish aren't atomic).
        // Friend knowledge isn't covered here on purpose — it already self-heals via
        // KnowledgeService.summarize_friend_knowledge's lazy _ensure_knowledge_chunked().
        try {
            reconcileMissingKnowledgeChunks();
        } catch (Exception e) {
            log.error("Error during knowledge-chunk reconciliation sweep", e);
        }
    }

    /**
     * Finds Group/Connection knowledge rows with zero matching {@code knowledge_chunks}
     * rows (ai_agent's table, same Postgres instance/database as this app — see
     * ai_agent/PROTO.md) and republishes each one's chunk-trigger event through the same
     * RabbitMQ publish path (KnowledgeChunkTriggerClient) a normal save uses.
     *
     * Plain JdbcTemplate queries rather than JPA entities/repositories: chrono has no
     * entity for group_knowledge/connections_knowledge (only friend depends on those
     * modules, not the reverse), and knowledge_chunks itself is a table this app never
     * maps as a JPA entity at all — it's owned/written by ai_agent's Python schema.
     * Table/column names below match GroupKnowledge/ConnectionsKnowledge's Hibernate
     * default naming (unchanged since neither entity declares an explicit @Table/@Column).
     */
    void reconcileMissingKnowledgeChunks() {
        List<Map<String, Object>> missingGroupKnowledge = jdbcTemplate.queryForList(
                "SELECT gk.id AS knowledge_id, gk.group_id AS group_id, gk.text AS text " +
                "FROM group_knowledge gk " +
                "WHERE NOT EXISTS (" +
                "  SELECT 1 FROM knowledge_chunks kc " +
                "  WHERE kc.knowledge_id = gk.id AND kc.source_type = 'GROUP'" +
                ")"
        );
        for (Map<String, Object> row : missingGroupKnowledge) {
            knowledgeChunkTriggerClient.triggerChunk(new KnowledgeChunkTriggerEvent(
                    (Integer) row.get("knowledge_id"),
                    "GROUP",
                    null,
                    (Integer) row.get("group_id"),
                    null,
                    null,
                    (String) row.get("text")
            ));
        }

        List<Map<String, Object>> missingConnectionKnowledge = jdbcTemplate.queryForList(
                "SELECT ck.id AS knowledge_id, ck.friend1_id AS friend1_id, ck.friend2_id AS friend2_id, " +
                "       ck.text AS text " +
                "FROM connections_knowledge ck " +
                "WHERE NOT EXISTS (" +
                "  SELECT 1 FROM knowledge_chunks kc " +
                "  WHERE kc.knowledge_id = ck.id AND kc.source_type = 'CONNECTION'" +
                ")"
        );
        for (Map<String, Object> row : missingConnectionKnowledge) {
            knowledgeChunkTriggerClient.triggerChunk(new KnowledgeChunkTriggerEvent(
                    (Integer) row.get("knowledge_id"),
                    "CONNECTION",
                    null,
                    null,
                    ((Number) row.get("friend1_id")).longValue(),
                    ((Number) row.get("friend2_id")).longValue(),
                    (String) row.get("text")
            ));
        }

        if (!missingGroupKnowledge.isEmpty() || !missingConnectionKnowledge.isEmpty()) {
            log.info("Knowledge-chunk reconciliation: republished {} group + {} connection item(s) with zero chunks",
                    missingGroupKnowledge.size(), missingConnectionKnowledge.size());
        } else {
            log.debug("Knowledge-chunk reconciliation: no gaps found");
        }
    }

    private void applyDecayToFriend(ShortFriendDTO friend, LocalDate decayDate) {
        // Get current EMA values
        double currentFrequency = friend.averageFrequency() != null ? friend.averageFrequency() : 0.0;
        double currentDuration = friend.averageDuration() != null ? friend.averageDuration() : 0.0;
        double currentExcitement = friend.averageExcitement() != null ? friend.averageExcitement() : 0.0;
        double currentProximity = friend.averageProximity() != null ? friend.averageProximity() : 0.0;

        // Decay rate depends on this friend's last logged experience rating (see
        // EmaProperties.getDecayAlpha) — previously this was hardcoded to "good"
        // for every friend regardless of rating.
        double decayAlpha = emaProperties.getDecayAlpha(friend.experience());

        double newFrequency = emaMathService.applyDecay(currentFrequency, decayAlpha);
        double newDuration = emaMathService.applyDecay(currentDuration, decayAlpha);
        double newExcitement = emaMathService.applyDecay(currentExcitement, decayAlpha);
        double newProximity = emaMathService.applyDecay(currentProximity, decayAlpha);

        try {
            friendService.updateMovingAverages(friend.id(), newFrequency, newDuration, newExcitement, newProximity);
            log.debug("Applied decay to friend {}: freq {:.3f}→{:.3f}, dur {:.3f}→{:.3f}, exc {:.3f}→{:.3f}, prox {:.3f}→{:.3f}",
                    friend.id(), currentFrequency, newFrequency,
                    currentDuration, newDuration, currentExcitement, newExcitement, currentProximity, newProximity);
        } catch (Exception e) {
            log.warn("Failed to apply decay to friend {}", friend.id(), e);
        }
    }

    /**
     * Manual trigger for testing purposes
     */
    public void triggerManualDecay() {
        log.info("Manual decay trigger requested");
        applyDailyDecay();
    }
}
