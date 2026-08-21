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

import com.example.demo.Group.GroupEntities.GroupPermission;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.GroupPermissionService;
import com.example.demo.Group.GroupServices.SocialGroupService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/permission")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class GroupPermissionController {

    private final SocialGroupService socialGroupService;
    private final GroupPermissionService groupPermissionService;

    @PostMapping("/addPermission/{groupId}")
    public ResponseEntity<Map<String, Object>> addPermissionToGroup(
            @PathVariable Integer groupId,
            @RequestBody List<GroupPermission> permissionList) {
        Map<String, Object> response = new HashMap<>();
        try {
            // Get the group to verify it exists
            SocialGroup group = socialGroupService.getGroupById(groupId);
            if (group == null) {
                response.put("message", "Group with ID " + groupId + " not found.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // Associate the group with each permission object and set default values
            for (GroupPermission p : permissionList) {
                p.setGroup(group);
                // Ensure ID is null for new entities
                p.setId(null);
                // Ensure priority is not null
                if (p.getPriority() == null) {
                    p.setPriority(5L); // Default priority
                }
                // Validate required fields
                if (p.getText() == null || p.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Permission text cannot be null or empty");
                }
            }

            List<GroupPermission> savedPermission = groupPermissionService.addPermissionToGroup(groupId, permissionList);

            // Collect the IDs of the saved permission objects
            List<Integer> ids = savedPermission.stream()
                                        .map(GroupPermission::getId)
                                        .toList();

            response.put("message", "Permission added successfully!");
            response.put("ids", ids); // Add the IDs to the response
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            System.err.println("Error adding permission: " + e.getMessage());
            e.printStackTrace(); // Add stack trace for debugging
            response.put("message", "An error occurred while adding the permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getPermission/{groupId}")
    public ResponseEntity<Map<String, Object>> getAllGroupPermission(@PathVariable Integer groupId) {
        try {
            List<GroupPermission> permission = groupPermissionService.getAllGroupPermission(groupId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("permission", permission);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to retrieve permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getPermission/{groupId}/page/{page}")
    public ResponseEntity<Page<GroupPermission>> getGroupPermissionPage(
            @PathVariable Integer groupId,
            @PathVariable int page) {
        try {
            Page<GroupPermission> permissionPage = groupPermissionService.getGroupPermissionPage(groupId, page, 10);
            return ResponseEntity.ok(permissionPage);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/updatePermission")
    public ResponseEntity<String> updatePermission(@RequestBody GroupPermission permissionData) {
        try {
            Optional<GroupPermission> permissionDbOpt = groupPermissionService.getPermissionById(permissionData.getId());
            if (permissionDbOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Permission with the given ID not found.");
            }
            GroupPermission permissionDb = permissionDbOpt.get();
            permissionData.setGroup(permissionDb.getGroup());
            groupPermissionService.updatePermission(permissionData.getId(), permissionData);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission updated successfully!");
        } catch (Exception e) {
            System.err.println("Error updating permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the permission.");
        }
    }

    @DeleteMapping("/deletePermission/{permissionId}")
    public ResponseEntity<String> deletePermission(@PathVariable Integer permissionId) {
        try {
            boolean deleted = groupPermissionService.deletePermission(permissionId);
            if (deleted) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission deleted successfully!");
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Permission not found!");
            }
        } catch (Exception e) {
            System.err.println("Error deleting permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the permission.");
        }
    }
}
