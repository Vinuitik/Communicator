package communicate.Friend.FriendControllers;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.FriendDTO;
import communicate.Friend.DTOs.MCP_Friend_DTO;
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

    // Paginated friends endpoint (default size of 10)
    @GetMapping("friends/page/{page}")
    public ResponseEntity<Page<MCP_Friend_DTO>> getFriendsPaginated(@PathVariable int page) {
        try {
            Page<MCP_Friend_DTO> friends = friendService.getFriendsPaginated(page);
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated friends: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Paginated friends endpoint (custom size)
    @GetMapping("friends/page/{page}/size/{size}")
    public ResponseEntity<List<MCP_Friend_DTO>> getFriendsPaginatedCustomSize(
            @PathVariable int page, 
            @PathVariable int size) {
        try {
            Page<MCP_Friend_DTO> friendsPage = friendService.getFriendsPaginated(page, size);
            List<MCP_Friend_DTO> friends = friendsPage.getContent();
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated friends: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Update friend's moving averages (called by chrono service)
    @PutMapping("updateAverages")
    public ResponseEntity<String> updateFriendAverages(@RequestBody Map<String, Object> updateData) {
        try {
            Integer friendId = (Integer) updateData.get("id");
            Double averageFrequency = ((Number) updateData.get("averageFrequency")).doubleValue();
            Double averageDuration = ((Number) updateData.get("averageDuration")).doubleValue();
            Double averageExcitement = ((Number) updateData.get("averageExcitement")).doubleValue();

            friendService.updateMovingAverages(friendId, averageFrequency, averageDuration, averageExcitement);
            
            return ResponseEntity.ok("Moving averages updated successfully");
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Friend not found");
        } catch (Exception e) {
            System.err.println("Error updating moving averages: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error updating moving averages: " + e.getMessage());
        }
    }

    // Batch check for friends who had interactions on a specific date
    @PostMapping("/batch-interaction-check")
    public ResponseEntity<List<Integer>> batchInteractionCheck(
            @RequestBody List<Integer> friendIds,
            @RequestParam String date) {
        try {
            LocalDate checkDate = LocalDate.parse(date);
            List<Integer> friendsWithInteractions = analyticsService.getFriendsWithInteractionsOnDate(friendIds, checkDate);
            return ResponseEntity.ok(friendsWithInteractions);
        } catch (Exception e) {
            System.err.println("Error in batch interaction check: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Paginated friends with EMA data for chrono service
    @GetMapping("friends/chrono/page/{page}/size/{size}")
    public ResponseEntity<List<ShortFriendDTO>> getFriendsForChrono(
            @PathVariable int page, 
            @PathVariable int size) {
        try {
            List<ShortFriendDTO> friends = friendService.getFriendsPaginatedForChrono(page, size);
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated friends for chrono: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Get total count of friends (for pagination calculations)
    @GetMapping("friends/count")
    public ResponseEntity<Long> getFriendsCount() {
        try {
            long count = friendService.getFriendsCount();
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            System.err.println("Error getting friends count: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
}
