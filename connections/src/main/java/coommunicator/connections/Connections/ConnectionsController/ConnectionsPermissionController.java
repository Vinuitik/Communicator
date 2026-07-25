package coommunicator.connections.Connections.ConnectionsController;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionPermission;
import coommunicator.connections.Connections.ConnectionService.ConnectionPermissionService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

// Same pattern as GroupPermissionController — mounted at
// /api/connections/permission/... (see PathPrefixConfig).
@RestController
@RequestMapping("/permission")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class ConnectionsPermissionController {

    private final ConnectionPermissionService connectionPermissionService;

    @PostMapping("/addPermission/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> addPermission(
            @PathVariable Long friend1Id, @PathVariable Long friend2Id,
            @RequestBody List<ConnectionPermission> permissionList) {
        Map<String, Object> response = new HashMap<>();
        try {
            for (ConnectionPermission p : permissionList) {
                p.setId(null);
                if (p.getPriority() == null) {
                    p.setPriority(5L);
                }
                if (p.getText() == null || p.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Permission text cannot be null or empty");
                }
            }
            List<ConnectionPermission> saved = connectionPermissionService.addPermission(friend1Id, friend2Id, permissionList);
            List<Integer> ids = saved.stream().map(ConnectionPermission::getId).toList();
            response.put("message", "Permission added successfully!");
            response.put("ids", ids);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            response.put("message", "An error occurred while adding the permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getPermission/{friend1Id}/{friend2Id}")
    public ResponseEntity<Map<String, Object>> getAllPermission(@PathVariable Long friend1Id, @PathVariable Long friend2Id) {
        Map<String, Object> response = new HashMap<>();
        try {
            response.put("success", true);
            response.put("permission", connectionPermissionService.getAllPermission(friend1Id, friend2Id));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to retrieve permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @GetMapping("/getPermission/{friend1Id}/{friend2Id}/page/{page}")
    public ResponseEntity<Page<ConnectionPermission>> getPermissionPage(
            @PathVariable Long friend1Id, @PathVariable Long friend2Id, @PathVariable int page) {
        try {
            return ResponseEntity.ok(connectionPermissionService.getPermissionPage(friend1Id, friend2Id, page, 10));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/updatePermission")
    public ResponseEntity<String> updatePermission(@RequestBody ConnectionPermission permission) {
        try {
            connectionPermissionService.update(permission.getId(), permission);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission updated successfully!");
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Permission with the given ID not found.");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the permission.");
        }
    }

    @DeleteMapping("/deletePermission/{permissionId}")
    public ResponseEntity<String> deletePermission(@PathVariable Integer permissionId) {
        boolean deleted = connectionPermissionService.deleteById(permissionId);
        if (deleted) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission deleted successfully!");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Permission not found!");
    }
}
