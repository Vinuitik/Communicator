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

    @Transactional
    public void save(Analytics analytics){
        try {
            analyticsRepository.save(analytics);
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
            }
        } catch (Exception e) {
           System.out.print("Error saving analytics " + e.toString());
        }
    }
    @Transactional
    public void saveAll(Friend friend){
        try {
            List<Analytics> analytics = friend.getAnalytics();
            for(Analytics a :analytics){;
                a.setFriend(friend);
                analyticsRepository.save(a);
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
}
