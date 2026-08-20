package com.communicator.meeting.dtos;

import com.communicator.meeting.entities.MeetingAttendee;

public record AttendeeDTO(Long id, Integer friendId, String friendName, boolean present) {
    public static AttendeeDTO from(MeetingAttendee a) {
        return new AttendeeDTO(a.getId(), a.getFriend().getId(), a.getFriend().getName(), a.isPresent());
    }
}
