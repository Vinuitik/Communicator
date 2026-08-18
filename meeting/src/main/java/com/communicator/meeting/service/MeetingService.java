package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendRescheduledEvent;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Owns the FSRS_PROPOSED and BIRTHDAY Meeting rows. MANUAL rows (user-created
 * "schedule a meeting") and the Group batch-log / Connection outcome-log
 * flows are separate, later-stage services in this module — this class is
 * just the two auto-managed sources.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final FriendService friendService;

    /**
     * Runs after the publishing transaction (OutboxWriteService's
     * applyTalkedToFriend/applyAddFriend) commits — the friend module has no
     * idea this listener exists, it just publishes FriendRescheduledEvent.
     * Deliberately AFTER_COMMIT, not a plain @EventListener: a failure here
     * upserting the Meeting row should never roll back the friend's own save.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFriendRescheduled(FriendRescheduledEvent event) {
        try {
            upsertFsrsProposed(event.friendId(), event.dueDate());
        } catch (Exception e) {
            log.error("Failed to upsert FSRS_PROPOSED meeting for friend {}", event.friendId(), e);
        }
        // Piggybacks on the same event rather than a dedicated "friend saved" one — covers
        // new-friend-added and chat-logged saves immediately. KNOWN GAP: editing only
        // dateOfBirth on an existing friend (no analytics logged in the same request) won't
        // fire this event, so that case waits for BirthdayMeetingScheduler's nightly pass
        // instead of updating immediately. Acceptable for now; revisit if it's annoying.
        try {
            Friend friend = friendService.getFriendById(event.friendId());
            if (friend != null) {
                ensureBirthdayMeeting(friend);
            }
        } catch (Exception e) {
            log.error("Failed to ensure birthday meeting for friend {}", event.friendId(), e);
        }
    }

    /**
     * One friend has at most one live (non-terminal) FSRS_PROPOSED row —
     * update its date if it exists, create it otherwise. Same semantics as
     * the old Friend.plannedSpeakingTime field, just relocated.
     */
    public Meeting upsertFsrsProposed(Integer friendId, LocalDate dueDate) {
        Optional<Meeting> existing = meetingRepository
            .findByFriendIdAndSourceAndStatus(friendId, MeetingSource.FSRS_PROPOSED, MeetingStatus.PROPOSED);

        Meeting meeting = existing.orElseGet(Meeting::new);
        if (existing.isEmpty()) {
            Friend friend = friendService.getFriendById(friendId);
            meeting.setFriend(friend);
            meeting.setSource(MeetingSource.FSRS_PROPOSED);
            meeting.setStatus(MeetingStatus.PROPOSED);
        }
        meeting.setDate(dueDate);
        return meetingRepository.save(meeting);
    }

    /**
     * Ensures exactly one upcoming BIRTHDAY row exists for a friend with a
     * dateOfBirth — called both on friend save (immediate row) and nightly
     * (rolls to next year once the current one passes). Both callers hit
     * this same method, no duplicated logic.
     */
    public void ensureBirthdayMeeting(Friend friend) {
        if (friend.getDateOfBirth() == null) {
            return;
        }
        LocalDate nextBirthday = nextOccurrence(friend.getDateOfBirth(), LocalDate.now());

        Optional<Meeting> existing = meetingRepository
            .findByFriendIdAndSource(friend.getId(), MeetingSource.BIRTHDAY);

        Meeting meeting = existing.orElseGet(Meeting::new);
        if (existing.isEmpty()) {
            meeting.setFriend(friend);
            meeting.setSource(MeetingSource.BIRTHDAY);
            meeting.setStatus(MeetingStatus.PROPOSED);
        }
        // Roll forward once the stored date has passed (nightly catch-up); a
        // freshly-created row is already next year's if today's birthday.
        if (meeting.getDate() == null || meeting.getDate().isBefore(LocalDate.now())) {
            meeting.setDate(nextBirthday);
        }
        meetingRepository.save(meeting);
    }

    /** Next calendar occurrence of a birthday on/after `from` (handles Feb 29 by clamping to Feb 28
     * in non-leap years, same as java.time's own leap-day rollover behavior for plusYears). */
    static LocalDate nextOccurrence(LocalDate dateOfBirth, LocalDate from) {
        LocalDate thisYear = dateOfBirth.withYear(from.getYear());
        return thisYear.isBefore(from) ? dateOfBirth.withYear(from.getYear() + 1) : thisYear;
    }
}
