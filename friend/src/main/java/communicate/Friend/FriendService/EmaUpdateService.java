package communicate.Friend.FriendService;

import communicate.Friend.Config.EmaProperties;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmaUpdateService {

    private final FriendRepository friendRepository;
    private final EmaProperties emaProperties;

    /**
     * Update friend's exponential moving averages when new analytics is created
     * This happens in real-time when someone talks to a friend
     * 
     * @throws RuntimeException if update fails to ensure transaction rollback
     */
    @Transactional
    public void updateEmaOnNewAnalytics(Integer friendId, String experience, Double hours) {
        try {
            Friend friend = friendRepository.findById(friendId)
                    .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Friend not found: " + friendId));

            // Get current EMA values (default to 0 if null)
            double currentFrequency = friend.getAverageFrequency() != null ? friend.getAverageFrequency() : 0.0;
            double currentDuration = friend.getAverageDuration() != null ? friend.getAverageDuration() : 0.0;
            double currentExcitement = friend.getAverageExcitement() != null ? friend.getAverageExcitement() : 0.0;

            // Get alpha coefficient based on experience rating
            double alpha = emaProperties.getNewDataAlpha(experience);

            // Convert experience to numeric value
            double experienceValue = convertExperienceToNumber(experience);

            // Calculate new EMA values using: EMA = alpha * new_value + (1 - alpha) * previous_EMA
            // For frequency, new_value = 1 (we had a meeting today)
            double newFrequency = alpha * 1.0 + (1 - alpha) * currentFrequency;
            
            // For duration, new_value = hours spent
            double newDuration = alpha * hours + (1 - alpha) * currentDuration;
            
            // For excitement, new_value = experience rating (1-3)
            double newExcitement = alpha * experienceValue + (1 - alpha) * currentExcitement;

            // Update friend's EMA values
            friend.setAverageFrequency(newFrequency);
            friend.setAverageDuration(newDuration);
            friend.setAverageExcitement(newExcitement);

            friendRepository.save(friend);

            log.debug("Updated EMAs for friend {} ({}): freq={:.3f}, dur={:.3f}, exc={:.3f}", 
                     friend.getName(), friendId, newFrequency, newDuration, newExcitement);

        } catch (Exception e) {
            log.error("Error updating EMA for friend {}", friendId, e);
            // Throw runtime exception to trigger transaction rollback
            throw new RuntimeException("Failed to update EMA for friend " + friendId, e);
        }
    }

    /**
     * Convert experience rating to numeric value
     */
    private double convertExperienceToNumber(String experience) {
        if (experience == null) return 2.0; // Default to neutral
        return switch (experience) {
            case "*" -> 1.0;
            case "**" -> 2.0;
            case "***" -> 3.0;
            default -> 2.0; // Default to neutral
        };
    }
}
