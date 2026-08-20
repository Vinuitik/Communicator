package com.communicator.meeting.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.GroupMatchDTO;
import com.communicator.meeting.dtos.UpdateMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.entities.MeetingType;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.GroupMemberService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * The one unified edit surface for a Meeting — replaces the separate Friend/Group/Connection
 * create forms with a single attendee-list + selfAttending edit that re-derives the meeting's
 * type on every save (MeetingTypeDeriver), resolving friend/group/connection FKs to match.
 */
@Service
@RequiredArgsConstructor
public class MeetingEditService {

    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository attendeeRepository;
    private final FriendService friendService;
    private final SocialGroupRepository groupRepository;
    private final GroupMemberService groupMemberService;
    private final ConnectionRepository connectionRepository;
    private final GroupMatchingService groupMatchingService;

    @Transactional
    public Meeting updateMeeting(Long meetingId, UpdateMeetingRequest request) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new EntityNotFoundException("Meeting not found: " + meetingId));

        List<Integer> attendeeIds = request.attendeeFriendIds() != null ? request.attendeeFriendIds() : List.of();
        int otherCount = attendeeIds.size();
        if (otherCount < 1) {
            throw new IllegalArgumentException("A meeting needs at least one other attendee besides yourself");
        }
        if (!request.selfAttending() && otherCount < 2) {
            throw new IllegalArgumentException("A meeting you're not attending needs at least 2 attendees");
        }
        if (request.groupId() != null && request.newGroupName() != null) {
            throw new IllegalArgumentException("At most one of groupId/newGroupName may be set");
        }

        replaceAttendees(meeting, attendeeIds);
        meeting.setSelfAttending(request.selfAttending());
        meeting.setDate(request.date());
        meeting.setTime(request.time());
        meeting.setLocation(request.location());

        MeetingType type = MeetingTypeDeriver.derive(request.selfAttending(), otherCount);
        resolveSubjectForType(meeting, type, attendeeIds, request);

        return meetingRepository.save(meeting);
    }

    @Transactional
    public Meeting cancelMeeting(Long meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new EntityNotFoundException("Meeting not found: " + meetingId));
        meeting.setStatus(MeetingStatus.CANCELLED);
        return meetingRepository.save(meeting);
    }

    /** Live preview for the edit modal — which group would this attendee set resolve to, without saving. */
    public List<GroupMatchDTO> previewGroupMatch(Set<Integer> attendeeFriendIds) {
        return groupMatchingService.findCandidates(attendeeFriendIds);
    }

    private void replaceAttendees(Meeting meeting, List<Integer> attendeeIds) {
        List<MeetingAttendee> existing = attendeeRepository.findByMeetingId(meeting.getId());
        Set<Integer> keep = new HashSet<>(attendeeIds);

        for (MeetingAttendee row : existing) {
            if (!keep.contains(row.getFriend().getId())) {
                attendeeRepository.delete(row);
            }
        }

        Set<Integer> alreadyPresent = new HashSet<>();
        for (MeetingAttendee row : existing) {
            alreadyPresent.add(row.getFriend().getId());
        }
        for (Integer friendId : attendeeIds) {
            if (!alreadyPresent.contains(friendId)) {
                Friend friend = friendService.getFriendById(friendId);
                attendeeRepository.save(new MeetingAttendee(meeting, friend));
            }
        }
    }

    private void resolveSubjectForType(Meeting meeting, MeetingType type, List<Integer> attendeeIds,
                                        UpdateMeetingRequest request) {
        meeting.setFriend(null);
        meeting.setGroup(null);
        meeting.setConnection(null);

        switch (type) {
            case FRIEND -> meeting.setFriend(friendService.getFriendById(attendeeIds.get(0)));
            case CONNECTION -> resolveConnection(meeting, attendeeIds);
            case GROUP -> resolveGroup(meeting, attendeeIds, request);
        }
    }

    private void resolveConnection(Meeting meeting, List<Integer> attendeeIds) {
        long id1 = Math.min(attendeeIds.get(0), attendeeIds.get(1));
        long id2 = Math.max(attendeeIds.get(0), attendeeIds.get(1));
        // No existing tracked Connection row for this pair is fine — the attendee list +
        // selfAttending stays authoritative either way (Meeting allows zero subject FKs, see
        // its class javadoc); this FK is only a query-acceleration nice-to-have when it exists.
        connectionRepository.findById(new ConnectionId(id1, id2)).ifPresent(meeting::setConnection);
    }

    private void resolveGroup(Meeting meeting, List<Integer> attendeeIds, UpdateMeetingRequest request) {
        if (request.groupId() != null) {
            SocialGroup group = groupRepository.findById(request.groupId())
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + request.groupId()));
            meeting.setGroup(group);
            return;
        }
        if (request.newGroupName() != null && !request.newGroupName().isBlank()) {
            SocialGroup group = groupRepository.save(SocialGroup.builder().name(request.newGroupName()).build());
            groupMemberService.addFriendsToGroup(attendeeIds, group.getId());
            meeting.setGroup(group);
            return;
        }
        // Auto-match (the default): best Jaccard match, or ad-hoc (group left null) if nothing
        // clears GroupMatchingService.MIN_MATCH_THRESHOLD.
        groupMatchingService.findBestMatch(new HashSet<>(attendeeIds))
            .ifPresent(match -> meeting.setGroup(groupRepository.getReferenceById(match.groupId())));
    }
}
