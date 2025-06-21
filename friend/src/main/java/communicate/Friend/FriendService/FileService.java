package communicate.Friend.FriendService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

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
public class FileService {

    private final PhotosRepository photoRepository;
    private final VideosRepository videoRepository;
    private final PersonalResourceRepository resourceRepository;

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

    public byte[] createCompressedZipForFriend(Integer friendId) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zipOut = new ZipOutputStream(baos)) {
            
            // Add photos
            List<Photos> photos = photoRepository.findByFriendId(friendId);
            for (Photos photo : photos) {
                addToZip(zipOut, "photos/" + photo.getPhotoName(), getPhotoData(photo));
            }
            
            // Add videos
            List<Videos> videos = videoRepository.findByFriendId(friendId);
            for (Videos video : videos) {
                addToZip(zipOut, "videos/" + video.getVideoName(), getVideoData(video));
            }
            
            // Add resources
            List<PersonalResource> resources = resourceRepository.findByFriendId(friendId);
            for (PersonalResource resource : resources) {
                addToZip(zipOut, "documents/" + resource.getResourceName(), getResourceData(resource));
            }
            
            zipOut.close();
            return baos.toByteArray();
            
        } catch (IOException e) {
            throw new RuntimeException("ZIP creation failed", e);
        }
    }

    public byte[] getPhotoData(Photos photo) {
        return null; // to be implemented
    }

    public byte[] getVideoData(Videos videos) {
        return null; // to be implemented
    }
    public byte[] getResourceData(PersonalResource resource) {
        return null; // to be implemented
    }
    
    private void addToZip(ZipOutputStream zipOut, String fileName, byte[] content) throws IOException {
        ZipEntry zipEntry = new ZipEntry(fileName);
        zipOut.putNextEntry(zipEntry);
        zipOut.write(content);
        zipOut.closeEntry();
    }
}
