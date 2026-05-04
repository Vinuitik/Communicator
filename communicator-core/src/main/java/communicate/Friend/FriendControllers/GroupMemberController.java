package communicate.Friend.FriendControllers;

import communicate.Friend.FriendEntities.GroupMember;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.GroupMemberService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/groupMember")
public class GroupMemberController {
    @Autowired
    private GroupMemberService groupMemberService;

    @PostMapping("/addFriendToGroups")
    public ResponseEntity<?> addFriendToGroups(@RequestBody Map<String, Object> payload) {
        try {
            Integer friendId = Integer.valueOf(payload.get("friendId").toString());
            List<Integer> groupIds = (List<Integer>) payload.get("groupIds");
            List<GroupMember> members = groupMemberService.addFriendToGroups(friendId, groupIds);
            return ResponseEntity.status(HttpStatus.CREATED).body(members);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid input: " + e.getMessage());
        }
    }

    @PostMapping("/addFriendsToGroup")
    public ResponseEntity<?> addFriendsToGroup(@RequestBody Map<String, Object> payload) {
        try {
            Integer groupId = Integer.valueOf(payload.get("groupId").toString());
            List<Integer> friendIds = (List<Integer>) payload.get("friendIds");
            List<GroupMember> members = groupMemberService.addFriendsToGroup(friendIds, groupId);
            return ResponseEntity.status(HttpStatus.CREATED).body(members);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid input: " + e.getMessage());
        }
    }

    @PostMapping("/addFriendsToGroups")
    public ResponseEntity<?> addFriendsToGroups(@RequestBody Map<String, Object> payload) {
        try {
            List<Integer> friendIds = (List<Integer>) payload.get("friendIds");
            List<Integer> groupIds = (List<Integer>) payload.get("groupIds");
            List<GroupMember> members = groupMemberService.addFriendsToGroups(friendIds, groupIds);
            return ResponseEntity.status(HttpStatus.CREATED).body(members);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid input: " + e.getMessage());
        }
    }

    // Get all groups for a specific friend
    @GetMapping("/groups/friend/{friendId}")
    public ResponseEntity<?> getGroupsByFriendId(@PathVariable Integer friendId) {
        try {
            List<Integer> groupIds = groupMemberService.getGroupsByFriendId(friendId);
            return ResponseEntity.ok(groupIds);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving groups for friend: " + e.getMessage());
        }
    }

    // Get all group members for a specific friend
    @GetMapping("/members/friend/{friendId}")
    public ResponseEntity<?> getGroupMembersByFriendId(@PathVariable Integer friendId) {
        try {
            List<GroupMember> groupMembers = groupMemberService.getGroupMembersByFriendId(friendId);
            return ResponseEntity.ok(groupMembers);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving group members for friend: " + e.getMessage());
        }
    }

    // Get all friends in a specific group
    @GetMapping("/friends/group/{groupId}")
    public ResponseEntity<?> getFriendsByGroupId(@PathVariable Integer groupId) {
        try {
            List<Friend> friends = groupMemberService.getFriendsByGroupId(groupId);
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving friends for group: " + e.getMessage());
        }
    }

    // Get all group members for a specific group
    @GetMapping("/members/group/{groupId}")
    public ResponseEntity<?> getGroupMembersByGroupId(@PathVariable Integer groupId) {
        try {
            List<GroupMember> groupMembers = groupMemberService.getGroupMembersByGroupId(groupId);
            return ResponseEntity.ok(groupMembers);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error retrieving group members for group: " + e.getMessage());
        }
    }
}
