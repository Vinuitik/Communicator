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
 * One row per (Group Meeting, attendee) pair — the batch-log target list.
 * Only ever attached to a Meeting whose subject is a group; pre-filled from
 * GroupMember when the meeting is created, editable (presence toggle) before
 * the meeting is marked DONE.
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
