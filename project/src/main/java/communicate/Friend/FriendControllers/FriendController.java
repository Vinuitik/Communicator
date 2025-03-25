package communicate.Friend.FriendControllers;

import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.FriendDTO;
import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendService.AnalyticsService;
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.FriendService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;


//import org.bson.Document;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;





@RestController
@RequiredArgsConstructor
@CrossOrigin
public class FriendController {
    private final FriendService friendService;
    private final FriendKnowledgeService knowledgeService;
    private final AnalyticsService analyticsService;

    //private static final Logger logger = LoggerFactory.getLogger(MyController.class);
    
    @GetMapping("allFriends")
    public List<FriendDTO> getAllFriends() {
        List<Friend> friends = friendService.getAllFriends();
        List<FriendDTO> result = new ArrayList<>();
        for(Friend f: friends){
            result.add( new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(), f.getPlannedSpeakingTime()) );
        }
        return result;
    }

    @GetMapping("thisWeek")
    public List<FriendDTO> getWeekFriends() {
        List<Friend> friends = friendService.findThisWeek();
        List<FriendDTO> result = new ArrayList<>();
        for(Friend f: friends){
            result.add( new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(), f.getPlannedSpeakingTime()) );
        }
        return result;
    }

    @PostMapping("addFriend")
    public ResponseEntity<String> addFriend(@Valid @RequestBody Friend friend) { // chaned here
        try {

            LocalDate plannedTime = friendService.setMeetingTime(friend.getExperience(), friend.getAnalytics().get(0).getDate());
            friend.setPlannedSpeakingTime(plannedTime);

            friendService.save(friend);
            analyticsService.saveAll(friend);
            knowledgeService.saveAll(friend.getKnowledge());



            return ResponseEntity.status(HttpStatus.CREATED).body("Friend added successfully!");
        } catch (Exception e) {
            System.err.println("Error adding friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while adding the friend.");
        }
    }

    @DeleteMapping("/deleteFriend/{id}")
    public ResponseEntity<String> deleteFriend(@PathVariable Integer id) {
        try {
            // Attempt to delete the friend by ID
            //int idInt = Integer.parseInt(id);
            friendService.deleteFriendById(id);

            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Friend deleted successfully!");
            
        } catch (Exception e) {
            System.err.println("Error deleting friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the friend.");
        }
    }

    @PutMapping("talkedToFriend/{id}")
    public ResponseEntity<String> updateFriend(
            @PathVariable Integer id, 
            @RequestBody Friend friend) {

        try {
            // Call the service method to update the friend

            LocalDate plannedTime = friendService.setMeetingTime(friend.getExperience(), LocalDate.now());
            friend.setPlannedSpeakingTime(plannedTime);


            List<Analytics> analytics = friend.getAnalytics();
            List<FriendKnowledge> knowledges = friend.getKnowledge();
            

            friend = friendService.updateFriend(id, friend);
            analyticsService.saveAll(analytics,id);
            knowledgeService.saveAll(knowledges,id);

            
            // Return a success message with HTTP status 200 (OK)
            return ResponseEntity.ok("Friend with ID " + id + " updated successfully.");
        } catch (EntityNotFoundException e) {
            // If the entity is not found, return a 404 (Not Found)
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body("Friend with ID " + id + " not found.");
        } catch (Exception e) {
            // For other errors, return a 500 (Internal Server Error)
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body("An error occurred while updating the friend: " + e.getMessage());
        }
    }


    @GetMapping("shortList")
    public List<ShortFriendDTO> getShortList(){
        return friendService.getCompressedList();
    }
}
