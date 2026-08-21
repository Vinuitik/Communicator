package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.MeetingDTO;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import lombok.RequiredArgsConstructor;

/** Read-side queries backing HomePage's week board and ProfilePage's upcoming-meetings list. */
@Service
@RequiredArgsConstructor
public class MeetingQueryService {

    private final MeetingRepository meetingRepository;
    private final MeetingAttendeeRepository attendeeRepository;

    /**
     * weekOffset=0 is the current Mon-Sun week (matches the old FriendController.getWeekFriends()
     * default exactly); negative offsets page backward and, since CANCELLED is the only excluded
     * status, past DONE meetings come back too — reads as a progress log when paging back.
     */
    @Transactional(readOnly = true)
    public List<MeetingDTO> thisWeek(int weekOffset) {
        LocalDate now = LocalDate.now().plusWeeks(weekOffset);
        LocalDate monday = now.minusDays(now.getDayOfWeek().getValue() - 1);
        LocalDate sunday = monday.plusDays(6);
        return toDtos(meetingRepository.findByDateBetweenAndStatusNot(monday, sunday, MeetingStatus.CANCELLED));
    }

    @Transactional(readOnly = true)
    public List<MeetingDTO> upcomingForFriend(Integer friendId) {
        return toDtos(meetingRepository.findByFriendIdOrderByDateDesc(friendId));
    }

    @Transactional(readOnly = true)
    public List<MeetingDTO> forGroup(Integer groupId) {
        return toDtos(meetingRepository.findByGroupIdOrderByDateDesc(groupId));
    }

    /**
     * Loads each meeting's attendees to compute its derived type (MeetingTypeDeriver needs the
     * attendee count) — one extra query per meeting, acceptable at this app's scale (dozens of
     * meetings, not thousands), same tradeoff already made elsewhere for "no cache, live query."
     */
    private List<MeetingDTO> toDtos(List<Meeting> meetings) {
        return meetings.stream()
            .map(m -> MeetingDTO.from(m, attendeeRepository.findByMeetingId(m.getId())))
            .toList();
    }
}
