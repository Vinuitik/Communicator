package communicate.Friend.FriendControllers;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.FriendDTO;
import communicate.Friend.DTOs.FriendProfileDTO;
import communicate.Friend.DTOs.MCP_Friend_DTO;
import communicate.Friend.DTOs.ShortFriendDTO;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendService.FileMetaDataReadService;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.OutboxWriteService;
import communicate.Friend.FriendService.OutreachService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;


import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.PutMapping;





@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class FriendController {
    private final FriendService friendService;
    private final FileMetaDataReadService fileMetaDataReadService;
    private final OutreachService outreachService;
    private final OutboxWriteService outboxWriteService;

    //private static final Logger logger = LoggerFactory.getLogger(MyController.class);
    
    @GetMapping("allFriends")
    public List<FriendDTO> getAllFriends() {
        List<Friend> friends = friendService.getAllFriends();
        List<FriendDTO> result = new ArrayList<>();
        for(Friend f: friends){
            result.add( new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(), f.getPlannedSpeakingTime(),
                                    f.getAverageFrequency(), f.getAverageDuration(), f.getAverageExcitement(), f.getAverageProximity(), false, f.getRole(), f.getSchedulingExplanation(), f.getLeech(), f.getFlashcardsEnabled()) );
        }
        return result;
    }

    // Added for the talkedForm SPA port — the Thymeleaf /talked/{id} page
    // (WebController) had a model-bound Friend to prefill the edit form from;
    // the React page needs the same data as JSON. Literal segments
    // (allFriends, thisWeek, shortList, ...) always win over this {id}
    // pattern in Spring's route matching, so it can't shadow them.
    @GetMapping("/{id}")
    public ResponseEntity<FriendDTO> getFriend(@PathVariable Integer id) {
        // FriendService.findById returns a blank `new Friend()` (id == null),
        // not null, when nothing matches — it's a pre-existing quirk of that
        // method (also relied on elsewhere), not something to fix here.
        Friend friend = friendService.findById(id);
        if (friend.getId() == null) {
            return ResponseEntity.notFound().build();
        }
        FriendDTO dto = new FriendDTO(friend.getId(), friend.getName(), friend.getExperience(), friend.getDateOfBirth(),
                friend.getPlannedSpeakingTime(), friend.getAverageFrequency(), friend.getAverageDuration(),
                friend.getAverageExcitement(), friend.getAverageProximity(), false, friend.getRole(), friend.getSchedulingExplanation(), friend.getLeech(), friend.getFlashcardsEnabled());
        return ResponseEntity.ok(dto);
    }

    // (Stretch, design doc Next Steps #11) On-demand LLM outreach-message
    // draft via host-wrapper — an explicit user action (button click), not
    // computed automatically like schedulingExplanation. 503 on failure
    // rather than a fabricated fallback message.
    @GetMapping("/{id}/outreach-draft")
    public ResponseEntity<Map<String, String>> getOutreachDraft(@PathVariable Integer id) {
        Friend friend = friendService.findById(id);
        if (friend.getId() == null) {
            return ResponseEntity.notFound().build();
        }
        String draft = outreachService.draftOutreachMessage(friend);
        if (draft == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Outreach drafting is unavailable right now."));
        }
        return ResponseEntity.ok(Map.of("draft", draft));
    }

    // Added for the profile.html SPA port — WebController.profile's Thymeleaf
    // model assembled friend.name/relationshipType/dateMet plus a
    // server-resolved primary photo *name* (fileMetaDataReadService.getPhotoById);
    // none of that was ever exposed as JSON (getFriend/FriendDTO doesn't carry
    // relationshipType or dateMet, and there's no client-callable id->name
    // lookup for photos). This is the JSON twin of that assembly, not a new
    // capability. Distinct path from WebController's own `profile/{id}`
    // (which still serves the Thymeleaf HTML) so the two don't collide.
    @GetMapping("/profile/{id}/data")
    public ResponseEntity<FriendProfileDTO> getProfileData(@PathVariable Integer id) {
        Friend friend = friendService.findById(id);
        if (friend.getId() == null) {
            return ResponseEntity.notFound().build();
        }
        String mainPhotoName = null;
        if (friend.getPrimaryPhotoId() != null) {
            try {
                Photos mainPhoto = fileMetaDataReadService.getPhotoById(friend.getPrimaryPhotoId());
                mainPhotoName = mainPhoto.getPhotoName();
            } catch (RuntimeException e) {
                // Stale primaryPhotoId (photo since deleted) — fall back to no photo,
                // same as WebController.profile would silently do via a null lookup.
                mainPhotoName = null;
            }
        }
        FriendProfileDTO dto = new FriendProfileDTO(friend.getId(), friend.getName(), friend.getRelationshipType(),
                friend.getDateMet(), mainPhotoName);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("thisWeek")
    public List<FriendDTO> getWeekFriends() {
        List<Friend> friends = friendService.findThisWeek();
        List<FriendDTO> result = new ArrayList<>();
        
        // Get current week boundaries to check for birthdays
        LocalDate now = LocalDate.now();
        LocalDate monday = now.minusDays(now.getDayOfWeek().getValue() - 1);
        LocalDate sunday = monday.plusDays(6);
        int currentYear = now.getYear();
        
        for(Friend f: friends){
            boolean isBirthdayThisWeek = false;
            
            // Check if friend has a birthday this week
            if (f.getDateOfBirth() != null) {
                LocalDate birthdayThisYear = f.getDateOfBirth().withYear(currentYear);
                isBirthdayThisWeek = !birthdayThisYear.isBefore(monday) && !birthdayThisYear.isAfter(sunday);
            }
            
            result.add( new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(), f.getPlannedSpeakingTime(),
                                    f.getAverageFrequency(), f.getAverageDuration(), f.getAverageExcitement(), f.getAverageProximity(), isBirthdayThisWeek, f.getRole(), f.getSchedulingExplanation(), f.getLeech(), f.getFlashcardsEnabled()) );
        }
        return result;
    }

    @PostMapping("addFriend")
    public ResponseEntity<String> addFriend(
            @Valid @RequestBody Friend friend,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) { // chaned here
        try {
            outboxWriteService.applyAddFriend(friend, parseIdempotencyKey(idempotencyKey));
            return ResponseEntity.status(HttpStatus.CREATED).body("Friend added successfully!");
        } catch (Exception e) {
            System.err.println("Error adding friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while adding the friend.");
        }
    }

    // Soft delete: moves the friend to the Bin (deleted_at set). Purged for
    // real 7 days later by PurgeService. See FriendService.deleteFriendById.
    @DeleteMapping("/deleteFriend/{id}")
    public ResponseEntity<String> deleteFriend(@PathVariable Integer id) {
        try {
            friendService.deleteFriendById(id);

            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Friend deleted successfully!");

        } catch (Exception e) {
            System.err.println("Error deleting friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the friend.");
        }
    }

    @PostMapping("/restoreFriend/{id}")
    public ResponseEntity<String> restoreFriend(@PathVariable Integer id) {
        try {
            boolean restored = friendService.restoreFriendById(id);
            if (!restored) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Friend not found in bin.");
            }
            return ResponseEntity.status(HttpStatus.OK).body("Friend restored successfully!");
        } catch (Exception e) {
            System.err.println("Error restoring friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while restoring the friend.");
        }
    }

    @GetMapping("/deletedFriends")
    public ResponseEntity<List<Friend>> getDeletedFriends() {
        return ResponseEntity.ok(friendService.getDeletedFriends());
    }

    @PutMapping("talkedToFriend/{id}")
    public ResponseEntity<String> updateFriend(
            @PathVariable Integer id,
            @RequestBody Friend friend,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        try {
            outboxWriteService.applyTalkedToFriend(id, friend, parseIdempotencyKey(idempotencyKey));
            return ResponseEntity.ok("Friend with ID " + id + " updated successfully.");
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body("Friend with ID " + id + " not found.");
        } catch (Exception e) {
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

    @GetMapping("friends/ui/page/{page}/size/{size}")
    public ResponseEntity<List<FriendDTO>> getFriendsPaginatedForUI(
            @PathVariable int page, 
            @PathVariable int size) {
        try {
            Page<Friend> friendsPage = friendService.getFriendsPagedForUI(page, size);
            List<FriendDTO> friends = friendsPage.getContent().stream()
                .map(f -> new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(), f.getPlannedSpeakingTime(),
                                        f.getAverageFrequency(), f.getAverageDuration(), f.getAverageExcitement(), f.getAverageProximity(), false, f.getRole(), f.getSchedulingExplanation(), f.getLeech(), f.getFlashcardsEnabled()))
                .toList();
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated friends for UI: " + e.getMessage());
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

    // Shared by every offline-outbox-covered endpoint (addFriend, talkedToFriend,
    // addKnowledge). Returns null for a missing/malformed header rather than
    // rejecting the request — a caller predating the outbox, or one that doesn't
    // send this write kind through the outbox, just gets the old non-idempotent
    // behavior.
    private static UUID parseIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) return null;
        try {
            return UUID.fromString(idempotencyKey);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
