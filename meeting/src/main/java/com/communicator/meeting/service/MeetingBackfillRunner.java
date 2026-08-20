package com.communicator.meeting.service;

import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Runs once per boot (same pattern as friend module's FsrsBackfillRunner):
 * backfills one FSRS_PROPOSED Meeting row per friend from their existing
 * plannedSpeakingTime, and one BIRTHDAY row per friend with a dateOfBirth.
 * Idempotent — skips anyone who already has the relevant row, safe to run
 * on every boot.
 *
 * <p>Also backfills MeetingAttendee rows + selfAttending for every Meeting row that predates the
 * attendee-list-driven edit model (Feature B, meeting-edit stage): every Friend-subject row
 * (FSRS_PROPOSED/BIRTHDAY/MANUAL) becomes 1 attendee + selfAttending=true (unchanged from its
 * pre-existing behavior — you were always "there" for these), every Connection-subject row
 * becomes its 2 attendees + selfAttending=false. Group-subject rows already got real attendee
 * rows at creation time (GroupMeetingService.createManual populates them from GroupMember), so
 * they're skipped here — guarded by "already has attendee rows", not by source, so this is safe
 * to re-run indefinitely.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingBackfillRunner implements ApplicationRunner {

    private final FriendService friendService;
    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository attendeeRepository;
    private final MeetingService meetingService;

    @Override
    public void run(ApplicationArguments args) {
        int fsrsBackfilled = 0;
        int birthdaysEnsured = 0;

        for (Friend friend : friendService.getAllFriends()) {
            boolean hasFsrsProposed = meetingRepository
                .findByFriendIdAndSource(friend.getId(), MeetingSource.FSRS_PROPOSED).isPresent();
            if (!hasFsrsProposed && friend.getPlannedSpeakingTime() != null) {
                meetingService.upsertFsrsProposed(friend.getId(), friend.getPlannedSpeakingTime());
                fsrsBackfilled++;
            }

            if (friend.getDateOfBirth() != null) {
                meetingService.ensureBirthdayMeeting(friend);
                birthdaysEnsured++;
            }
        }

        int attendeesBackfilled = backfillAttendees();

        log.info("[meeting backfill] FSRS_PROPOSED backfilled: {}, birthday rows ensured: {}, "
                + "attendee rows backfilled: {}", fsrsBackfilled, birthdaysEnsured, attendeesBackfilled);
    }

    private int backfillAttendees() {
        int count = 0;
        for (Meeting meeting : meetingRepository.findAll()) {
            if (!attendeeRepository.findByMeetingId(meeting.getId()).isEmpty()) {
                continue;
            }
            if (meeting.getFriend() != null) {
                attendeeRepository.save(new MeetingAttendee(meeting, meeting.getFriend()));
                count++;
            } else if (meeting.getConnection() != null) {
                for (Friend friend : connectionFriends(meeting.getConnection())) {
                    attendeeRepository.save(new MeetingAttendee(meeting, friend));
                }
                meeting.setSelfAttending(false);
                meetingRepository.save(meeting);
                count++;
            }
        }
        return count;
    }

    private List<Friend> connectionFriends(Connection connection) {
        return List.of(
            friendService.getFriendById(connection.getId().getFriend1Id().intValue()),
            friendService.getFriendById(connection.getId().getFriend2Id().intValue())
        );
    }
}
