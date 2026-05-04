package communicate.Chrono.service;

import communicate.Chrono.config.ChronoProperties;
import communicate.Chrono.dto.FriendSummary;
import communicate.Chrono.dto.FriendUpdateRequest;
import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendService.MeetingGenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChronoJobService {

    private final FriendRepository friendRepository;
    private final AnalyticsRepository analyticsRepository;
    private final MeetingGenerationService meetingGenerationService;
    private final MovingAverageCalculationService movingAverageCalculationService;
    private final ChronoProperties chronoProperties;

    @Scheduled(cron = "${chrono.schedule:0 0 0 * * ?}")
    public void applyDailyDecay() {
        log.info("Starting daily decay process");
        LocalDate yesterday = LocalDate.now().minusDays(1);

        try {
            int generated = meetingGenerationService.generateMissingNextMeetingsForAllFriends().size();
            log.info("Meeting generation complete. Created: {}", generated);
        } catch (Exception e) {
            log.error("Meeting generation failed", e);
        }

        try {
            int pageSize = chronoProperties.getFriendService() != null
                    ? chronoProperties.getFriendService().getFriendPageSize()
                    : 500;

            long totalFriends = friendRepository.count();
            int totalPages = (int) Math.ceil((double) totalFriends / pageSize);
            log.info("Processing {} friends across {} pages", totalFriends, totalPages);

            int processed = 0, decayed = 0;

            for (int page = 0; page < totalPages; page++) {
                Page<Friend> friendPage = friendRepository.findAll(PageRequest.of(page, pageSize));
                if (friendPage.isEmpty()) break;

                List<Integer> friendIds = friendPage.getContent().stream()
                        .map(Friend::getId)
                        .collect(Collectors.toList());

                // Batch check: which friends had interactions on yesterday
                Set<Integer> withInteractions = analyticsRepository
                        .findByFriendIdInAndDate(friendIds, yesterday)
                        .stream()
                        .map(Analytics::getFriendId)
                        .collect(Collectors.toSet());

                for (Friend friend : friendPage.getContent()) {
                    if (!withInteractions.contains(friend.getId())) {
                        applyDecayToFriend(friend, yesterday);
                        decayed++;
                    }
                    processed++;
                }
                log.debug("Page {} done: {} friends", page + 1, friendPage.getNumberOfElements());
            }

            log.info("Daily decay complete: {} processed, {} decayed", processed, decayed);
        } catch (Exception e) {
            log.error("Error during daily decay", e);
        }
    }

    private void applyDecayToFriend(Friend friend, LocalDate decayDate) {
        double currentFrequency  = friend.getAverageFrequency()  != null ? friend.getAverageFrequency()  : 0.0;
        double currentDuration   = friend.getAverageDuration()   != null ? friend.getAverageDuration()   : 0.0;
        double currentExcitement = friend.getAverageExcitement() != null ? friend.getAverageExcitement() : 0.0;

        double decayAlpha = chronoProperties.getCoefficients().getDecay().getOrDefault("good", 0.2);

        friend.setAverageFrequency(currentFrequency   * (1 - decayAlpha));
        friend.setAverageDuration(currentDuration     * (1 - decayAlpha));
        friend.setAverageExcitement(currentExcitement * (1 - decayAlpha));

        try {
            friendRepository.save(friend);
            log.debug("Decay applied to friend {}", friend.getId());
        } catch (Exception e) {
            log.warn("Failed to save decay for friend {}: {}", friend.getId(), e.getMessage());
        }
    }

    public void triggerManualDecay() {
        log.info("Manual decay trigger requested");
        applyDailyDecay();
    }
}
