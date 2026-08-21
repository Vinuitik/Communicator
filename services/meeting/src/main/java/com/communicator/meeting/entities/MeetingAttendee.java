package com.communicator.meeting.entities;

import communicate.Friend.FriendEntities.Friend;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row per (Meeting, attendee) pair. Originally Group-batch-log-only; generalized to every
 * Meeting so the meeting-edit flow can derive its type (FRIEND/GROUP/CONNECTION, see
 * MeetingType/MeetingTypeDeriver) from who's actually on it instead of that being picked
 * explicitly. For a Group meeting this is still pre-filled from GroupMember when auto-created,
 * editable (presence toggle) before the meeting is marked DONE; for Friend/Connection meetings
 * it's just the 1 (or 2, no-self) attendees implied by that meeting's type.
 */
@Entity
@Table(name = "meeting_attendee", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"meeting_id", "friend_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class MeetingAttendee {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @ManyToOne
    @JoinColumn(name = "friend_id", nullable = false)
    private Friend friend;

    /** Toggled off in the batch-log modal's presence step; true by default (pre-filled present). */
    private boolean present = true;

    public MeetingAttendee(Meeting meeting, Friend friend) {
        this.meeting = meeting;
        this.friend = friend;
    }
}
