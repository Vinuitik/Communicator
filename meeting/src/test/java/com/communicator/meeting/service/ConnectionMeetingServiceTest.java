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

import com.communicator.meeting.dtos.ConnectionMeetingRequest;
import com.communicator.meeting.entities.ConnectionOutcome;
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

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendService;

import jakarta.persistence.EntityNotFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConnectionMeetingServiceTest {

    @Mock MeetingRepository meetingRepository;
    @Mock MeetingAttendeeRepository attendeeRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ConnectionKnowledgeService connectionKnowledgeService;
    @Mock FriendService friendService;

    private ConnectionMeetingService newService() {
        return new ConnectionMeetingService(
            meetingRepository, attendeeRepository, connectionRepository, connectionKnowledgeService, friendService);
    }

    private Connection connectionOf(long id1, long id2) {
        Connection connection = new Connection();
        connection.setId(new ConnectionId(id1, id2));
        return connection;
    }

    private Friend friendOf(int id) {
        return Friend.builder().id(id).name("Friend " + id).build();
    }

    @Test
    void logConnectionMeeting_createsDoneMeetingWithOutcomeAndAppendsNote() {
        ConnectionMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.findFirstByConnectionAndStatusOrderByDateDesc(connection, MeetingStatus.PROPOSED))
            .thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(friendService.getFriendById(1)).thenReturn(friendOf(1));
        when(friendService.getFriendById(2)).thenReturn(friendOf(2));

        LocalDate date = LocalDate.now();
        ConnectionMeetingRequest request =
            new ConnectionMeetingRequest(1L, 2L, date, ConnectionOutcome.WENT_WELL, "Talked about the trip");

        Meeting result = service.logConnectionMeeting(request);

        assertThat(result.getConnection()).isSameAs(connection);
        assertThat(result.getSource()).isEqualTo(MeetingSource.MANUAL);
        assertThat(result.getStatus()).isEqualTo(MeetingStatus.DONE);
        assertThat(result.getOutcome()).isEqualTo(ConnectionOutcome.WENT_WELL);
        assertThat(result.getDate()).isEqualTo(date);
        assertThat(result.getNote()).isEqualTo("Talked about the trip");
        assertThat(result.isSelfAttending()).isFalse();

        // Create-and-close also fills in the 2 attendee rows immediately (not left to the
        // boot-time backfill runner), so the fresh meeting derives as type CONNECTION right away.
        ArgumentCaptor<MeetingAttendee> attendeeCaptor = ArgumentCaptor.forClass(MeetingAttendee.class);
        verify(attendeeRepository, times(2)).save(attendeeCaptor.capture());
        assertThat(attendeeCaptor.getAllValues())
            .extracting(a -> a.getFriend().getId())
            .containsExactlyInAnyOrder(1, 2);

        ArgumentCaptor<List<ConnectionsKnowledge>> captor = ArgumentCaptor.forClass(List.class);
        verify(connectionKnowledgeService).addKnowledge(eq(1L), eq(2L), captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getText()).isEqualTo("Talked about the trip");
    }

    @Test
    void logConnectionMeeting_worksWithReversedFriendOrderAndNoNote() {
        ConnectionMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.findFirstByConnectionAndStatusOrderByDateDesc(connection, MeetingStatus.PROPOSED))
            .thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(friendService.getFriendById(1)).thenReturn(friendOf(1));
        when(friendService.getFriendById(2)).thenReturn(friendOf(2));

        ConnectionMeetingRequest request =
            new ConnectionMeetingRequest(2L, 1L, LocalDate.now(), ConnectionOutcome.NEUTRAL, null);

        Meeting result = service.logConnectionMeeting(request);

        assertThat(result.getConnection()).isSameAs(connection);
        assertThat(result.getNote()).isNull();
        verify(connectionKnowledgeService, never()).addKnowledge(anyLong(), anyLong(), any());
    }

    @Test
    void logConnectionMeeting_noFsrsOrSchedulingSideEffect() {
        ConnectionMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.findFirstByConnectionAndStatusOrderByDateDesc(connection, MeetingStatus.PROPOSED))
            .thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));
        when(friendService.getFriendById(1)).thenReturn(friendOf(1));
        when(friendService.getFriendById(2)).thenReturn(friendOf(2));

        service.logConnectionMeeting(
            new ConnectionMeetingRequest(1L, 2L, LocalDate.now(), ConnectionOutcome.TENSE, "rough patch"));

        // The only Meeting-repository interactions are the PROPOSED-lookup and the single save —
        // nothing FSRS/upsert-related (no findByFriendIdAndSource* calls, unlike MeetingService's
        // FSRS_PROPOSED/BIRTHDAY paths).
        verify(meetingRepository).save(any(Meeting.class));
        verify(meetingRepository, never()).findByFriendIdAndSourceAndStatus(any(), any(), any());
        verify(meetingRepository, never()).findByFriendIdAndSource(any(), any());
    }

    @Test
    void logConnectionMeeting_existingProposedRow_transitionsToDoneInsteadOfDuplicating() {
        ConnectionMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        Meeting proposed = new Meeting();
        proposed.setId(99L);
        proposed.setConnection(connection);
        proposed.setSource(MeetingSource.MANUAL);
        proposed.setStatus(MeetingStatus.PROPOSED);
        proposed.setSelfAttending(false);
        proposed.setDate(LocalDate.now().plusDays(5));

        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.findFirstByConnectionAndStatusOrderByDateDesc(connection, MeetingStatus.PROPOSED))
            .thenReturn(Optional.of(proposed));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate loggedDate = LocalDate.now();
        Meeting result = service.logConnectionMeeting(
            new ConnectionMeetingRequest(1L, 2L, loggedDate, ConnectionOutcome.WENT_WELL, "went great"));

        assertThat(result.getId()).isEqualTo(99L);
        assertThat(result.getStatus()).isEqualTo(MeetingStatus.DONE);
        assertThat(result.getDate()).isEqualTo(loggedDate);
        assertThat(result.getOutcome()).isEqualTo(ConnectionOutcome.WENT_WELL);
        assertThat(result.getNote()).isEqualTo("went great");

        // Exactly one Meeting saved (the transitioned row), no duplicate row created, and no new
        // attendee rows — the PROPOSED row's attendees were already set at scheduling time.
        verify(meetingRepository, times(1)).save(any(Meeting.class));
        verify(attendeeRepository, never()).save(any());
    }

    @Test
    void logConnectionMeeting_missingOutcomeRejected() {
        ConnectionMeetingService service = newService();

        assertThatThrownBy(() -> service.logConnectionMeeting(
                new ConnectionMeetingRequest(1L, 2L, LocalDate.now(), null, null)))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void logConnectionMeeting_unknownConnectionThrowsNotFound() {
        ConnectionMeetingService service = newService();
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.logConnectionMeeting(
                new ConnectionMeetingRequest(1L, 2L, LocalDate.now(), ConnectionOutcome.NEUTRAL, null)))
            .isInstanceOf(EntityNotFoundException.class);
    }
}
