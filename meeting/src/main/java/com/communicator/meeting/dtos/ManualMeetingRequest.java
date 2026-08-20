package com.communicator.meeting.dtos;

import java.time.LocalDate;

/**
 * Create a user-scheduled MANUAL meeting. Exactly one of friendId/groupId must be set — validated
 * in GroupMeetingService, same "exactly one subject" rule as Meeting itself. Group meetings get
 * their MeetingAttendee roster auto-filled from GroupMember at creation time.
 */
public record ManualMeetingRequest(Integer friendId, Integer groupId, LocalDate date, String note) {
}
