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
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingRepository;

import coommunicator.connections.Connections.ConnectionService.ConnectionKnowledgeService;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionsKnowledge;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import jakarta.persistence.EntityNotFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConnectionMeetingServiceTest {

    @Mock MeetingRepository meetingRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ConnectionKnowledgeService connectionKnowledgeService;

    private ConnectionMeetingService newService() {
        return new ConnectionMeetingService(meetingRepository, connectionRepository, connectionKnowledgeService);
    }

    private Connection connectionOf(long id1, long id2) {
        Connection connection = new Connection();
        connection.setId(new ConnectionId(id1, id2));
        return connection;
    }

    @Test
    void logConnectionMeeting_createsDoneMeetingWithOutcomeAndAppendsNote() {
        ConnectionMeetingService service = newService();
        Connection connection = connectionOf(1L, 2L);
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connection));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

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
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

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
        when(connectionRepository.findById(new ConnectionId(1L, 2L))).thenReturn(Optional.of(connectionOf(1L, 2L)));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        service.logConnectionMeeting(
            new ConnectionMeetingRequest(1L, 2L, LocalDate.now(), ConnectionOutcome.TENSE, "rough patch"));

        // The only repository interactions are the Connection lookup, the single Meeting save,
        // and the knowledge append — nothing FSRS/upsert-related (no findByFriendIdAndSource*
        // calls, unlike MeetingService's FSRS_PROPOSED/BIRTHDAY paths) and exactly one save.
        verify(meetingRepository).save(any(Meeting.class));
        verify(meetingRepository, never()).findByFriendIdAndSourceAndStatus(any(), any(), any());
        verify(meetingRepository, never()).findByFriendIdAndSource(any(), any());
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
