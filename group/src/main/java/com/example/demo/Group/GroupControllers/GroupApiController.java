package com.example.demo.Group.GroupControllers;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.SocialGroupService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class GroupApiController {

    private final SocialGroupService socialGroupService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllGroups() {
        try {
            List<SocialGroup> groups = socialGroupService.getAllGroups();
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("groups", groups);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve groups: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping
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
}
