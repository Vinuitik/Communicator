package com.example.demo.Group.GroupControllers;

import com.example.demo.Group.GroupServices.GroupFileService;
import com.example.demo.Group.GroupServices.SocialGroupService;
import com.example.demo.Group.GroupEntities.SocialGroup;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@AllArgsConstructor
public class GroupFileController {

    private final GroupFileService groupFileService;
    private final SocialGroupService socialGroupService;

    @PostMapping("/{groupId}/files/upload")
    public ResponseEntity<Void> uploadFiles(@RequestParam("files") List<MultipartFile> files, @PathVariable Long groupId) {
        groupFileService.saveFiles(files, groupId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/files/delete")
    public ResponseEntity<Void> deleteFiles(@RequestBody FileDeleteRequest request) {
        groupFileService.deleteFiles(request.getPhotoIds(), request.getVideoIds(), request.getResourceIds(), request.getGroupId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/set-primary-photo")
    public ResponseEntity<Map<String, Object>> setPrimaryPhoto(
            @RequestParam("photoId") Long photoId,
            @RequestParam("groupId") Integer groupId) {
        try {
            socialGroupService.setPrimaryPhoto(photoId, groupId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Photo with ID " + photoId + " set as primary for group with ID " + groupId);
            response.put("photoId", photoId);
            response.put("groupId", groupId);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "An error occurred while setting the primary photo: " + e.getMessage());
            
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    @GetMapping("/{groupId}/primary-photo")
    public ResponseEntity<Map<String, Object>> getPrimaryPhoto(@PathVariable Integer groupId) {
        try {
            SocialGroup group = socialGroupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.notFound().build();
            }
            
            Map<String, Object> response = new HashMap<>();
            Long primaryPhotoId = group.getPrimaryPhotoId();
            response.put("primaryPhotoId", primaryPhotoId);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    // A DTO for the delete request
    static class FileDeleteRequest {
        private List<Long> photoIds;
        private List<Long> videoIds;
        private List<Long> resourceIds;
        private Long groupId;

        // Getters and setters
        public List<Long> getPhotoIds() {
            return photoIds;
        }

        public void setPhotoIds(List<Long> photoIds) {
            this.photoIds = photoIds;
        }

        public List<Long> getVideoIds() {
            return videoIds;
        }

        public void setVideoIds(List<Long> videoIds) {
            this.videoIds = videoIds;
        }

        public List<Long> getResourceIds() {
            return resourceIds;
        }

        public void setResourceIds(List<Long> resourceIds) {
            this.resourceIds = resourceIds;
        }

        public Long getGroupId() {
            return groupId;
        }

        public void setGroupId(Long groupId) {
            this.groupId = groupId;
        }
    }
}
