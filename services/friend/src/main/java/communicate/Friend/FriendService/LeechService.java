package communicate.Friend.FriendService;

import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.Friend;

/**
 * Leech-flagging (design doc's "coolest unconsidered version" from the
 * independent second opinion): Anki flags flashcards you keep failing
 * despite review as structurally broken ("leeches"). The relationship
 * analogue — a friend whose actual contact behavior keeps missing the
 * predicted due date isn't just rescheduled again, it's flagged as drifting
 * regardless of what interval gets picked. Deliberately just "a counter and
 * a threshold" per the design doc's own sizing of this piece — no new math,
 * reuses the miss/hit signal ReviewService and FsrsNeglectService already
 * compute.
 */
@Service
public class LeechService {

    /** Consecutive missed due dates before a friend is flagged. Starting guess, TBD, retune with data. */
    public static final int LEECH_THRESHOLD = 3;

    public void recordMiss(Friend friend) {
        int count = (friend.getMissedDueCount() == null ? 0 : friend.getMissedDueCount()) + 1;
        friend.setMissedDueCount(count);
        friend.setLeech(count >= LEECH_THRESHOLD);
    }

    public void recordHit(Friend friend) {
        friend.setMissedDueCount(0);
        friend.setLeech(false);
    }
}
