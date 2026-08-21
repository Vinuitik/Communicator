package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.CompleteGroupMeetingRequest;
import com.communicator.meeting.dtos.ConnectionCandidateDTO;
import com.communicator.meeting.dtos.ManualMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.GroupMemberRepository;
import communicate.Friend.FriendService.FriendRescheduledEvent;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.ReviewService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * MANUAL meeting creation (Friend, Group, or Connection — scheduling ahead) and the Group
 * batch-log complete flow — the two later-stage pieces MeetingService's own javadoc calls out as
 * separate from the FSRS_PROPOSED/BIRTHDAY auto-managed sources. The Connection branch requires an
 * already-tracked Connection row for the pair (404 otherwise, same rule ConnectionMeetingService
 * enforces for logging) — scheduling ahead is still about a pair the app already tracks, just not
 * yet contacted.
 */
@Service
@RequiredArgsConstructor
public class GroupMeetingService {

    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository attendeeRepository;
    private final FriendService friendService;
    private final SocialGroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ConnectionRepository connectionRepository;
    private final ReviewService reviewService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Meeting createManual(ManualMeetingRequest request) {
        boolean hasFriend = request.friendId() != null;
        boolean hasGroup = request.groupId() != null;
        boolean hasConnection = request.connectionFriend1Id() != null || request.connectionFriend2Id() != null;
        if (hasConnection && (request.connectionFriend1Id() == null || request.connectionFriend2Id() == null)) {
            throw new IllegalArgumentException(
                "Both connectionFriend1Id and connectionFriend2Id are required to schedule a connection meeting");
        }
        int subjectCount = (hasFriend ? 1 : 0) + (hasGroup ? 1 : 0) + (hasConnection ? 1 : 0);
        if (subjectCount != 1) {
            throw new IllegalArgumentException(
                "Exactly one of friendId/groupId/(connectionFriend1Id+connectionFriend2Id) must be set");
        }

        Meeting meeting = new Meeting();
        meeting.setSource(MeetingSource.MANUAL);
        meeting.setStatus(MeetingStatus.PROPOSED);
        meeting.setDate(request.date());
        meeting.setNote(request.note());

        if (hasFriend) {
            Friend friend = friendService.getFriendById(request.friendId());
            meeting.setFriend(friend);
            meeting = meetingRepository.save(meeting);
        } else if (hasGroup) {
            SocialGroup group = groupRepository.findById(request.groupId())
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + request.groupId()));
            meeting.setGroup(group);
            meeting = meetingRepository.save(meeting);

            for (Friend member : groupMemberRepository.findFriendsByGroupId(request.groupId())) {
                attendeeRepository.save(new MeetingAttendee(meeting, member));
            }
        } else {
            long id1 = Math.min(request.connectionFriend1Id(), request.connectionFriend2Id());
            long id2 = Math.max(request.connectionFriend1Id(), request.connectionFriend2Id());
            Connection connection = connectionRepository.findById(new ConnectionId(id1, id2))
                .orElseThrow(() -> new EntityNotFoundException("Connection not found: " + id1 + "/" + id2));
            meeting.setConnection(connection);
            meeting.setSelfAttending(false);
            meeting = meetingRepository.save(meeting);

            attendeeRepository.save(new MeetingAttendee(meeting, friendService.getFriendById((int) id1)));
            attendeeRepository.save(new MeetingAttendee(meeting, friendService.getFriendById((int) id2)));
        }
        return meeting;
    }

    /**
     * Presence + duration/quality per attendee, iterated the same way applyTalkedToFriend grades a
     * single 1:1 log: reviewInteraction() mutates the friend in-memory, we persist plannedSpeakingTime
     * and publish FriendRescheduledEvent so MeetingService.onFriendRescheduled upserts each attendee's
     * FSRS_PROPOSED row. Absent attendees are left entirely untouched (no reviewInteraction call, no
     * attendee-row deletion — just excluded from this pass, per the plan's presence-toggle semantics).
     */
    @Transactional
    public Meeting completeGroupMeeting(Long meetingId, CompleteGroupMeetingRequest request) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new EntityNotFoundException("Meeting not found: " + meetingId));
        if (meeting.getGroup() == null) {
            throw new IllegalArgumentException("Meeting " + meetingId + " is not a group meeting");
        }

        List<MeetingAttendee> attendeeRows = attendeeRepository.findByMeetingId(meetingId);

        for (CompleteGroupMeetingRequest.AttendeeLog log : request.attendees()) {
            MeetingAttendee row = attendeeRows.stream()
                .filter(a -> a.getFriend().getId().equals(log.friendId()))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException(
                    "Friend " + log.friendId() + " is not an attendee of meeting " + meetingId));
            row.setPresent(log.present());
            attendeeRepository.save(row);

            if (!log.present()) {
                continue;
            }
            Friend friend = row.getFriend();
            LocalDate plannedTime = reviewService.reviewInteraction(friend,
                log.durationHours() != null ? log.durationHours() : 0.0,
                log.experience(), log.inPerson(), LocalDate.now());
            friend.setPlannedSpeakingTime(plannedTime);
            friendService.save(friend);
            eventPublisher.publishEvent(new FriendRescheduledEvent(friend.getId(), plannedTime));
        }

        meeting.setStatus(MeetingStatus.DONE);
        return meetingRepository.save(meeting);
    }

    /**
     * Present-attendee pairs (post-complete) that already have a tracked Connection — the
     * low-friction Group-to-Connections nudge, scoped to existing rows only (no new Connections
     * created here).
     */
    @Transactional(readOnly = true)
    public List<ConnectionCandidateDTO> connectionCandidates(Long meetingId) {
        List<Friend> present = attendeeRepository.findByMeetingId(meetingId).stream()
            .filter(MeetingAttendee::isPresent)
            .map(MeetingAttendee::getFriend)
            .toList();

        List<ConnectionCandidateDTO> candidates = new ArrayList<>();
        for (int i = 0; i < present.size(); i++) {
            for (int j = i + 1; j < present.size(); j++) {
                Friend a = present.get(i);
                Friend b = present.get(j);
                long id1 = Math.min(a.getId(), b.getId());
                long id2 = Math.max(a.getId(), b.getId());
                boolean tracked = connectionRepository.findByFriendId(id1).stream()
                    .map(Connection::getId)
                    .anyMatch(cid -> cid.getFriend1Id() == id1 && cid.getFriend2Id() == id2);
                if (tracked) {
                    Friend first = a.getId() == id1 ? a : b;
                    Friend second = a.getId() == id1 ? b : a;
                    candidates.add(new ConnectionCandidateDTO(id1, first.getName(), id2, second.getName()));
                }
            }
        }
        return candidates;
    }
}
