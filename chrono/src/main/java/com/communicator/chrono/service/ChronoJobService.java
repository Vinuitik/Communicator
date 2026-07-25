package com.communicator.chrono.service;

import com.communicator.chrono.config.ChronoProperties;
import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendService.AnalyticsService;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
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
    }

    private void applyDecayToFriend(ShortFriendDTO friend, LocalDate decayDate) {
        // Get current EMA values
        double currentFrequency = friend.averageFrequency() != null ? friend.averageFrequency() : 0.0;
        double currentDuration = friend.averageDuration() != null ? friend.averageDuration() : 0.0;
        double currentExcitement = friend.averageExcitement() != null ? friend.averageExcitement() : 0.0;

        // Decay rate depends on this friend's last logged experience rating (see
        // ChronoProperties.getDecayAlpha) — previously this was hardcoded to "good"
        // for every friend regardless of rating.
        double decayAlpha = chronoProperties.getDecayAlpha(friend.experience());

        double newFrequency = currentFrequency * (1 - decayAlpha);
        double newDuration = currentDuration * (1 - decayAlpha);
        double newExcitement = currentExcitement * (1 - decayAlpha);

        try {
            friendService.updateMovingAverages(friend.id(), newFrequency, newDuration, newExcitement);
            log.debug("Applied decay to friend {}: freq {:.3f}→{:.3f}, dur {:.3f}→{:.3f}, exc {:.3f}→{:.3f}",
                    friend.id(), currentFrequency, newFrequency,
                    currentDuration, newDuration, currentExcitement, newExcitement);
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
