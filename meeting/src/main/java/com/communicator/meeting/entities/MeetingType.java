package com.communicator.meeting.entities;

/**
 * Derived (never stored) label for who a Meeting is about — computed from
 * (selfAttending, attendee count) by {@link MeetingTypeDeriver}, not picked explicitly.
 */
public enum MeetingType {
    FRIEND,
    GROUP,
    CONNECTION,
}
