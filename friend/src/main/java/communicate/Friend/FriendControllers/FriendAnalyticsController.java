package communicate.Friend.FriendControllers;

import org.springframework.web.bind.annotation.RestController;
import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendService.AnalyticsService;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;

//import org.bson.Document;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequiredArgsConstructor
@CrossOrigin
public class FriendAnalyticsController {
    private final AnalyticsService analyticsService;

    @GetMapping("analyticsList")
    public List<Analytics> getAnalyticsList(@RequestParam Integer friendId, @RequestParam LocalDate left, @RequestParam LocalDate right){
        return analyticsService.getFriendDateAnalytics(friendId, left, right);
    }
}
