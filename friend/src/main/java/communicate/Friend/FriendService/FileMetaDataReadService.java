package communicate.Friend.FriendService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendRepositories.PersonalResourceRepository;
import communicate.Friend.FriendRepositories.PhotosRepository;
import communicate.Friend.FriendRepositories.VideosRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FileMetaDataReadService {

    @Value("${app.media.page-size:12}")
    private int mediaPageSize;

    private int imagesPageComponent = 4; // each page will consist os not only images but also videos and resources
    private int videosPageComponent = 4;
    private int resourcesPageComponent = 4;

    private final PhotosRepository photoRepository;
    private final VideosRepository videoRepository;
    private final PersonalResourceRepository resourceRepository;

    @Value("${file.repository.service.url:http://localhost:8080/files}")
    private String fileRepositoryServiceUrl;

    public Photos getPhoto(Integer id) {
        return photoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Photo not found with id: " + id));
    }

    public Videos getVideo(Integer id) {
        return videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video not found with id: " + id));
    }

    public PersonalResource getResource(Integer id) {
        return resourceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resource not found with id: " + id));
    }

    // Optional: Return Page object for additional metadata
    public Page<Photos> getPhotosByFriendIdPageableWithMetadata(int friend_id, int page){
        Pageable pageable = PageRequest.of(page, imagesPageComponent);
        return photoRepository.findByFriendIdOrderByTimeBuiltDesc(friend_id, pageable);
    }

    public Page<Videos> getVideosByFriendIdPageableWithMetadata(int friend_id, int page){
        Pageable pageable = PageRequest.of(page, videosPageComponent);
        return videoRepository.findByFriendIdOrderByTimeBuiltDesc(friend_id, pageable);
    }

    public Page<PersonalResource> getResourcesByFriendIdPageableWithMetadata(int friend_id, int page){
        Pageable pageable = PageRequest.of(page, resourcesPageComponent);
        return resourceRepository.findByFriendIdOrderByTimeBuiltDesc(friend_id, pageable);
    }

    
}
