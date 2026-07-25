package coommunicator.connections.Connections.ConnectionsController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionService.ConnectionKnowledgeService;
import coommunicator.connections.Connections.ConnectionService.ConnectionPermissionService;
import coommunicator.connections.Connections.ConnectionService.ConnectionService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

// Mirrors GroupApiController's shape (CRUD + Knowledge endpoints in one
// controller, Permission split into its own — see ConnectionsPermissionController).
@RestController
@RequestMapping("/")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class ConnectionsController {

    private final ConnectionService connectionService;
    private final ConnectionKnowledgeService connectionKnowledgeService;

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listConnections() {
        List<Connection> connections = connectionService.getAll();
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("connections", connections);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/friend/{friendId}")
    public ResponseEntity<Map<String, Object>> listConnectionsForFriend(@PathVariable Long friendId) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("connections", connectionService.getByFriendId(friendId));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createConnection(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            Long friend1Id = Long.valueOf(String.valueOf(body.get("friend1Id")));
            Long friend2Id = Long.valueOf(String.valueOf(body.get("friend2Id")));
            String description = (String) body.get("description");

            Connection saved = connectionService.create(friend1Id, friend2Id, description);
            response.put("success", true);
            response.put("message", "Connection created successfully!");
            response.put("connection", saved);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to create connection: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> getConnection(@PathVariable Long friend1Id, @PathVariable Long friend2Id) {
        Map<String, Object> response = new HashMap<>();
        Optional<Connection> connection = connectionService.getById(friend1Id, friend2Id);
        if (connection.isEmpty()) {
            response.put("success", false);
            response.put("message", "Connection not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }
        response.put("success", true);
        response.put("connection", connection.get());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> deleteConnection(@PathVariable Long friend1Id, @PathVariable Long friend2Id) {
        Map<String, Object> response = new HashMap<>();
        boolean deleted = connectionService.deleteById(friend1Id, friend2Id);
        if (!deleted) {
            response.put("success", false);
            response.put("message", "Connection not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }
        response.put("success", true);
        response.put("message", "Connection deleted successfully!");
        return ResponseEntity.ok(response);
    }

    // ========== Connection Knowledge Management Endpoints ==========

    @PostMapping("/addKnowledge/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> addKnowledge(
            @PathVariable Long friend1Id, @PathVariable Long friend2Id,
            @RequestBody List<ConnectionsKnowledge> knowledgeList) {
        Map<String, Object> response = new HashMap<>();
        try {
            for (ConnectionsKnowledge k : knowledgeList) {
                k.setId(null);
                if (k.getPriority() == null) {
                    k.setPriority(5L);
                }
                if (k.getText() == null || k.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Knowledge text cannot be null or empty");
                }
            }
            List<ConnectionsKnowledge> saved = connectionKnowledgeService.addKnowledge(friend1Id, friend2Id, knowledgeList);
            List<Integer> ids = saved.stream().map(ConnectionsKnowledge::getId).toList();
            response.put("message", "Knowledge added successfully!");
            response.put("ids", ids);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            response.put("message", "An error occurred while adding the knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getKnowledge/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> getAllKnowledge(@PathVariable Long friend1Id, @PathVariable Long friend2Id) {
        Map<String, Object> response = new HashMap<>();
        try {
            response.put("success", true);
            response.put("knowledge", connectionKnowledgeService.getAllKnowledge(friend1Id, friend2Id));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to retrieve knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getKnowledge/{friend1Id}/{friend2Id}/page/{page}")
    public ResponseEntity<Page<ConnectionsKnowledge>> getKnowledgePage(
            @PathVariable Long friend1Id, @PathVariable Long friend2Id, @PathVariable int page) {
        try {
            return ResponseEntity.ok(connectionKnowledgeService.getKnowledgePage(friend1Id, friend2Id, page, 10));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/updateKnowledge")
    public ResponseEntity<String> updateKnowledge(@RequestBody ConnectionsKnowledge knowledge) {
        try {
            connectionKnowledgeService.update(knowledge.getId(), knowledge);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge updated successfully!");
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Knowledge with the given ID not found.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the knowledge.");
        }
    }

    @DeleteMapping("/deleteKnowledge/{knowledgeId}")
    public ResponseEntity<String> deleteKnowledge(@PathVariable Integer knowledgeId) {
        boolean deleted = connectionKnowledgeService.deleteById(knowledgeId);
        if (deleted) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge deleted successfully!");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Knowledge not found!");
    }
}
