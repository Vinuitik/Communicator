package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.communicator.meeting.dtos.ManualMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.GroupMemberRepository;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.ReviewService;

import jakarta.persistence.EntityNotFoundException;

import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GroupMeetingServiceTest {

    @Mock MeetingRepository meetingRepository;
    @Mock MeetingAttendeeRepository attendeeRepository;
    @Mock FriendService friendService;
    @Mock SocialGroupRepository groupRepository;
    @Mock GroupMemberRepository groupMemberRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ReviewService reviewService;
    @Mock ApplicationEventPublisher eventPublisher;

    private GroupMeetingService newService() {
        return new GroupMeetingService(meetingRepository, attendeeRepository, friendService,
            groupRepository, groupMemberRepository, connectionRepository, reviewService, eventPublisher);
    }

    private Friend friendOf(int id) {
        return Friend.builder().id(id).name("Friend " + id).build();
    }

    private Connection connectionOf(long id1, long id2) {
        Connection connection = new Connection();
        connection.setId(new ConnectionId(id1, id2));
        return connection;
    }

    @Test
    void createManual_connectionPair_producesProposedMeetingWithTwoAttendees() {
        GroupMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(friendService.getFriendById(1)).thenReturn(friendOf(1));
        when(friendService.getFriendById(2)).thenReturn(friendOf(2));

        LocalDate date = LocalDate.now().plusDays(3);
        ManualMeetingRequest request = new ManualMeetingRequest(null, null, 1L, 2L, date, "catch up soon");

        Meeting result = service.createManual(request);

        assertThat(result.getConnection()).isSameAs(connection);
        assertThat(result.getFriend()).isNull();
        assertThat(result.getGroup()).isNull();
        assertThat(result.getSource()).isEqualTo(MeetingSource.MANUAL);
        assertThat(result.getStatus()).isEqualTo(MeetingStatus.PROPOSED);
        assertThat(result.isSelfAttending()).isFalse();
        assertThat(result.getDate()).isEqualTo(date);

        ArgumentCaptor<MeetingAttendee> captor = ArgumentCaptor.forClass(MeetingAttendee.class);
        verify(attendeeRepository, times(2)).save(captor.capture());
        List<MeetingAttendee> saved = captor.getAllValues();
        assertThat(saved).extracting(a -> a.getFriend().getId()).containsExactlyInAnyOrder(1, 2);
    }

    @Test
    void createManual_connectionPair_reversedOrderStillNormalizes() {
        GroupMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(friendService.getFriendById(1)).thenReturn(friendOf(1));
        when(friendService.getFriendById(2)).thenReturn(friendOf(2));

        ManualMeetingRequest request = new ManualMeetingRequest(null, null, 2L, 1L, LocalDate.now(), null);

        Meeting result = service.createManual(request);

        assertThat(result.getConnection()).isSameAs(connection);
    }

    @Test
    void createManual_connectionPair_untrackedConnectionThrowsNotFound() {
        GroupMeetingService service = newService();
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.empty());

        ManualMeetingRequest request = new ManualMeetingRequest(null, null, 1L, 2L, LocalDate.now(), null);

        assertThatThrownBy(() -> service.createManual(request)).isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void createManual_connectionPair_missingOneIdRejected() {
        GroupMeetingService service = newService();
        ManualMeetingRequest request = new ManualMeetingRequest(null, null, 1L, null, LocalDate.now(), null);

        assertThatThrownBy(() -> service.createManual(request)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createManual_noSubjectRejected() {
        GroupMeetingService service = newService();
        ManualMeetingRequest request = new ManualMeetingRequest(null, null, null, null, LocalDate.now(), null);

        assertThatThrownBy(() -> service.createManual(request)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createManual_multipleSubjectsRejected() {
        GroupMeetingService service = newService();
        ManualMeetingRequest request = new ManualMeetingRequest(1, 2, null, null, LocalDate.now(), null);

        assertThatThrownBy(() -> service.createManual(request)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createManual_friendOnly_stillWorksUnaffectedByConnectionBranch() {
        GroupMeetingService service = newService();
        when(friendService.getFriendById(9)).thenReturn(friendOf(9));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        ManualMeetingRequest request = new ManualMeetingRequest(9, null, null, null, LocalDate.now(), "note");
        Meeting result = service.createManual(request);

        assertThat(result.getFriend().getId()).isEqualTo(9);
        assertThat(result.getStatus()).isEqualTo(MeetingStatus.PROPOSED);
        verify(attendeeRepository, times(0)).save(any());
    }
}
