package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.communicator.meeting.dtos.MeetingDTO;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingRepository;

import lombok.RequiredArgsConstructor;

/** Read-side queries backing HomePage's week board and ProfilePage's upcoming-meetings list. */
@Service
@RequiredArgsConstructor
public class MeetingQueryService {

    private final MeetingRepository meetingRepository;

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
        return meetingRepository.findByDateBetweenAndStatusNot(monday, sunday, MeetingStatus.CANCELLED)
            .stream().map(MeetingDTO::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MeetingDTO> upcomingForFriend(Integer friendId) {
        return meetingRepository.findByFriendIdOrderByDateDesc(friendId)
            .stream().map(MeetingDTO::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MeetingDTO> forGroup(Integer groupId) {
        return meetingRepository.findByGroupIdOrderByDateDesc(groupId)
            .stream().map(MeetingDTO::from).toList();
    }
}
