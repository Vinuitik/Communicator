package communicate.Friend.FriendControllers;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendService.FileReadService;
import communicate.Friend.FriendService.FileWriteService;
import lombok.RequiredArgsConstructor;


@Controller
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {
    
    
    private final FileReadService fileReadService;
    private final FileWriteService fileWriteService;


    
    // Serve photos
    @GetMapping("/photo/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Integer id) {
        Photos photo = fileReadService.getPhoto(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(photo.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(photo.getPhotoName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(fileReadService.getPhotoData(photo));
    }

    @GetMapping("/video/{id}")
    public ResponseEntity<byte[]> getVideo(@PathVariable Integer id) {
        Videos video = fileReadService.getVideo(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(video.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(video.getVideoName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(fileReadService.getVideoData(video));
    }
    
    // Serve PDFs
    @GetMapping("/resource/{id}")
    public ResponseEntity<byte[]> getResource(@PathVariable Integer id) {
        PersonalResource resource = fileReadService.getResource(id);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(resource.getMimeType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(resource.getResourceName()).build());
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(fileReadService.getResourceData(resource));
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadFiles(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("friendId") Integer friendId) {
        
        try {
            fileWriteService.saveFiles(files, friendId);
            return ResponseEntity.ok("Files uploaded successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Error uploading files: " + e.getMessage());
        }
    }
}
