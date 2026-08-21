package com.communicator.meeting.dtos;

import java.time.LocalDate;

/**
 * Create a user-scheduled MANUAL meeting. Exactly one of friendId/groupId/(connectionFriend1Id +
 * connectionFriend2Id) must be set — validated in GroupMeetingService, same "exactly one subject"
 * rule as Meeting itself. Group meetings get their MeetingAttendee roster auto-filled from
 * GroupMember at creation time; a Connection meeting gets its 2 attendee rows (selfAttending=false)
 * filled from the two friend ids, same pattern MeetingBackfillRunner uses for legacy rows.
 * connectionFriend1Id/connectionFriend2Id must both be set together (order doesn't matter — the
 * service normalizes to (min, max) before looking up the tracked Connection, 404 if untracked).
 */
public record ManualMeetingRequest(
    Integer friendId, Integer groupId, Long connectionFriend1Id, Long connectionFriend2Id,
    LocalDate date, String note) {
}
