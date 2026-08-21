package com.communicator.meeting.dtos;

import java.time.LocalDate;

import com.communicator.meeting.entities.ConnectionOutcome;

/**
 * Log a CONNECTION meeting — lighter than Friend/Group's manual form (no duration, no
 * attendee batch; Connection is a fixed friend1/friend2 pair by schema, nothing to
 * batch over). Logged as already-happened (date + outcome + optional note), not
 * scheduled — see ConnectionMeetingService.
 */
public record ConnectionMeetingRequest(
    Long friend1Id, Long friend2Id, LocalDate date, ConnectionOutcome outcome, String note) {
}
