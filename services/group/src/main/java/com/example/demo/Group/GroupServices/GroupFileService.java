package com.example.demo.Group.GroupServices;

import com.example.demo.Group.GroupEntities.GroupPhoto;
import com.example.demo.Group.GroupEntities.GroupResource;
import com.example.demo.Group.GroupEntities.GroupVideo;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.GroupPhotoRepository;
import com.example.demo.Group.GroupRepositories.GroupResourceRepository;
import com.example.demo.Group.GroupRepositories.GroupVideoRepository;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;
import lombok.AllArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@AllArgsConstructor
public class GroupFileService {

    private final WebClient webClient;
    private final GroupPhotoRepository groupPhotoRepository;
    private final GroupVideoRepository groupVideoRepository;
    private final GroupResourceRepository groupResourceRepository;
    private final SocialGroupRepository socialGroupRepository;

    @Transactional
    public void saveFiles(List<MultipartFile> files, Long groupId) {
        SocialGroup group = socialGroupRepository.findById(groupId.intValue())
                .orElseThrow(() -> new RuntimeException("Group not found"));

        files.forEach(file -> {
            try {
                String contentType = file.getContentType();
                if (contentType == null) {
                    throw new RuntimeException("MIME type is null for file: " + file.getOriginalFilename());
                }

                if (contentType.startsWith("image")) {
                    GroupPhoto photo = GroupPhoto.builder()
                            .fileName(file.getOriginalFilename())
                            .mimeType(contentType)
                            .timeBuilt(LocalDateTime.now())
                            .socialGroup(group)
                            .build();
                    groupPhotoRepository.saveAndFlush(photo);
                } else if (contentType.startsWith("video")) {
                    GroupVideo video = GroupVideo.builder()
                            .fileName(file.getOriginalFilename())
                            .mimeType(contentType)
                            .timeBuilt(LocalDateTime.now())
                            .socialGroup(group)
                            .build();
                    groupVideoRepository.saveAndFlush(video);
                } else {
                    GroupResource resource = GroupResource.builder()
                            .fileName(file.getOriginalFilename())
                            .mimeType(contentType)
                            .timeBuilt(LocalDateTime.now())
                            .socialGroup(group)
                            .build();
                    groupResourceRepository.saveAndFlush(resource);
                }

                uploadFileToResourceRepository(file, groupId, "groups").block();

            } catch (Exception e) {
                throw new RuntimeException("Failed to save file: " + file.getOriginalFilename(), e);
            }
        });
    }

    @Transactional
    public void deleteFiles(List<Long> photoIds, List<Long> videoIds, List<Long> resourceIds, Long groupId) {
        // Collect all filenames first
        List<String> fileNames = new ArrayList<>();
        
        photoIds.forEach(id -> {
            GroupPhoto photo = groupPhotoRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Photo not found"));
            fileNames.add(photo.getFileName());
        });
        
        videoIds.forEach(id -> {
            GroupVideo video = groupVideoRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Video not found"));
            fileNames.add(video.getFileName());
        });
        
        resourceIds.forEach(id -> {
            GroupResource resource = groupResourceRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Resource not found"));
            fileNames.add(resource.getFileName());
        });

        // Delete from resource repository first
        deleteFilesFromResourceRepository(fileNames, groupId).block();
        
        // Then delete metadata from database
        groupPhotoRepository.deleteAllById(photoIds);
        groupVideoRepository.deleteAllById(videoIds);
        groupResourceRepository.deleteAllById(resourceIds);
    }

    private Mono<Void> uploadFileToResourceRepository(MultipartFile file, Long groupId, String entityType) {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        try {
            builder.part("files", new ByteArrayResource(file.getBytes()))
                    .header("Content-Disposition", "form-data; name=files; filename=" + file.getOriginalFilename());
            builder.part("groupId", groupId.toString());
        } catch (IOException e) {
            return Mono.error(new RuntimeException(e));
        }

        return webClient.post()
                .uri("/groups/upload")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Void.class);
    }

    private Mono<Void> deleteFilesFromResourceRepository(List<String> fileNames, Long groupId) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("fileNames", fileNames);
        requestBody.put("groupId", groupId);

        return webClient.post()
                .uri("/groups/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Mono.just(requestBody), Map.class)
                .retrieve()
                .bodyToMono(Void.class);
    }
}
