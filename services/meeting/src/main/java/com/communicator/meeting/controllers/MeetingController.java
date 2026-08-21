package com.communicator.meeting.controllers;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;

import com.communicator.meeting.dtos.AttendeeDTO;
import com.communicator.meeting.dtos.CompleteGroupMeetingRequest;
import com.communicator.meeting.dtos.ConnectionCandidateDTO;
import com.communicator.meeting.dtos.ConnectionMeetingRequest;
import com.communicator.meeting.dtos.GroupMatchDTO;
import com.communicator.meeting.dtos.ManualMeetingRequest;
import com.communicator.meeting.dtos.MeetingDTO;
import com.communicator.meeting.dtos.UpdateMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.service.ConnectionMeetingService;
import com.communicator.meeting.service.GroupMeetingService;
import com.communicator.meeting.service.MeetingEditService;
import com.communicator.meeting.service.MeetingQueryService;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Replaces FriendController's thisWeek endpoint (see its own comment — that one only ever read
 * Friend.plannedSpeakingTime and can't reach across Group/Connection, which friend/group/connections
 * are deliberately barred from depending on). Also the entry point for MANUAL meeting creation, the
 * Group batch-log flow (presence -> per-attendee grade -> Connections nudge), and the unified
 * edit/cancel/reschedule surface (PATCH — attendee list + selfAttending drives the derived type,
 * see MeetingEditService).
 */
@RestController
@RequestMapping("/meetings")
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*",
    methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE})
@RequiredArgsConstructor
public class MeetingController {

    private final GroupMeetingService groupMeetingService;
    private final MeetingQueryService meetingQueryService;
    private final MeetingAttendeeRepository attendeeRepository;
    private final ConnectionMeetingService connectionMeetingService;
    private final MeetingEditService meetingEditService;

    @GetMapping("thisWeek")
    public List<MeetingDTO> thisWeek(@RequestParam(defaultValue = "0") int weekOffset) {
        return meetingQueryService.thisWeek(weekOffset);
    }

    @GetMapping("friend/{friendId}")
    public List<MeetingDTO> forFriend(@PathVariable Integer friendId) {
        return meetingQueryService.upcomingForFriend(friendId);
    }

    @GetMapping("group/{groupId}")
    public List<MeetingDTO> forGroup(@PathVariable Integer groupId) {
        return meetingQueryService.forGroup(groupId);
    }

    @PostMapping("manual")
    public ResponseEntity<MeetingDTO> createManual(@RequestBody ManualMeetingRequest request) {
        try {
            Meeting meeting = groupMeetingService.createManual(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(meeting));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("{meetingId}/attendees")
    public List<AttendeeDTO> attendees(@PathVariable Long meetingId) {
        return attendeeRepository.findByMeetingId(meetingId).stream().map(AttendeeDTO::from).toList();
    }

    @PostMapping("{meetingId}/complete")
    public ResponseEntity<MeetingDTO> completeGroupMeeting(
            @PathVariable Long meetingId, @RequestBody CompleteGroupMeetingRequest request) {
        try {
            Meeting meeting = groupMeetingService.completeGroupMeeting(meetingId, request);
            return ResponseEntity.ok(toDto(meeting));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Present-attendee pairs from a just-completed group meeting that already have a tracked Connection. */
    @GetMapping("{meetingId}/connection-candidates")
    public List<ConnectionCandidateDTO> connectionCandidates(@PathVariable Long meetingId) {
        return groupMeetingService.connectionCandidates(meetingId);
    }

    /**
     * Log a CONNECTION meeting — date + outcome + optional note, saved as already-DONE (no
     * PROPOSED/scheduling state for Connections). Note auto-appends to ConnectionsKnowledge.
     */
    @PostMapping("connection")
    public ResponseEntity<MeetingDTO> createConnectionMeeting(@RequestBody ConnectionMeetingRequest request) {
        try {
            Meeting meeting = connectionMeetingService.logConnectionMeeting(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(meeting));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * The one unified edit — date/time/location/attendees/selfAttending. Also used for
     * drag-and-drop reschedule (CalendarBoard sends just a new date, everything else unchanged)
     * and for switching a Friend/Connection meeting into a Group one by adding attendees, or vice
     * versa by removing them — the type is re-derived, never picked.
     */
    @PatchMapping("{meetingId}")
    public ResponseEntity<MeetingDTO> updateMeeting(
            @PathVariable Long meetingId, @RequestBody UpdateMeetingRequest request) {
        try {
            Meeting meeting = meetingEditService.updateMeeting(meetingId, request);
            return ResponseEntity.ok(toDto(meeting));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("{meetingId}/cancel")
    public ResponseEntity<MeetingDTO> cancelMeeting(@PathVariable Long meetingId) {
        try {
            return ResponseEntity.ok(toDto(meetingEditService.cancelMeeting(meetingId)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Live "which group would this resolve to" preview for the edit modal — no save. */
    @PostMapping("group-match-preview")
    public List<GroupMatchDTO> previewGroupMatch(@RequestBody List<Integer> attendeeFriendIds) {
        Set<Integer> ids = new HashSet<>(attendeeFriendIds);
        return meetingEditService.previewGroupMatch(ids);
    }

    private MeetingDTO toDto(Meeting meeting) {
        return MeetingDTO.from(meeting, attendeeRepository.findByMeetingId(meeting.getId()));
    }
}
