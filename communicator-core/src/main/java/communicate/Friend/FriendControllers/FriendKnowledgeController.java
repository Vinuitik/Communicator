package communicate.Friend.FriendControllers;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.MCP_Knowledge_DTO;
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

            // Associate the friend with each knowledge object and set default values
            for (FriendKnowledge k : knowledge) {
                k.setFriend(friend);
                // Ensure ID is null for new entities
                k.setId(null);
                // Set current date if not provided
                if (k.getDate() == null) {
                    k.setDate(LocalDate.now());
                }
                // Ensure priority is not null
                if (k.getPriority() == null) {
                    k.setPriority(5L); // Default priority
                }
                // Validate required fields
                if (k.getText() == null || k.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Knowledge text cannot be null or empty");
                }
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
            e.printStackTrace(); // Add stack trace for debugging
            response.put("message", "An error occurred while adding the knowledge: " + e.getMessage());
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

    @GetMapping("getKnowledge/{friendId}/page/{page}")
    public ResponseEntity<Page<FriendKnowledge>> getKnowledgePaginated(
            @PathVariable Integer friendId, 
            @PathVariable int page) {
        try {
            Page<FriendKnowledge> knowledge = knowledgeService.getKnowledgeByFriendIdPaginated(friendId, page);
            return ResponseEntity.ok(knowledge);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Custom page size endpoint (for AI server)
    @GetMapping("getKnowledge/{friendId}/page/{page}/size/{size}")
    public ResponseEntity<List<MCP_Knowledge_DTO>> getKnowledgePaginatedCustomSize(
            @PathVariable Integer friendId, 
            @PathVariable int page,
            @PathVariable int size) {
        try {
            Page<FriendKnowledge> knowledge = knowledgeService.getKnowledgeByFriendIdPaginated(friendId, page, size);
            List<MCP_Knowledge_DTO> dto_list = knowledge.getContent()
                .stream()
                .map(k -> MCP_Knowledge_DTO.builder()
                    .id(k.getId())
                    .fact(k.getText())
                    .importance(k.getPriority())
                    .build())
                .toList();
            return ResponseEntity.ok(dto_list);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    @GetMapping("getKnowledgeById/{id}")
    public ResponseEntity<FriendKnowledge> getKnowledgeById(@PathVariable Integer id) {
        try {
            FriendKnowledge knowledge = knowledgeService.getKnowledgeById(id);
            if (knowledge.getId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.ok(knowledge);
        } catch (Exception e) {
            System.err.println("Error retrieving knowledge by ID: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get all knowledge IDs for a specific friend
     * Used by AI agent for building FAISS indexes
     */
    @GetMapping("getKnowledgeIds/{friendId}")
    public ResponseEntity<List<Integer>> getKnowledgeIdsByFriendId(@PathVariable Integer friendId) {
        try {
            List<Integer> knowledgeIds = knowledgeService.getKnowledgeIdsByFriendId(friendId);
            return ResponseEntity.ok(knowledgeIds);
        } catch (Exception e) {
            System.err.println("Error retrieving knowledge IDs for friend " + friendId + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get the full text of a knowledge item by ID
     * Used by AI agent for chunk text reconstruction
     */
    @GetMapping("getKnowledgeText/{id}")
    public ResponseEntity<Map<String, String>> getKnowledgeTextById(@PathVariable Integer id) {
        try {
            FriendKnowledge knowledge = knowledgeService.getKnowledgeById(id);
            if (knowledge.getId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            
            Map<String, String> response = new HashMap<>();
            response.put("id", knowledge.getId().toString());
            response.put("text", knowledge.getText());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error retrieving knowledge text for ID " + id + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
}
