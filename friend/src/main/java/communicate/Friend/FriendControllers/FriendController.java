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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.print.attribute.standard.Media;

//import org.bson.Document;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.PutMapping;





@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
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

    @PostMapping("/set-primary-photo")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> setPrimaryPhoto( // Change from String to Map<String, Object>
            @RequestParam("photoId") Integer photoId,
            @RequestParam("friendId") Integer friendId) 
    {

        try{
            friendService.setPrimaryPhoto(photoId, friendId);
            
            // Return JSON response instead of plain string
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Image with ID " + photoId + " set as primary for friend with ID " + friendId);
            response.put("photoId", photoId);
            response.put("friendId", friendId);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error setting primary photo: " + e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "An error occurred while setting the primary photo.");
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/{friendId}/primary-photo")
    public ResponseEntity<Map<String, Object>> getPrimaryPhoto(@PathVariable Integer friendId) {
        try {
            Friend friend = friendService.findById(friendId);
            if (friend == null) {
                return ResponseEntity.notFound().build();
            }
            
            Map<String, Object> response = new HashMap<>();
            
            // Get the primary photo ID if it exists
            Integer primaryPhotoId = friend.getPrimaryPhotoId();
            if (primaryPhotoId != null) {
                response.put("primaryPhotoId", primaryPhotoId);
            } else {
                response.put("primaryPhotoId", null);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
