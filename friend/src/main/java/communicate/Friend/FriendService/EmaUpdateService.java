package communicate.Friend.FriendService;

import communicate.Friend.Config.EmaProperties;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmaUpdateService {

    private final FriendRepository friendRepository;
    private final EmaProperties emaProperties;
    private final EmaMathService emaMathService;

    /**
     * Update friend's exponential moving averages when new analytics is created
     * Handles historical data by applying time-based decay
     *
     * @param friendId The ID of the friend
     * @param experience The experience rating ("*", "**", "***")
     * @param hours The duration spent
     * @param date The date when the interaction occurred
     * @param inPerson Whether the interaction was in-person (null = unknown)
     * @throws RuntimeException if update fails to ensure transaction rollback
     */
    @Transactional
    public void updateEmaOnNewAnalytics(Integer friendId, String experience, Double hours, LocalDate date, Boolean inPerson) {
        try {
            Friend friend = friendRepository.findById(friendId)
                    .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Friend not found: " + friendId));

            LocalDate today = LocalDate.now();
            long daysDifference = java.time.temporal.ChronoUnit.DAYS.between(date, today);

            // Skip if date is in the future
            if (daysDifference < 0) {
                log.debug("Skipping EMA update for friend {} - date {} is in the future", friendId, date);
                return;
            }

            // Skip if data is too old (more than 12 days)
            if (daysDifference > 12) {
                log.debug("Skipping EMA update for friend {} - date {} is too old ({} days)",
                         friendId, date, daysDifference);
                return;
            }

            // Get current EMA values (default to 0 if null)
            double currentFrequency = friend.getAverageFrequency() != null ? friend.getAverageFrequency() : 0.0;
            double currentDuration = friend.getAverageDuration() != null ? friend.getAverageDuration() : 0.0;
            double currentExcitement = friend.getAverageExcitement() != null ? friend.getAverageExcitement() : 0.0;
            double currentProximity = friend.getAverageProximity() != null ? friend.getAverageProximity() : 0.0;

            // Get base alpha coefficient based on experience rating
            double baseAlpha = emaProperties.getNewDataAlpha(experience);

            // Convert experience to numeric value
            double experienceValue = emaMathService.experienceToNumber(experience);
            double proximityValue = emaMathService.proximityToNumber(inPerson);

            // Calculate time-decayed alpha and values
            double timeDecayFactor = calculateTimeDecayFactor(daysDifference);
            double effectiveAlpha = baseAlpha * timeDecayFactor;

            // For historical data, we decay the new values but not the current EMA values
            double decayedFrequency = 1.0 * timeDecayFactor;  // 1.0 = we had a meeting
            double decayedDuration = hours * timeDecayFactor;
            double decayedExperience = experienceValue * timeDecayFactor;
            double decayedProximity = proximityValue * timeDecayFactor;

            // Calculate new EMA values via the shared step formula (applyNewValue
            // already encodes EMA = alpha * decayed_new_value + (1 - alpha) * previous_EMA)
            double newFrequency = emaMathService.applyNewValue(currentFrequency, effectiveAlpha, decayedFrequency);
            double newDuration = emaMathService.applyNewValue(currentDuration, effectiveAlpha, decayedDuration);
            double newExcitement = emaMathService.applyNewValue(currentExcitement, effectiveAlpha, decayedExperience);
            double newProximity = emaMathService.applyNewValue(currentProximity, effectiveAlpha, decayedProximity);

            // Update friend's EMA values
            friend.setAverageFrequency(newFrequency);
            friend.setAverageDuration(newDuration);
            friend.setAverageExcitement(newExcitement);
            friend.setAverageProximity(newProximity);

            friendRepository.save(friend);

            log.debug("Updated EMAs for friend {} ({}): freq={:.3f}, dur={:.3f}, exc={:.3f}, prox={:.3f} (date: {}, days ago: {})",
                     friend.getName(), friendId, newFrequency, newDuration, newExcitement, newProximity, date, daysDifference);

        } catch (Exception e) {
            log.error("Error updating EMA for friend {}", friendId, e);
            // Throw runtime exception to trigger transaction rollback
            throw new RuntimeException("Failed to update EMA for friend " + friendId, e);
        }
    }

    /**
     * Calculate time decay factor based on how many days ago the event occurred
     * Uses exponential decay: decay_factor = e^(-k * days) where k is the decay constant
     * 
     * @param daysDifference Number of days between the event date and today
     * @return Decay factor between 0 and 1
     */
    private double calculateTimeDecayFactor(long daysDifference) {
        if (daysDifference == 0) {
            return 1.0; // No decay for today's data
        }
        
        // Decay constant - adjust this to control how quickly historical data loses importance
        // 0.1 means after ~7 days the impact is roughly halved
        double decayConstant = 0.1;
        
        return Math.exp(-decayConstant * daysDifference);
    }
}
