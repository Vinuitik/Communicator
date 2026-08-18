package communicate.Friend.FriendService;

import java.time.LocalDate;

/**
 * Published whenever ReviewService computes a new due date for a friend
 * (via OutboxWriteService). The friend module has no dependency on the
 * meeting module — it doesn't know a Meeting row exists — so this is how
 * the meeting module's listener finds out a re-schedule happened, without
 * a direct call in either direction being possible (meeting depends on
 * friend for its @ManyToOne FKs, so friend calling into meeting would be
 * circular).
 */
public record FriendRescheduledEvent(Integer friendId, LocalDate dueDate) {
}
