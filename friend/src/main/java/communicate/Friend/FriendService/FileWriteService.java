package communicate.Friend.FriendService;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendRepositories.PersonalResourceRepository;
import communicate.Friend.FriendRepositories.PhotosRepository;
import communicate.Friend.FriendRepositories.VideosRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FileWriteService {

    private final PhotosRepository photoRepository;
    private final VideosRepository videoRepository;
    private final PersonalResourceRepository resourceRepository;
    private final FriendRepository friendRepository;
    private final RestTemplate restTemplate;

    @Value("${file.repository.service.url:http://localhost:5000}")
    private String fileRepositoryServiceUrl;

    public void saveFiles(List<MultipartFile> files, Integer friendId) {
        Optional<Friend> friendOpt = friendRepository.findById(friendId);
        if (friendOpt.isEmpty()) {
            throw new RuntimeException("Friend not found with id: " + friendId);
        }

        Friend friend = friendOpt.get();

        // Save metadata in database
        for (MultipartFile file : files) {
            saveFileMetadata(file, friend);
        }

        // Save files to Flask repository
        saveFilesToRepository(files, friend);
    }

    private void saveFileMetadata(MultipartFile file, Friend friend) {
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
                photoRepository.save(photo);
                break;
                
            case "video":
                Videos video = Videos.builder()
                    .videoName(originalFilename)
                    .mimeType(mimeType)
                    .friend(friend)
                    .build();
                videoRepository.save(video);
                break;
                
            default:
                PersonalResource resource = PersonalResource.builder()
                    .resourceName(originalFilename)
                    .mimeType(mimeType)
                    .friend(friend)
                    .build();
                resourceRepository.save(resource);
                break;
        }
    }

    private void saveFilesToRepository(List<MultipartFile> files, Friend friend) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            
            // Add friend information
            body.add("friendName", friend.getName());
            body.add("friendId", friend.getId().toString());

            // Add files
            for (MultipartFile file : files) {
                body.add("files", file.getResource());
            }

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            
            // Use the @Value configured URL with the upload endpoint
            String uploadUrl = fileRepositoryServiceUrl + "/upload";
            ResponseEntity<String> response = restTemplate.postForEntity(uploadUrl, requestEntity, String.class);
            
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Failed to save files to repository: " + response.getBody());
            }
        } catch (Exception e) {
            throw new RuntimeException("Error saving files to repository: " + e.getMessage(), e);
        }
    }

    private String getFileExtension(String filename) {
        int lastDotIndex = filename.lastIndexOf('.');
        if (lastDotIndex == -1) {
            return "";
        }
        return filename.substring(lastDotIndex);
    }

    private String getFileCategory(String extension) {
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
