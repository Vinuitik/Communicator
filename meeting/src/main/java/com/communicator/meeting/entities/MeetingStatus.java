package com.communicator.meeting.entities;

/**
 * No CONFIRMED state — single-user local app, nothing else to confirm with.
 * PROPOSED only ever applies to FSRS_PROPOSED rows; MANUAL/BIRTHDAY/GROUP
 * rows are effectively final the moment they're created.
 */
public enum MeetingStatus {
    PROPOSED,
    DONE,
    CANCELLED,
}
