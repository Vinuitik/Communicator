package com.example.demo.Group.GroupControllers;

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

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.GroupKnowledgeService;
import com.example.demo.Group.GroupServices.SocialGroupService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class GroupApiController {

    private final SocialGroupService socialGroupService;
    private final GroupKnowledgeService groupKnowledgeService;

    @PostMapping("/create")
    public ResponseEntity<Map<String, Object>> createGroup(@RequestBody SocialGroup group) {
        try {
            SocialGroup savedGroup = socialGroupService.createGroup(group);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Group created successfully!");
            response.put("group", savedGroup);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to create group: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getGroupDetails(@PathVariable Integer id) {
        try {
            SocialGroup group = socialGroupService.getGroupById(id);
            Map<String, Object> response = new HashMap<>();
            if (group != null) {
                response.put("success", true);
                response.put("group", group);
                return ResponseEntity.ok(response);
            } else {
                response.put("success", false);
                response.put("message", "Group not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve group: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteGroup(@PathVariable Integer id) {
        try {
            boolean deleted = socialGroupService.deleteGroup(id);
            Map<String, Object> response = new HashMap<>();
            if (deleted) {
                response.put("success", true);
                response.put("message", "Group deleted successfully!");
                return ResponseEntity.ok(response);
            } else {
                response.put("success", false);
                response.put("message", "Group not found!");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to delete group: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    // ========== Group Knowledge Management Endpoints ==========

    @PostMapping("/addKnowledge/{groupId}")
    public ResponseEntity<Map<String, Object>> addKnowledgeToGroup(
            @PathVariable Integer groupId,
            @RequestBody List<GroupKnowledge> knowledgeList) {
        Map<String, Object> response = new HashMap<>();
        try {
            // Get the group to verify it exists
            SocialGroup group = socialGroupService.getGroupById(groupId);
            if (group == null) {
                response.put("message", "Group with ID " + groupId + " not found.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // Associate the group with each knowledge object and set default values
            for (GroupKnowledge k : knowledgeList) {
                k.setGroup(group);
                // Ensure ID is null for new entities
                k.setId(null);
                // Ensure priority is not null
                if (k.getPriority() == null) {
                    k.setPriority(5L); // Default priority
                }
                // Validate required fields
                if (k.getText() == null || k.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Knowledge text cannot be null or empty");
                }
            }

            List<GroupKnowledge> savedKnowledge = groupKnowledgeService.addKnowledgeToGroup(groupId, knowledgeList);

            // Collect the IDs of the saved knowledge objects
            List<Integer> ids = savedKnowledge.stream()
                                        .map(GroupKnowledge::getId)
                                        .toList();

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

    @GetMapping("/getKnowledge/{groupId}")
    public ResponseEntity<Map<String, Object>> getAllGroupKnowledge(@PathVariable Integer groupId) {
        try {
            List<GroupKnowledge> knowledge = groupKnowledgeService.getAllGroupKnowledge(groupId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("knowledge", knowledge);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getKnowledge/{groupId}/page/{page}")
    public ResponseEntity<Page<GroupKnowledge>> getGroupKnowledgePage(
            @PathVariable Integer groupId,
            @PathVariable int page) {
        try {
            Page<GroupKnowledge> knowledgePage = groupKnowledgeService.getGroupKnowledgePage(groupId, page, 10);
            return ResponseEntity.ok(knowledgePage);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/updateKnowledge")
    public ResponseEntity<String> updateKnowledge(@RequestBody GroupKnowledge knowledgeData) {
        try {
            Optional<GroupKnowledge> knowledgeDbOpt = groupKnowledgeService.getKnowledgeById(knowledgeData.getId());
            if (knowledgeDbOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Knowledge with the given ID not found.");
            }
            GroupKnowledge knowledgeDb = knowledgeDbOpt.get();
            knowledgeData.setGroup(knowledgeDb.getGroup());
            groupKnowledgeService.updateKnowledge(knowledgeData.getId(), knowledgeData);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge updated successfully!");
        } catch (Exception e) {
            System.err.println("Error updating knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the knowledge.");
        }
    }

    @DeleteMapping("/deleteKnowledge/{knowledgeId}")
    public ResponseEntity<String> deleteKnowledge(@PathVariable Integer knowledgeId) {
        try {
            boolean deleted = groupKnowledgeService.deleteKnowledge(knowledgeId);
            if (deleted) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Knowledge deleted successfully!");
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Knowledge not found!");
            }
        } catch (Exception e) {
            System.err.println("Error deleting knowledge: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the knowledge.");
        }
    }
}
