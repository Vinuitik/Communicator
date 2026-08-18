package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendRescheduledEvent;
import communicate.Friend.FriendService.FriendService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingServiceTest {

    @Mock MeetingRepository meetingRepository;
    @Mock FriendService friendService;

    private MeetingService service;

    private MeetingService newService() {
        return new MeetingService(meetingRepository, friendService);
    }

    @Test
    void upsertFsrsProposed_createsOnFirstCall() {
        service = newService();
        Friend friend = new Friend();
        friend.setId(1);
        when(meetingRepository.findByFriendIdAndSourceAndStatus(1, MeetingSource.FSRS_PROPOSED, MeetingStatus.PROPOSED))
            .thenReturn(Optional.empty());
        when(friendService.getFriendById(1)).thenReturn(friend);
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate due = LocalDate.now().plusDays(10);
        Meeting result = service.upsertFsrsProposed(1, due);

        assertThat(result.getFriend()).isSameAs(friend);
        assertThat(result.getSource()).isEqualTo(MeetingSource.FSRS_PROPOSED);
        assertThat(result.getStatus()).isEqualTo(MeetingStatus.PROPOSED);
        assertThat(result.getDate()).isEqualTo(due);
    }

    @Test
    void upsertFsrsProposed_updatesExistingRowInsteadOfCreatingAnother() {
        service = newService();
        Meeting existing = new Meeting();
        existing.setId(42L);
        existing.setDate(LocalDate.now().plusDays(3));
        when(meetingRepository.findByFriendIdAndSourceAndStatus(1, MeetingSource.FSRS_PROPOSED, MeetingStatus.PROPOSED))
            .thenReturn(Optional.of(existing));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate newDue = LocalDate.now().plusDays(20);
        Meeting result = service.upsertFsrsProposed(1, newDue);

        assertThat(result.getId()).isEqualTo(42L);
        assertThat(result.getDate()).isEqualTo(newDue);
        verify(friendService, never()).getFriendById(any());
    }

    @Test
    void ensureBirthdayMeeting_createsNextOccurrenceWhenNoneExists() {
        service = newService();
        Friend friend = new Friend();
        friend.setId(2);
        friend.setDateOfBirth(LocalDate.of(1990, 6, 15));
        when(meetingRepository.findByFriendIdAndSource(2, MeetingSource.BIRTHDAY)).thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        service.ensureBirthdayMeeting(friend);

        ArgumentCaptor<Meeting> captor = ArgumentCaptor.forClass(Meeting.class);
        verify(meetingRepository).save(captor.capture());
        Meeting saved = captor.getValue();
        assertThat(saved.getSource()).isEqualTo(MeetingSource.BIRTHDAY);
        assertThat(saved.getDate()).isAfterOrEqualTo(LocalDate.now());
        assertThat(saved.getDate().getMonthValue()).isEqualTo(6);
        assertThat(saved.getDate().getDayOfMonth()).isEqualTo(15);
    }

    @Test
    void ensureBirthdayMeeting_rollsToNextYearOncePassed() {
        service = newService();
        Friend friend = new Friend();
        friend.setId(3);
        friend.setDateOfBirth(LocalDate.of(1990, 1, 1));
        Meeting existing = new Meeting();
        existing.setDate(LocalDate.now().minusDays(5)); // stale, already passed
        when(meetingRepository.findByFriendIdAndSource(3, MeetingSource.BIRTHDAY)).thenReturn(Optional.of(existing));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        service.ensureBirthdayMeeting(friend);

        assertThat(existing.getDate()).isAfterOrEqualTo(LocalDate.now());
    }

    @Test
    void ensureBirthdayMeeting_noOpWhenNoDateOfBirth() {
        service = newService();
        Friend friend = new Friend();
        friend.setId(4);

        service.ensureBirthdayMeeting(friend);

        verify(meetingRepository, never()).findByFriendIdAndSource(any(), any());
        verify(meetingRepository, never()).save(any());
    }

    @Test
    void nextOccurrence_returnsThisYearWhenStillAhead() {
        LocalDate dob = LocalDate.of(1990, 12, 25);
        LocalDate from = LocalDate.of(2026, 1, 1);
        assertThat(MeetingService.nextOccurrence(dob, from)).isEqualTo(LocalDate.of(2026, 12, 25));
    }

    @Test
    void nextOccurrence_rollsToNextYearWhenAlreadyPassed() {
        LocalDate dob = LocalDate.of(1990, 1, 1);
        LocalDate from = LocalDate.of(2026, 6, 1);
        assertThat(MeetingService.nextOccurrence(dob, from)).isEqualTo(LocalDate.of(2027, 1, 1));
    }

    @Test
    void onFriendRescheduled_upsertsFsrsProposedAndEnsuresBirthday() {
        service = newService();
        Friend friend = new Friend();
        friend.setId(5);
        friend.setDateOfBirth(LocalDate.of(1985, 3, 3));
        when(meetingRepository.findByFriendIdAndSourceAndStatus(eq(5), eq(MeetingSource.FSRS_PROPOSED), eq(MeetingStatus.PROPOSED)))
            .thenReturn(Optional.empty());
        when(meetingRepository.findByFriendIdAndSource(5, MeetingSource.BIRTHDAY)).thenReturn(Optional.empty());
        when(friendService.getFriendById(5)).thenReturn(friend);
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate due = LocalDate.now().plusDays(7);
        service.onFriendRescheduled(new FriendRescheduledEvent(5, due));

        verify(meetingRepository, times(2)).save(any(Meeting.class));
    }
}
