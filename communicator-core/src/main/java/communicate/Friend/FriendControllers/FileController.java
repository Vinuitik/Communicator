package communicate.Friend.FriendControllers;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import communicate.Friend.DTOs.PaginationDTO;
import communicate.Friend.FriendService.FileWriteService;
import communicate.Friend.FriendService.PaginationLogicService;
import lombok.RequiredArgsConstructor;


@Controller
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {
    
    
    private final FileWriteService fileWriteService;
    private final PaginationLogicService paginationLogicService;

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
    @PostMapping("/delete")
    @ResponseBody
    public ResponseEntity<Map<String, String>> deleteFiles(
            @RequestParam("photos") List<Integer> photoIds,
            @RequestParam("videos") List<Integer> videoIds,
            @RequestParam("resources") List<Integer> recourceIds,
            @RequestParam("friendId") Integer friendId) {
        
        Map<String, String> response = new HashMap<>();
        
        try {
            fileWriteService.deleteFiles(photoIds, videoIds, recourceIds, friendId);
            response.put("message", "Files uploaded successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", "Error uploading files: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @GetMapping("/{friendId}/page/{pageId}")
    @ResponseBody
    public PaginationDTO getFileUploadPage(@PathVariable("pageId") Integer pageId, @PathVariable("friendId") Integer friendId) {
        PaginationDTO paginationData = paginationLogicService.getPaginationData(pageId, friendId);
        return paginationData;
    }

}
