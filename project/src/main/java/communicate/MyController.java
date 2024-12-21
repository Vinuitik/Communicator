package communicate;

import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.List;

//import org.bson.Document;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;


@RestController
@RequiredArgsConstructor
@CrossOrigin
public class MyController {

    private final FriendService service;
    
    @GetMapping("allFriends")
    public List<Friend> getAllFriends() {
        List<Friend> result = service.getAllFriends();
        return result;
    }

    @GetMapping("thisWeek")
    public List<Friend> getWeekFriends() {
        List<Friend> result = service.findThisWeek();
        return result;
    }

    @PostMapping("/addFriend")
    public ResponseEntity<String> addFriend(@Valid @RequestBody Friend friend) {
        try {
            service.save(friend);
            //System.out.println(friend.getName() +"  "+ friend.getExperience() +"  "+ friend.getDateOfBirth().toString() +"  "+ friend.getLastTimeSpoken().toString());
            return ResponseEntity.status(HttpStatus.CREATED).body("Friend added successfully!");
        } catch (Exception e) {
            System.err.println("Error adding friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while adding the friend.");
        }
    }

    @DeleteMapping("/deleteFriend/{id}")
    public ResponseEntity<String> deleteFriend(@PathVariable Integer id) {
        try {
            // Attempt to delete the friend by ID
            //int idInt = Integer.parseInt(id);
            service.deleteFriendById(id);

            return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Friend deleted successfully!");
            
        } catch (Exception e) {
            System.err.println("Error deleting friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the friend.");
        }
    }



}
