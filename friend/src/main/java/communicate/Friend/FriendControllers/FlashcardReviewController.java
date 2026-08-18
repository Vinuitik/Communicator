package communicate.Friend.FriendControllers;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.DTOs.FlashcardCardDTO;
import communicate.Friend.DTOs.FlashcardFolderDTO;
import communicate.Friend.FriendEntities.FlashcardReviewSettings;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FlashcardEnrollmentService;
import communicate.Friend.FriendService.FlashcardReviewService;
import communicate.Friend.FriendService.FlashcardReviewSettingsService;
import communicate.Friend.FriendService.FsrsService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Flashcard-review feature (design doc "Feature D") — star toggle, queue/
 * folder browsing, grading, and the settings that drive the nightly
 * spread/bankruptcy jobs. No auth, same as every other friend/** endpoint.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/flashcards")
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT})
public class FlashcardReviewController {

    private final FlashcardEnrollmentService enrollmentService;
    private final FlashcardReviewService reviewService;
    private final FlashcardReviewSettingsService settingsService;

    @PutMapping("/friends/{friendId}/star")
    public ResponseEntity<?> setStarred(@PathVariable Integer friendId, @RequestBody Map<String, Boolean> body) {
        Boolean enabled = body.get("enabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "\"enabled\" is required."));
        }
        try {
            Friend friend = enrollmentService.setFlashcardsEnabled(friendId, enabled);
            return ResponseEntity.ok(Map.of("friendId", friend.getId(), "flashcardsEnabled", friend.getFlashcardsEnabled()));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/folders")
    public List<FlashcardFolderDTO> getFolders() {
        return reviewService.getFolders();
    }

    @GetMapping("/queue")
    public List<FlashcardCardDTO> getTodayQueue() {
        return reviewService.getTodayQueue();
    }

    @GetMapping("/folders/{friendId}")
    public List<FlashcardCardDTO> getFolder(@PathVariable Integer friendId) {
        return reviewService.getFolder(friendId);
    }

    @PostMapping("/{reviewId}/grade")
    public ResponseEntity<?> grade(@PathVariable Integer reviewId, @RequestBody Map<String, Integer> body) {
        Integer grade = body.get("grade");
        if (grade == null || grade < FsrsService.GRADE_HARD || grade > FsrsService.GRADE_EASY) {
            return ResponseEntity.badRequest().body(Map.of("message", "\"grade\" must be 2 (Hard), 3 (Good) or 4 (Easy)."));
        }
        try {
            return ResponseEntity.ok(reviewService.gradeCard(reviewId, grade));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/settings")
    public FlashcardReviewSettings getSettings() {
        return settingsService.get();
    }

    @PutMapping("/settings")
    public FlashcardReviewSettings updateSettings(@RequestBody FlashcardReviewSettings payload) {
        return settingsService.update(payload.getMaxDailyReviews(), payload.getChronicNeglectDays(), payload.getBankruptcyLimit());
    }
}
