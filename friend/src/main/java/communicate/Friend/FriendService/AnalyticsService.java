package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final AnalyticsRepository analyticsRepository;
    private final EmaUpdateService emaUpdateService;

    @Transactional
    public void save(Analytics analytics){
        try {
            analyticsRepository.save(analytics);
            
            // Update EMA values in real-time when analytics is created
            if (analytics.getFriend() != null && analytics.getFriend().getId() != null) {
                emaUpdateService.updateEmaOnNewAnalytics(
                    analytics.getFriend().getId(),
                    analytics.getExperience(),
                    analytics.getHours()
                );
            }
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }
    @Transactional
    public void saveAll(List<Analytics> analytics, Integer friendId){
        try {
            for(Analytics a :analytics){
                Friend f = new Friend();
                f.setId(friendId);
                a.setFriend(f);
                analyticsRepository.save(a);
                
                // Update EMA values for each analytics entry
                emaUpdateService.updateEmaOnNewAnalytics(friendId, a.getExperience(), a.getHours());
            }
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }
    @Transactional
    public void saveAll(Friend friend){
        try {
            List<Analytics> analytics = friend.getAnalytics();
            for(Analytics a :analytics){
                a.setFriend(friend);
                analyticsRepository.save(a);
                
                // Update EMA values for each analytics entry
                if (friend.getId() != null) {
                    emaUpdateService.updateEmaOnNewAnalytics(friend.getId(), a.getExperience(), a.getHours());
                }
            }
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }

    @Transactional
    public List<Analytics> getFriendDateAnalytics(Integer friendId, LocalDate left, LocalDate right){
        try {
            return analyticsRepository.findByFriendIdAndDateBetween(friendId, left, right);
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
        return new ArrayList<Analytics>();
    }

    /**
     * Batch check: Get list of friend IDs who had interactions on a specific date
     * This is optimized for the chrono service to avoid N+1 queries
     */
    @Transactional
    public List<Integer> getFriendsWithInteractionsOnDate(List<Integer> friendIds, LocalDate date) {
        try {
            return analyticsRepository.findFriendIdsWithInteractionsOnDate(friendIds, date);
        } catch (Exception e) {
            System.out.print("Error checking batch interactions " + e.toString());
            return new ArrayList<Integer>();
        }
    }
}
