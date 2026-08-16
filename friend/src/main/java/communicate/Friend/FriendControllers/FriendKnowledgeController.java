package communicate.Friend.FriendControllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.MCP_Knowledge_DTO;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendService.FriendKnowledgeService;
import communicate.Friend.FriendService.OutboxWriteService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class FriendKnowledgeController {

    private final FriendKnowledgeService knowledgeService;
    private final OutboxWriteService outboxWriteService;

    @PostMapping("addKnowledge/{id}")
    public ResponseEntity<Map<String, Object>> addKnowledge(
            @PathVariable Integer id,
            @RequestBody List<FriendKnowledge> knowledge,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        Map<String, Object> response = new HashMap<>();
        UUID requestId = null;
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            try {
                requestId = UUID.fromString(idempotencyKey);
            } catch (IllegalArgumentException ignored) {
                // Not a UUID — treat as no idempotency key rather than failing the request.
            }
        }

        try {
            List<Integer> ids = outboxWriteService.applyAddKnowledge(id, knowledge, requestId);
            response.put("message", "Knowledge added successfully!");
            response.put("ids", ids);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (EntityNotFoundException e) {
            response.put("message", "Friend with ID " + id + " not found.");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
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
            // Fetch-and-merge (text/priority only) — the old path saved the whole
            // request body as-is, which nulled out reviewDate/interval whenever the
            // client (correctly) didn't send them. See knowledge-core's AbstractFactService.
            knowledgeService.update(knowledge.getId(), knowledge);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge updated successfully!");
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body("Knowledge with the given ID not found.");
        } catch (Exception e) {
            System.err.println("Error updating knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the knowledge.");
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
