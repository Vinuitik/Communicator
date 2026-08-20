package com.communicator.meeting.dtos;

import java.time.LocalDate;

import com.communicator.meeting.entities.ConnectionOutcome;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;

/** Flat read view of a Meeting — one of friendId/groupId/connection ids is set, matching the entity. */
public record MeetingDTO(
    Long id,
    Integer friendId,
    String friendName,
    Integer groupId,
    String groupName,
    Long connectionFriend1Id,
    Long connectionFriend2Id,
    LocalDate date,
    MeetingSource source,
    MeetingStatus status,
    String note,
    ConnectionOutcome outcome
) {
    public static MeetingDTO from(Meeting m) {
        return new MeetingDTO(
            m.getId(),
            m.getFriend() != null ? m.getFriend().getId() : null,
            m.getFriend() != null ? m.getFriend().getName() : null,
            m.getGroup() != null ? m.getGroup().getId() : null,
            m.getGroup() != null ? m.getGroup().getName() : null,
            m.getConnection() != null ? m.getConnection().getId().getFriend1Id() : null,
            m.getConnection() != null ? m.getConnection().getId().getFriend2Id() : null,
            m.getDate(),
            m.getSource(),
            m.getStatus(),
            m.getNote(),
            m.getOutcome()
        );
    }
}
