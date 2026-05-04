package communicate.Group.GroupControllers;

import communicate.Group.GroupEntities.GroupSocial;
import communicate.Group.GroupServices.GroupSocialService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups/{groupId}/socials")
public class GroupSocialController {

    @Autowired
    private GroupSocialService groupSocialService;

    @PostMapping
    public ResponseEntity<GroupSocial> createGroupSocial(@PathVariable Integer groupId, @RequestBody GroupSocial groupSocial) {
        return ResponseEntity.ok(groupSocialService.createGroupSocial(groupId, groupSocial));
    }

    @GetMapping("/{socialId}")
    public ResponseEntity<GroupSocial> getGroupSocialById(@PathVariable Integer socialId) {
        return groupSocialService.getGroupSocialById(socialId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<GroupSocial>> getAllGroupSocialsForGroup(@PathVariable Integer groupId) {
        return ResponseEntity.ok(groupSocialService.getAllGroupSocialsForGroup(groupId));
    }

    @PutMapping("update/{socialId}")
    public ResponseEntity<GroupSocial> updateGroupSocial(@PathVariable Integer socialId, @RequestBody GroupSocial groupSocialDetails) {
        return ResponseEntity.ok(groupSocialService.updateGroupSocial(socialId, groupSocialDetails));
    }

    @DeleteMapping("delete/{socialId}")
    public ResponseEntity<Void> deleteGroupSocial(@PathVariable Integer socialId) {
        groupSocialService.deleteGroupSocial(socialId);
        return ResponseEntity.noContent().build();
    }
}

