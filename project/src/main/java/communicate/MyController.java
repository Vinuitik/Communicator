package communicate;

import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;

import org.bson.Document;
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

    private final MongoDB db;
    
    @GetMapping("allFriends")
    public ArrayList<Document> getAllFriends() {
        ArrayList<Document> result = new ArrayList<>();
        result = db.findAll();
        return result;
    }

    @GetMapping("thisWeek")
    public ArrayList<Document> getWeekFriends() {
        ArrayList<Document> result = new ArrayList<>();
        result = db.findThisWeek();
        return result;
    }

    @PostMapping("/addFriend")
    public ResponseEntity<String> addFriend(@Valid @RequestBody Friend friend) {
        try {
            db.insertFriend(friend);
            //System.out.println(friend.getName() +"  "+ friend.getExperience() +"  "+ friend.getDateOfBirth().toString() +"  "+ friend.getLastTimeSpoken().toString());
            return ResponseEntity.status(HttpStatus.CREATED).body("Friend added successfully!");
        } catch (Exception e) {
            System.err.println("Error adding friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while adding the friend.");
        }
    }

    @DeleteMapping("/deleteFriend/{id}")
    public ResponseEntity<String> deleteFriend(@PathVariable String id) {
        try {
            // Attempt to delete the friend by ID
            boolean isDeleted = db.deleteFriendById(id);
            
            if (isDeleted) {
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body("Friend deleted successfully!");
            } else {
                // If no friend was found with the given ID
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Friend not found.");
            }
            
        } catch (Exception e) {
            System.err.println("Error deleting friend: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred while deleting the friend.");
        }
    }



}
