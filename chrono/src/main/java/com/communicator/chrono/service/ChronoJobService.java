package com.communicator.chrono.service;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.chrono.dto.FriendSummary;
import com.communicator.chrono.dto.FriendUpdateRequest;
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

    private final FriendServiceClient friendServiceClient;
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
            long totalFriends = friendServiceClient.getFriendsCount();
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
                List<FriendSummary> friends = friendServiceClient.getFriendsPaginated(page, pageSize);
                
                if (friends.isEmpty()) {
                    log.debug("No friends found on page {}, ending pagination", page);
                    break;
                }
                
                // Extract friend IDs for batch interaction check
                List<Integer> friendIds = friends.stream()
                        .map(FriendSummary::getId)
                        .collect(Collectors.toList());
                
                // Batch check: which friends had interactions yesterday
                List<Integer> friendsWithInteractions = friendServiceClient
                        .batchInteractionCheck(friendIds, yesterday);
                
                // Apply decay to friends who didn't have interactions
                for (FriendSummary friend : friends) {
                    if (!friendsWithInteractions.contains(friend.getId())) {
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

    private void applyDecayToFriend(FriendSummary friend, LocalDate decayDate) {
        // Get current EMA values
        double currentFrequency = friend.getAverageFrequency() != null ? friend.getAverageFrequency() : 0.0;
        double currentDuration = friend.getAverageDuration() != null ? friend.getAverageDuration() : 0.0;
        double currentExcitement = friend.getAverageExcitement() != null ? friend.getAverageExcitement() : 0.0;

        // Apply decay using configured decay coefficients
        // For simplicity, using "good" decay rate as default
        double decayAlpha = chronoProperties.getCoefficients().getDecay().getGood();
        
        double newFrequency = currentFrequency * (1 - decayAlpha);
        double newDuration = currentDuration * (1 - decayAlpha);
        double newExcitement = currentExcitement * (1 - decayAlpha);

        // Update the friend's averages
        FriendUpdateRequest updateRequest = new FriendUpdateRequest(
                friend.getId(), 
                newFrequency, 
                newDuration, 
                newExcitement
        );

        boolean success = friendServiceClient.updateFriendAverages(updateRequest);
        
        if (success) {
            log.debug("Applied decay to friend {}: freq {:.3f}→{:.3f}, dur {:.3f}→{:.3f}, exc {:.3f}→{:.3f}",
                    friend.getId(), currentFrequency, newFrequency, 
                    currentDuration, newDuration, currentExcitement, newExcitement);
        } else {
            log.warn("Failed to apply decay to friend {}", friend.getId());
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
