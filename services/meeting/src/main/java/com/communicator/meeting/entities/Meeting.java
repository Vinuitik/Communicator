package com.communicator.meeting.entities;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import com.example.demo.Group.GroupEntities.SocialGroup;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;

import communicate.Friend.FriendEntities.Friend;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A scheduled or logged contact. Real @ManyToOne FKs, not a polymorphic
 * subject_type/subject_id pair — this module is the one place in the app
 * allowed to depend on friend/group/connections simultaneously (see
 * meeting/pom.xml's module-level comment); those three never depend on
 * this module or each other, so anything on their side that needs to react
 * to a Meeting change goes through a Spring application event instead of a
 * direct call (see FriendRescheduledEvent in the friend module).
 *
 * <p>The source of truth for "who this meeting is about" is the attendee list
 * ({@code MeetingAttendee}, via {@code MeetingAttendeeRepository.findByMeetingId})
 * plus {@link #selfAttending}, NOT these FK fields directly — {@link MeetingTypeDeriver}
 * computes FRIEND/GROUP/CONNECTION from (selfAttending, attendee count), and
 * {@code MeetingEditService} keeps friend/group/connection in sync with that derived type
 * purely as query-acceleration + backward-compat for every repository finder and DTO already
 * written against them. At most one of friend/group/connection is set — enforced in
 * {@link #validateAtMostOneSubject()} — but for an ad-hoc GROUP meeting (2+ attendees that
 * didn't match an existing SocialGroup closely enough, see GroupMatchingService) NONE of the
 * three may be set; the attendee list + selfAttending is still authoritative in that case.
 */
@Entity
@Table(name = "meeting")
@Getter
@Setter
@NoArgsConstructor
public class Meeting {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "friend_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Friend friend;

    @ManyToOne
    @JoinColumn(name = "group_id")
    private SocialGroup group;

    // Connection's PK is the composite ConnectionId(friend1Id, friend2Id) —
    // no surrogate id — so its FK is two columns, not one.
    @ManyToOne
    @JoinColumns({
        @JoinColumn(name = "connection_friend1_id", referencedColumnName = "friend1Id"),
        @JoinColumn(name = "connection_friend2_id", referencedColumnName = "friend2Id"),
    })
    private Connection connection;

    @Column(nullable = false)
    private LocalDate date;

    /** Optional time-of-day — CalendarBoard is day-columns only today, no hour grid, so this is
     * set/edited via the edit modal's time field, not drag-and-drop. */
    private LocalTime time;

    /** Optional free-text location. */
    private String location;

    /** Whether "I" (the single app user, never a Friend row myself) am on this meeting.
     * Default true. Drives MeetingTypeDeriver: self+1 attendee=FRIEND, self+2+=GROUP,
     * no-self+2=CONNECTION, no-self+3+=GROUP.
     *
     * <p>columnDefinition (not just a Java-side default) is required here: ddl-auto=update adds
     * this column to an already-populated `meeting` table, and a primitive boolean field reading
     * a NULL column throws on unboxing — the DB-level default backfills every existing row to
     * true at ALTER-time (correct for existing FSRS_PROPOSED/BIRTHDAY/MANUAL-friend rows, which
     * were always "I attended" before this field existed; MeetingBackfillRunner separately fixes
     * up the CONNECTION rows, which need false, not true). */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean selfAttending = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeetingSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeetingStatus status = MeetingStatus.PROPOSED;

    @Lob
    private String note;

    // Only ever set on CONNECTION-subject rows (date + outcome + optional note is the
    // whole log form for Connections — no duration/attendee batch, see the plan's
    // Feature B "CONNECTION meetings use a distinct lighter log form" section). Nullable
    // and unused by Friend/Group rows, same optional-use pattern as `note`.
    @Enumerated(EnumType.STRING)
    private ConnectionOutcome outcome;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    private void validateAtMostOneSubject() {
        int subjectCount = (friend != null ? 1 : 0) + (group != null ? 1 : 0) + (connection != null ? 1 : 0);
        if (subjectCount > 1) {
            throw new IllegalStateException(
                "Meeting must have at most one subject FK (friend/group/connection), had " + subjectCount);
        }
    }
}
