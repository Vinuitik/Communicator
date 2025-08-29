package communicate.Friend.FriendControllers;

import communicate.Friend.FriendEntities.GroupMember;
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
}
