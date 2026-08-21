package com.communicator.meeting.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Nightly catch-up pass for BIRTHDAY meeting rows — rolls a friend's row to
 * next year once the stored date has passed. The immediate-creation path
 * (on friend save) lives wherever friend save happens; this is purely the
 * safety-net/rollover half of the two callers ensureBirthdayMeeting has by
 * design (see MeetingService).
 *
 * Deliberately its own @Scheduled bean in this module rather than hooking
 * into chrono's ChronoJobService — chrono depends on friend only, and this
 * module already sits at the top of the friend/group/connections dependency
 * graph, so it doesn't need chrono's help to run on a cron.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BirthdayMeetingScheduler {

    private final FriendService friendService;
    private final MeetingService meetingService;

    /** Same nightly slot as ChronoJobService.applyDailyDecay() and FsrsNeglectService's lapse pass. */
    @Scheduled(cron = "0 0 0 * * ?")
    public void rolloverPassedBirthdays() {
        int ensured = 0;
        for (Friend friend : friendService.getAllFriends()) {
            if (friend.getDateOfBirth() == null) {
                continue;
            }
            try {
                meetingService.ensureBirthdayMeeting(friend);
                ensured++;
            } catch (Exception e) {
                log.error("Failed to roll over birthday meeting for friend {}", friend.getId(), e);
            }
        }
        log.info("[birthday meeting rollover] checked {} friend(s) with a birthday on file", ensured);
    }
}
