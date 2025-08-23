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

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendPermission;
import communicate.Friend.FriendService.FriendPermissionService;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class FriendPermissionController {

    private final FriendService friendService;
    private final FriendPermissionService permissionService;

    @PostMapping("addPermission/{id}")
    public ResponseEntity<Map<String, Object>> addPermission(@PathVariable Integer id, @RequestBody List<FriendPermission> permission) {
        Map<String, Object> response = new HashMap<>();
        try {
            Friend friend = friendService.getFriendById(id);
            if (friend == null) {
                response.put("message", "Friend with ID " + id + " not found.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // Associate the friend with each permission object and set default values
            for (FriendPermission p : permission) {
                p.setFriend(friend);
                // Ensure ID is null for new entities
                p.setId(null);
                // Set current date if not provided
                if (p.getDate() == null) {
                    p.setDate(LocalDate.now());
                }
                // Ensure priority is not null
                if (p.getPriority() == null) {
                    p.setPriority(5L); // Default priority
                }
                // Validate required fields
                if (p.getText() == null || p.getText().trim().isEmpty()) {
                    throw new IllegalArgumentException("Permission text cannot be null or empty");
                }
            }

            // Save all permission objects
            permissionService.saveAll(permission);

            // Collect the IDs of the saved permission objects
            List<Integer> ids = permission.stream()
                                        .map(FriendPermission::getId)
                                        .toList(); // Requires Java 16+; use `.collect(Collectors.toList())` for earlier versions

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

    @DeleteMapping("deletePermission/{id}")
    public ResponseEntity<String> deletePermission(@PathVariable Integer id) {
        try {
            permissionService.deletePermissionById(id);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission deleted successfully!");
        } catch (Exception e) {
            System.err.println("Error deleting permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the permission.");
        }
    }

    @PutMapping("updatePermission")
    public ResponseEntity<String> updatePermission(@RequestBody FriendPermission permission) {
        try {
            FriendPermission permissionDb = permissionService.getPermissionById(permission.getId());
            if (permissionDb == null || permissionDb.getId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("Permission with the given ID not found.");
            }
            permission.setFriend(permissionDb.getFriend());
            permissionService.updatePermission(permission);
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Permission updated successfully!");
        } catch (Exception e) {
            System.err.println("Error updating permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while updating the permission.");
        }
    }

    @GetMapping("getPermission/{friendId}/page/{page}")
    public ResponseEntity<Page<FriendPermission>> getPermissionPaginated(
            @PathVariable Integer friendId, 
            @PathVariable int page) {
        try {
            Page<FriendPermission> permission = permissionService.getPermissionByFriendIdPaginated(friendId, page);
            return ResponseEntity.ok(permission);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // Custom page size endpoint
    @GetMapping("getPermission/{friendId}/page/{page}/size/{size}")
    public ResponseEntity<Page<FriendPermission>> getPermissionPaginatedCustomSize(
            @PathVariable Integer friendId, 
            @PathVariable int page,
            @PathVariable int size) {
        try {
            Page<FriendPermission> permission = permissionService.getPermissionByFriendIdPaginated(friendId, page, size);
            return ResponseEntity.ok(permission);
        } catch (Exception e) {
            System.err.println("Error retrieving paginated permission: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    @GetMapping("getPermissionById/{id}")
    public ResponseEntity<FriendPermission> getPermissionById(@PathVariable Integer id) {
        try {
            FriendPermission permission = permissionService.getPermissionById(id);
            if (permission.getId() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.ok(permission);
        } catch (Exception e) {
            System.err.println("Error retrieving permission by ID: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    @GetMapping("getPermission/{friendId}")
    public ResponseEntity<List<FriendPermission>> getAllPermissionsByFriendId(@PathVariable Integer friendId) {
        try {
            List<FriendPermission> permissions = permissionService.getPermissionByFriendIdSorted(friendId);
            return ResponseEntity.ok(permissions);
        } catch (Exception e) {
            System.err.println("Error retrieving permissions: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
}
