package com.communicator.meeting.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.ConnectionMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingRepository;

import coommunicator.connections.Connections.ConnectionService.ConnectionKnowledgeService;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Logs a CONNECTION Meeting — record-only, no FSRS. Connections are a fixed friend1/friend2
 * pair by schema (no roster), so unlike Friend/Group there's nothing to batch: date + outcome
 * + optional note, saved as already-DONE (you weren't there to schedule it, only to record
 * what you heard — SCHEDULING_MEETINGS_PLAN.md's "CONNECTION meetings use a distinct lighter
 * log form"). The note, if present, auto-appends to ConnectionsKnowledge via the existing
 * ConnectionKnowledgeService.addKnowledge — no knowledge-append logic duplicated here, same
 * pattern QuickLogModal already uses for FriendKnowledge.
 */
@Service
@RequiredArgsConstructor
public class ConnectionMeetingService {

    private final MeetingRepository meetingRepository;
    private final ConnectionRepository connectionRepository;
    private final ConnectionKnowledgeService connectionKnowledgeService;

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

        Meeting meeting = new Meeting();
        meeting.setConnection(connection);
        meeting.setSource(MeetingSource.MANUAL);
        meeting.setStatus(MeetingStatus.DONE);
        meeting.setDate(request.date());
        meeting.setOutcome(request.outcome());
        meeting.setNote(request.note());
        meeting = meetingRepository.save(meeting);

        if (request.note() != null && !request.note().isBlank()) {
            ConnectionsKnowledge knowledge = new ConnectionsKnowledge();
            knowledge.setText(request.note());
            knowledge.setPriority(1L);
            connectionKnowledgeService.addKnowledge(id1, id2, List.of(knowledge));
        }

        return meeting;
    }
}
