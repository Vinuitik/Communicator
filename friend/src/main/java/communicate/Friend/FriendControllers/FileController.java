package communicate.Friend.FriendControllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendService.FileService;


@Controller
@RequestMapping("/files")
public class FileController {
    
    @Autowired
    private FileService fileService;
    
    // Serve photos
    @GetMapping("/photo/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Integer id) {
        Photos photo = fileService.getPhoto(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(photo.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(photo.getPhotoName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(photo.getImageData());
    }

    @GetMapping("/video/{id}")
    public ResponseEntity<byte[]> getVideo(@PathVariable Integer id) {
        Videos photo = fileService.getVideo(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(photo.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(photo.getVideoName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(photo.getVideoData());
    }
    
    // Serve PDFs
    @GetMapping("/resource/{id}")
    public ResponseEntity<byte[]> getResource(@PathVariable Integer id) {
        PersonalResource resource = fileService.getResource(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(resource.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(resource.getResourceName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(resource.getResourceData());
    }

    @GetMapping("/all/{friendId}")
    public ResponseEntity<byte[]> downloadAllResourcesAsZip(@PathVariable Integer friendId) {
        byte[] zipData = fileService.createCompressedZipForFriend(friendId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.valueOf("application/zip"));
        String filename = "friend_" + friendId + "_resources.zip";
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(zipData.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(zipData);
    }
}
