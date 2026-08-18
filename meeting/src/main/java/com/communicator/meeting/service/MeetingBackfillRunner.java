package com.communicator.meeting.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.repositories.MeetingRepository;

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
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MeetingBackfillRunner implements ApplicationRunner {

    private final FriendService friendService;
    private final MeetingRepository meetingRepository;
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

        log.info("[meeting backfill] FSRS_PROPOSED backfilled: {}, birthday rows ensured: {}",
            fsrsBackfilled, birthdaysEnsured);
    }
}
