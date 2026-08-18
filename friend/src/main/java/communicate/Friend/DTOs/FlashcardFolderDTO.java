package communicate.Friend.DTOs;

/** One row in the flashcard review page's "folders" list — one per starred friend. */
public record FlashcardFolderDTO(
    Integer friendId,
    String friendName,
    long dueCount,
    long totalCount
) {
}
