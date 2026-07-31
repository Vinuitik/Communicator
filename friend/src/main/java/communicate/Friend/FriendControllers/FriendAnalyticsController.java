package communicate.Friend.FriendControllers;

import org.springframework.web.bind.annotation.RestController;
import communicate.Friend.DTOs.AnalyticsSeriesDTO;
import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendService.AnalyticsService;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;

//import org.bson.Document;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class FriendAnalyticsController {
    private final AnalyticsService analyticsService;

    @GetMapping("analyticsList")
    public List<Analytics> getAnalyticsList(@RequestParam Integer friendId, @RequestParam LocalDate left, @RequestParam LocalDate right){
        return analyticsService.getFriendDateAnalytics(friendId, left, right);
    }

    // Server-computed day-by-day EMA series (duration/frequency/intensity/proximity)
    // for charts — replaces react/src/utils/analyticsMath.ts's client-side recompute,
    // which independently re-derived the same numbers from analyticsList's raw rows.
    @GetMapping("analyticsSeries")
    public AnalyticsSeriesDTO getAnalyticsSeries(@RequestParam Integer friendId, @RequestParam LocalDate left, @RequestParam LocalDate right){
        return analyticsService.computeSeries(friendId, left, right);
    }
}
