package com.communicator.meeting.entities;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
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
 * A scheduled or logged contact with exactly one subject — a Friend, a
 * SocialGroup, or a Connection. Real @ManyToOne FKs, not a polymorphic
 * subject_type/subject_id pair — this module is the one place in the app
 * allowed to depend on friend/group/connections simultaneously (see
 * meeting/pom.xml's module-level comment); those three never depend on
 * this module or each other, so anything on their side that needs to react
 * to a Meeting change goes through a Spring application event instead of a
 * direct call (see FriendRescheduledEvent in the friend module).
 *
 * Exactly one of friend/group/connection must be set — enforced in
 * {@link #validateExactlyOneSubject()}, not a DB CHECK constraint (this repo
 * has no migration tooling beyond Hibernate ddl-auto: update).
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
    private void validateExactlyOneSubject() {
        int subjectCount = (friend != null ? 1 : 0) + (group != null ? 1 : 0) + (connection != null ? 1 : 0);
        if (subjectCount != 1) {
            throw new IllegalStateException(
                "Meeting must have exactly one subject (friend/group/connection), had " + subjectCount);
        }
    }
}
