package com.communicator.meeting.entities;

/** Outcome of a logged CONNECTION meeting — only ever set on CONNECTION-subject rows. */
public enum ConnectionOutcome {
    WENT_WELL,
    NEUTRAL,
    TENSE,
}
