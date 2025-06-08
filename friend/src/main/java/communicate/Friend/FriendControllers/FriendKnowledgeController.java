package communicate.Friend.FriendControllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class FriendKnowledgeController {

    private final FriendService friendService;
    private final FriendKnowledgeService knowledgeService;

    @PostMapping("addKnowledge/{id}")
    public ResponseEntity<Map<String, Object>> addKnowledge(@PathVariable Integer id, @RequestBody List<FriendKnowledge> knowledge) {
        Map<String, Object> response = new HashMap<>();
        try {
            Friend friend = friendService.getFriendById(id);
            if (friend == null) {
                response.put("message", "Friend with ID " + id + " not found.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // Associate the friend with each knowledge object
            for (FriendKnowledge k : knowledge) {
                k.setFriend(friend);
            }

            // Save all knowledge objects
            knowledgeService.saveAll(knowledge);

            // Collect the IDs of the saved knowledge objects
            List<Integer> ids = knowledge.stream()
                                        .map(FriendKnowledge::getId)
                                        .toList(); // Requires Java 16+; use `.collect(Collectors.toList())` for earlier versions

            response.put("message", "Knowledge added successfully!");
            response.put("ids", ids); // Add the IDs to the response

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            System.err.println("Error adding knowledge: " + e.getMessage());
            response.put("message", "An error occurred while adding the knowledge.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }


    @DeleteMapping("deleteKnowledge/{id}")
    public ResponseEntity<String> deleteKnowledge(@PathVariable Integer id) {
        try {
            knowledgeService.deleteKnowledgeById(id);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge deleted successfully!");
        } catch (Exception e) {
            System.err.println("Error deleting knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the knowledge.");
        }
    }

    @PutMapping("updateKnowledge")
    public ResponseEntity<String> updateKnowledge(@RequestBody FriendKnowledge knowledge) {
        try {
            FriendKnowledge knowledgeDb = knowledgeService.getKnowledgeById(knowledge.getId());
            if (knowledgeDb == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Knowledge with the given ID not found.");
            }
            knowledge.setFriend(knowledgeDb.getFriend());
            knowledgeService.updateKnowledge(knowledge);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge updated successfully!");
        } catch (Exception e) {
            System.err.println("Error deleting knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the knowledge.");
        }
    }
}
