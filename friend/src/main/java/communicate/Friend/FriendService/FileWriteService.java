package communicate.Friend.FriendService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendRepositories.PersonalResourceRepository;
import communicate.Friend.FriendRepositories.PhotosRepository;
import communicate.Friend.FriendRepositories.VideosRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileWriteService {

    private final PhotosRepository photoRepository;
    private final VideosRepository videoRepository;
    private final PersonalResourceRepository resourceRepository;
    private final FriendRepository friendRepository;
    private final WebClient webTemplate;

    @Value("${file.repository.service.url:http://localhost:5000}")
    private String fileRepositoryServiceUrl;

    @Transactional
    public void saveFiles(List<MultipartFile> files, Integer friendId) {
        Optional<Friend> friendOpt = friendRepository.findById(friendId);
        if (friendOpt.isEmpty()) {
            throw new RuntimeException("Friend not found with id: " + friendId);
        }

        Friend friend = friendOpt.get();

        // Step 1: Save metadata in database (within transaction)
        List<Object> savedEntities = new ArrayList<>();
        try {
            for (MultipartFile file : files) {
                Object savedEntity = saveFileMetadata(file, friend);
                savedEntities.add(savedEntity);
            }
            
            // Force flush to database to ensure metadata is persisted
            // before attempting file repository save
            flushMetadata();
            
            // Step 2: Save files to Flask repository (outside of transaction scope)
            saveFilesToRepository(files, friend);
            
            log.info("Successfully saved {} files for friend {}", files.size(), friendId);
            
        } catch (Exception e) {
            log.error("Failed to save files to repository, rolling back metadata for friend {}", friendId, e);
            // The @Transactional annotation will automatically rollback the database transaction
            // when an exception is thrown from this method
            throw new RuntimeException("Error saving files: " + e.getMessage(), e);
        }
    }

    private Object saveFileMetadata(MultipartFile file, Friend friend) {
        String originalFilename = file.getOriginalFilename();
        String mimeType = file.getContentType();
        
        if (originalFilename == null) {
            throw new RuntimeException("File name cannot be null");
        }

        String extension = getFileExtension(originalFilename).toLowerCase();
        
        switch (getFileCategory(extension)) {
            case "photo":
                Photos photo = Photos.builder()
                    .photoName(originalFilename)
                    .mimeType(mimeType)
                    .friend(friend)
                    .build();
                return photoRepository.save(photo);
                
            case "video":
                Videos video = Videos.builder()
                    .videoName(originalFilename)
                    .mimeType(mimeType)
                    .friend(friend)
                    .build();
                return videoRepository.save(video);
                
            default:
                PersonalResource resource = PersonalResource.builder()
                    .resourceName(originalFilename)
                    .mimeType(mimeType)
                    .friend(friend)
                    .build();
                return resourceRepository.save(resource);
        }
    }

    private void flushMetadata() {
        // Force the EntityManager to flush changes to database
        // This ensures metadata is persisted before file repository call
        photoRepository.flush();
        videoRepository.flush();
        resourceRepository.flush();
    }

    private void saveFilesToRepository(List<MultipartFile> files, Friend friend) {
        try {
            String uploadUrl = fileRepositoryServiceUrl + "/upload";
            
            var bodyBuilder = BodyInserters.fromMultipartData("friendName", friend.getName())
                    .with("friendId", friend.getId().toString());
            
            for (MultipartFile file : files) {
                bodyBuilder = bodyBuilder.with("files", file.getResource());
            }
            
            String response = webTemplate.post()
                    .uri(uploadUrl)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(bodyBuilder)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            
            log.debug("File repository response: {}", response);
            
        } catch (Exception e) {
            log.error("Failed to save files to repository: {}", e.getMessage(), e);
            throw new RuntimeException("Error saving files to repository: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void deleteFiles(List<String> fileNames, Integer friendId) {
        Optional<Friend> friendOpt = friendRepository.findById(friendId);
        if (friendOpt.isEmpty()) {
            throw new RuntimeException("Friend not found with id: " + friendId);
        }

        Friend friend = friendOpt.get();

        try {
            // Step 1: Delete from file repository first
            deleteFilesFromRepository(fileNames, friend);
            
            // Step 2: Delete metadata from database (within transaction)
            for (String fileName : fileNames) {
                deleteFileMetadata(fileName, friend);
            }
            
            // Force flush to ensure deletion is persisted
            flushMetadata();
            
            log.info("Successfully deleted {} files for friend {}", fileNames.size(), friendId);
            
        } catch (Exception e) {
            log.error("Failed to delete files, rolling back for friend {}", friendId, e);
            // @Transactional will automatically rollback database changes
            throw new RuntimeException("Error deleting files: " + e.getMessage(), e);
        }
    }

    private void deleteFileMetadata(String fileName, Friend friend) {
        String extension = getFileExtension(fileName).toLowerCase();
        String category = getFileCategory(extension);
        
        switch (category) {
            case "photo":
                photoRepository.findByPhotoNameAndFriend(fileName, friend)
                    .ifPresent(photoRepository::delete);
                break;
                
            case "video":
                videoRepository.findByVideoNameAndFriend(fileName, friend)
                    .ifPresent(videoRepository::delete);
                break;
                
            default:
                resourceRepository.findByResourceNameAndFriend(fileName, friend)
                    .ifPresent(resourceRepository::delete);
                break;
        }
    }

    private void deleteFilesFromRepository(List<String> fileNames, Friend friend) {
        try {
            String deleteUrl = fileRepositoryServiceUrl + "/delete";
            
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("fileNames", fileNames);
            requestBody.put("friendId", friend.getId().toString());
            
            String response = webTemplate.post()
                    .uri(deleteUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            
            log.debug("File repository delete response: {}", response);
            
        } catch (Exception e) {
            log.error("Failed to delete files from repository: {}", e.getMessage(), e);
            throw new RuntimeException("Error deleting files from repository: " + e.getMessage(), e);
        }
    }

    private String getFileExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex == -1) {
            return "";
        }
        return filename.substring(lastDotIndex);
    }

    public String getFileCategory(String extension) {
        switch (extension) {
            case ".jpg":
            case ".jpeg":
            case ".png":
            case ".gif":
            case ".bmp":
            case ".webp":
                return "photo";
            case ".mp4":
            case ".mov":
            case ".avi":
            case ".mkv":
            case ".webm":
            case ".flv":
                return "video";
            default:
                return "personal";
        }
    }
}
