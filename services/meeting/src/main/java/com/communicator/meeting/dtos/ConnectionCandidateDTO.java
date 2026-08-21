package com.communicator.meeting.dtos;

/** One present-attendee pair from a just-completed group meeting that already has a tracked Connection. */
public record ConnectionCandidateDTO(Long friend1Id, String friend1Name, Long friend2Id, String friend2Name) {
}
