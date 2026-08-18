package communicate.Friend.DTOs;

import java.time.LocalDate;

/**
 * One flashcard shown to the review UI — resolves the underlying
 * FriendKnowledge/GroupKnowledge fact text server-side so the frontend
 * never needs to know about the two source tables. See
 * FlashcardReviewService.toDto.
 */
public record FlashcardCardDTO(
    Integer reviewId,
    Integer friendId,
    String friendName,
    String sourceType,
    Integer sourceKnowledgeId,
    String fact,
    Long importance,
    Double fsrsStability,
    Double fsrsDifficulty,
    LocalDate lastReviewedDate,
    LocalDate dueDate
) {
}
