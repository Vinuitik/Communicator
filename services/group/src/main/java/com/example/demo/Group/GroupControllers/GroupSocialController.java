package com.example.demo.Group.GroupControllers;

import com.example.demo.Group.GroupEntities.GroupSocial;
import com.example.demo.Group.GroupServices.GroupSocialService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/{groupId}/socials")
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
