package communicate.Friend.FriendControllers;

import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.SocialDTO;
import communicate.Friend.FriendEntities.Social;
import communicate.Friend.FriendService.SocialService;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.PutMapping;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
public class SocialController {
    
    private final SocialService socialService;

    /**
     * Get all social media links for a specific friend
     * @param friendId the ID of the friend
     * @return list of social media links
     */
    @GetMapping("/socials/{friendId}")
    public ResponseEntity<List<Social>> getFriendSocials(@PathVariable Integer friendId) {
        try {
            List<Social> socials = socialService.getSocialsByFriendId(friendId);
            return ResponseEntity.ok(socials);
        } catch (IllegalArgumentException e) {
            // Friend not found
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Create a new social media link for a friend
     * @param friendId the ID of the friend
     * @param socialDTO the social media data
     * @return the created social media link
     */
    @PostMapping("/socials/{friendId}")
    public ResponseEntity<Social> createSocial(@PathVariable Integer friendId, @RequestBody SocialDTO socialDTO) {
        try {
            Social createdSocial = socialService.createSocial(friendId, socialDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdSocial);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Update an existing social media link
     * @param socialId the ID of the social media link
     * @param socialDTO the updated social media data
     * @return the updated social media link
     */
    @PutMapping("/socials/update/{socialId}")
    public ResponseEntity<Social> updateSocial(@PathVariable Integer socialId, @RequestBody SocialDTO socialDTO) {
        try {
            Social updatedSocial = socialService.updateSocial(socialId, socialDTO);
            return ResponseEntity.ok(updatedSocial);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Delete a social media link
     * @param socialId the ID of the social media link to delete
     * @return success status
     */
    @DeleteMapping("/socials/delete/{socialId}")
    public ResponseEntity<Void> deleteSocial(@PathVariable Integer socialId) {
        try {
            socialService.deleteSocial(socialId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
