package communicate.Friend.FriendService;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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

    // Better approach: Use repository methods with LIMIT and OFFSET
    public List<Photos> getPhotosByFriendIdWithLimitOffset(Integer friendId, Integer offset, Integer limit) {
        return photoRepository.findByFriendIdOrderByTimeBuiltDescWithLimitOffset(friendId, offset, limit);
    }

    public List<Videos> getVideosByFriendIdWithLimitOffset(Integer friendId, Integer offset, Integer limit) {
        return videoRepository.findByFriendIdOrderByTimeBuiltDescWithLimitOffset(friendId, offset, limit);
    }

    public List<PersonalResource> getResourcesByFriendIdWithLimitOffset(Integer friendId, Integer offset, Integer limit) {
        return resourceRepository.findByFriendIdOrderByTimeBuiltDescWithLimitOffset(friendId, offset, limit);
    }

    public Photos getPhotoById(Integer id) {
        return photoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Photo not found with id: " + id));
    }

    
}
