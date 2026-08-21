package com.communicator.meeting.dtos;

/** One candidate SocialGroup match for a meeting's attendee set, with its Jaccard score. */
public record GroupMatchDTO(Integer groupId, String groupName, double score, int groupSize) {
}
