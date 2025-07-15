package communicate.Friend.FriendControllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendService.FileMetaDataReadService;
import communicate.Friend.FriendService.FileWriteService;
import lombok.RequiredArgsConstructor;


@Controller
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {
    
    
    private final FileMetaDataReadService fileReadService;
    private final FileWriteService fileWriteService;

    // in future implement an endpoint to be returning pages for profile page


    @PostMapping("/upload")
    @ResponseBody
    public ResponseEntity<Map<String, String>> uploadFiles(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("friendId") Integer friendId) {
        
        Map<String, String> response = new HashMap<>();
        
        try {
            fileWriteService.saveFiles(files, friendId);
            response.put("message", "Files uploaded successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", "Error uploading files: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
