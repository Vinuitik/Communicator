package com.communicator.meeting.dtos;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Body for PATCH /meetings/{id} — the one unified edit surface (replaces separate Friend/Group/
 * Connection forms). attendeeFriendIds + selfAttending are the source of truth the meeting's type
 * is re-derived from on every save (MeetingTypeDeriver); date/time/location are plain field edits.
 *
 * <p>Group-matching override, only meaningful when the derived type is GROUP:
 * - Both null -> auto-match via GroupMatchingService (the default).
 * - groupId set -> use that existing group explicitly, skip auto-match.
 * - newGroupName set -> create a new SocialGroup with this name + these attendees as its roster,
 *   link the meeting to it. At most one of groupId/newGroupName may be set.
 */
public record UpdateMeetingRequest(
    LocalDate date,
    LocalTime time,
    String location,
    List<Integer> attendeeFriendIds,
    boolean selfAttending,
    Integer groupId,
    String newGroupName
) {
}
