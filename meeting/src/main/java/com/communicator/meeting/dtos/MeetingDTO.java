package com.communicator.meeting.dtos;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import com.communicator.meeting.entities.ConnectionOutcome;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.entities.MeetingType;
import com.communicator.meeting.service.MeetingTypeDeriver;

/**
 * Flat read view of a Meeting. friendId/groupId/connection ids are populated when the derived
 * {@link #type} resolved to a real FK (see Meeting's class javadoc) — an ad-hoc GROUP meeting
 * (no matched SocialGroup) has groupId null despite type=GROUP, so callers must branch on `type`,
 * not on which id is non-null, for GROUP vs unlinked-ad-hoc-group rendering.
 */
public record MeetingDTO(
    Long id,
    MeetingType type,
    Integer friendId,
    String friendName,
    Integer groupId,
    String groupName,
    Long connectionFriend1Id,
    Long connectionFriend2Id,
    LocalDate date,
    LocalTime time,
    String location,
    boolean selfAttending,
    List<AttendeeDTO> attendees,
    MeetingSource source,
    MeetingStatus status,
    String note,
    ConnectionOutcome outcome
) {
    public static MeetingDTO from(Meeting m, List<MeetingAttendee> attendees) {
        MeetingType type = MeetingTypeDeriver.derive(m.isSelfAttending(), attendees.size());
        return new MeetingDTO(
            m.getId(),
            type,
            m.getFriend() != null ? m.getFriend().getId() : null,
            m.getFriend() != null ? m.getFriend().getName() : null,
            m.getGroup() != null ? m.getGroup().getId() : null,
            m.getGroup() != null ? m.getGroup().getName() : null,
            m.getConnection() != null ? m.getConnection().getId().getFriend1Id() : null,
            m.getConnection() != null ? m.getConnection().getId().getFriend2Id() : null,
            m.getDate(),
            m.getTime(),
            m.getLocation(),
            m.isSelfAttending(),
            attendees.stream().map(AttendeeDTO::from).toList(),
            m.getSource(),
            m.getStatus(),
            m.getNote(),
            m.getOutcome()
        );
    }
}
