package communicate.Friend.FriendControllers;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClient;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.PersonalResource;
import communicate.Friend.FriendEntities.Photos;
import communicate.Friend.FriendEntities.Videos;
import communicate.Friend.FriendService.FileWriteService;
import communicate.Friend.FriendService.FriendService;

@RestController
@RequiredArgsConstructor
@RequestMapping("/media")
public class MediaController {

    private final WebClient webClient;
    private final FileWriteService fileWriteService;
    private final FriendService friendService;

    @PostMapping(value = "/upload")
    public ResponseEntity<String> uploadFiles(@RequestParam("files") List<MultipartFile> files,
                                              @RequestParam("friendId") Integer friendId) {
                                                
        if(!friendService.exists(friendId)){
            return ResponseEntity.badRequest().body("Friend not found with id: " + friendId);
        }

        fileWriteService.saveFiles(files, friendId);

        return ResponseEntity.ok("Files uploaded successfully for friend with id: " + friendId);
    }
    
}
