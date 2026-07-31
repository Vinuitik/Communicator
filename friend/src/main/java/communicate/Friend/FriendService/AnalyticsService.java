package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import communicate.Friend.Config.EmaProperties;
import communicate.Friend.DTOs.AnalyticsSeriesDTO;
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
    private final EmaMathService emaMathService;
    private final EmaProperties emaProperties;

    @Transactional
    public void save(Analytics analytics){
        try {
            analyticsRepository.save(analytics);
            
            // Update EMA values in real-time when analytics is created
            if (analytics.getFriend() != null && analytics.getFriend().getId() != null) {
                emaUpdateService.updateEmaOnNewAnalytics(
                    analytics.getFriend().getId(),
                    analytics.getExperience(),
                    analytics.getHours(),
                    analytics.getDate(),
                    analytics.getInPerson()
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
                emaUpdateService.updateEmaOnNewAnalytics(friendId, a.getExperience(), a.getHours(), a.getDate(), a.getInPerson());
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
                    emaUpdateService.updateEmaOnNewAnalytics(friend.getId(), a.getExperience(), a.getHours(), a.getDate(), a.getInPerson());
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

    /**
     * Day-by-day EMA walk over [left, right] for one friend, computed with the
     * same shared step formula (EmaMathService) and alpha tables (EmaProperties)
     * as the immediate-update and nightly-decay paths. Ported 1:1 from
     * react/src/utils/analyticsMath.ts's computeAnalyticsSeries, which used to
     * run this same walk independently in the browser — this is now the one
     * place it happens, extended with proximity as a 4th tracked signal.
     */
    @Transactional
    public AnalyticsSeriesDTO computeSeries(Integer friendId, LocalDate left, LocalDate right) {
        List<Analytics> records = getFriendDateAnalytics(friendId, left, right);

        Map<LocalDate, Double> totalDurationByDate = new HashMap<>();
        Map<LocalDate, Integer> frequencyByDate = new HashMap<>();
        Map<LocalDate, Double> lastIntensityByDate = new HashMap<>();
        Map<LocalDate, Double> lastProximityByDate = new HashMap<>();
        Map<LocalDate, String> experienceByDate = new HashMap<>();

        for (Analytics a : records) {
            LocalDate date = a.getDate();
            totalDurationByDate.merge(date, a.getHours() != null ? a.getHours() : 0.0, Double::sum);
            frequencyByDate.merge(date, 1, Integer::sum);
            lastIntensityByDate.put(date, emaMathService.experienceToNumber(a.getExperience()));
            lastProximityByDate.put(date, emaMathService.proximityToNumber(a.getInPerson()));
            experienceByDate.put(date, a.getExperience());
        }

        List<String> labels = new ArrayList<>();
        List<Double> durationRaw = new ArrayList<>();
        List<Double> frequencyRaw = new ArrayList<>();
        List<Double> intensityRaw = new ArrayList<>();
        List<Double> proximityRaw = new ArrayList<>();
        List<Double> alphas = new ArrayList<>();

        String lastExperience = "*";
        for (LocalDate date = left; !date.isAfter(right); date = date.plusDays(1)) {
            labels.add(date.toString());
            frequencyRaw.add(frequencyByDate.getOrDefault(date, 0).doubleValue());
            intensityRaw.add(lastIntensityByDate.getOrDefault(date, 0.0));
            durationRaw.add(totalDurationByDate.getOrDefault(date, 0.0));
            proximityRaw.add(lastProximityByDate.getOrDefault(date, 0.0));

            double alpha;
            if (experienceByDate.containsKey(date)) {
                lastExperience = experienceByDate.get(date);
                alpha = emaProperties.getNewDataAlpha(lastExperience);
            } else {
                alpha = emaProperties.getDecayAlpha(lastExperience);
            }
            alphas.add(alpha);
        }

        return new AnalyticsSeriesDTO(
                labels,
                emaWalk(durationRaw, alphas),
                emaWalk(frequencyRaw, alphas),
                emaWalk(intensityRaw, alphas),
                emaWalk(proximityRaw, alphas)
        );
    }

    private List<Double> emaWalk(List<Double> raw, List<Double> alphas) {
        List<Double> result = new ArrayList<>(raw.size());
        if (raw.isEmpty()) return result;
        double previous = raw.get(0);
        for (int i = 0; i < raw.size(); i++) {
            previous = emaMathService.applyNewValue(previous, alphas.get(i), raw.get(i));
            result.add(previous);
        }
        return result;
    }
}
