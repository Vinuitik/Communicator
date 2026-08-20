package com.communicator.meeting.service;

import com.communicator.meeting.entities.MeetingType;

/**
 * Pure function: meeting type is derived from who's on it, never picked explicitly.
 *
 * <pre>
 * self + 1 other   -> FRIEND
 * self + 2+ others -> GROUP
 * no-self + 2      -> CONNECTION (that pair)
 * no-self + 3+     -> GROUP (I just wasn't there)
 * </pre>
 *
 * no-self + 0-1 attendees is invalid (nothing to derive a type from) — callers must reject it
 * before reaching here, see MeetingEditService.
 */
public final class MeetingTypeDeriver {

    private MeetingTypeDeriver() {
    }

    public static MeetingType derive(boolean selfAttending, int attendeeCount) {
        if (selfAttending) {
            return attendeeCount <= 1 ? MeetingType.FRIEND : MeetingType.GROUP;
        }
        return attendeeCount == 2 ? MeetingType.CONNECTION : MeetingType.GROUP;
    }
}
