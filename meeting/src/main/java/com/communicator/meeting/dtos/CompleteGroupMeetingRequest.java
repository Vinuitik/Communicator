package com.communicator.meeting.dtos;

import java.util.List;

public record CompleteGroupMeetingRequest(List<AttendeeLog> attendees) {

    /**
     * One row per attendee. present=false drops them from this pass (their FSRS state, and the
     * meeting_attendee row itself, is left untouched). durationHours/experience/inPerson are only
     * read when present=true — same grading inputs ReviewService.reviewInteraction already takes
     * for a 1:1 QuickLogModal save.
     */
    public record AttendeeLog(Integer friendId, boolean present, Double durationHours, String experience, Boolean inPerson) {
    }
}
