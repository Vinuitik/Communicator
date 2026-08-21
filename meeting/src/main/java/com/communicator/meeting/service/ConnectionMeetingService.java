package com.communicator.meeting.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.ConnectionMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import coommunicator.connections.Connections.ConnectionService.ConnectionKnowledgeService;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import communicate.Friend.FriendService.FriendService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Logs a CONNECTION Meeting outcome — record-only, no FSRS. Connections are a fixed
 * friend1/friend2 pair by schema (no roster), so unlike Friend/Group there's nothing to batch:
 * date + outcome + optional note.
 *
 * <p>Two modes, chosen automatically by whether a scheduled-ahead row already exists:
 * <ul>
 *   <li><b>Transition</b> — a PROPOSED Connection meeting for this pair already exists (created via
 *       {@code GroupMeetingService.createManual}'s connection branch) — that row is moved to DONE
 *       with this request's date/outcome/note, not duplicated. Its attendee rows/selfAttending were
 *       already set correctly at scheduling time.</li>
 *   <li><b>Create-and-close</b> — nothing was scheduled ahead: you weren't there to schedule it,
 *       only to record what you heard about it after the fact. Saves a new already-DONE Meeting,
 *       with its 2 attendee rows (selfAttending=false) filled in immediately so it derives as
 *       type CONNECTION right away — same shape MeetingBackfillRunner retrofits onto legacy rows,
 *       just done at write time instead of waiting for the next boot pass.</li>
 * </ul>
 * Either way the note, if present, auto-appends to ConnectionsKnowledge via the existing
 * ConnectionKnowledgeService.addKnowledge — no knowledge-append logic duplicated here, same
 * pattern QuickLogModal already uses for FriendKnowledge.
 */
@Service
@RequiredArgsConstructor
public class ConnectionMeetingService {

    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository attendeeRepository;
    private final ConnectionRepository connectionRepository;
    private final ConnectionKnowledgeService connectionKnowledgeService;
    private final FriendService friendService;

    @Transactional
    public Meeting logConnectionMeeting(ConnectionMeetingRequest request) {
        if (request.friend1Id() == null || request.friend2Id() == null) {
            throw new IllegalArgumentException("Both friend1Id and friend2Id are required");
        }
        if (request.outcome() == null) {
            throw new IllegalArgumentException("outcome is required");
        }
        if (request.date() == null) {
            throw new IllegalArgumentException("date is required");
        }

        long id1 = Math.min(request.friend1Id(), request.friend2Id());
        long id2 = Math.max(request.friend1Id(), request.friend2Id());
        Connection connection = connectionRepository.findById(new ConnectionId(id1, id2))
            .orElseThrow(() -> new EntityNotFoundException("Connection not found: " + id1 + "/" + id2));

        Optional<Meeting> scheduled = meetingRepository
            .findFirstByConnectionAndStatusOrderByDateDesc(connection, MeetingStatus.PROPOSED);

        Meeting meeting;
        if (scheduled.isPresent()) {
            meeting = scheduled.get();
            meeting.setStatus(MeetingStatus.DONE);
            meeting.setDate(request.date());
            meeting.setOutcome(request.outcome());
            meeting.setNote(request.note());
            meeting = meetingRepository.save(meeting);
        } else {
            meeting = new Meeting();
            meeting.setConnection(connection);
            meeting.setSource(MeetingSource.MANUAL);
            meeting.setStatus(MeetingStatus.DONE);
            meeting.setDate(request.date());
            meeting.setOutcome(request.outcome());
            meeting.setNote(request.note());
            meeting.setSelfAttending(false);
            meeting = meetingRepository.save(meeting);

            attendeeRepository.save(new MeetingAttendee(meeting, friendService.getFriendById((int) id1)));
            attendeeRepository.save(new MeetingAttendee(meeting, friendService.getFriendById((int) id2)));
        }

        if (request.note() != null && !request.note().isBlank()) {
            ConnectionsKnowledge knowledge = new ConnectionsKnowledge();
            knowledge.setText(request.note());
            knowledge.setPriority(1L);
            connectionKnowledgeService.addKnowledge(id1, id2, List.of(knowledge));
        }

        return meeting;
    }
}
