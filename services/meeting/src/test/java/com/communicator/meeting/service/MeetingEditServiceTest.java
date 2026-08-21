package com.communicator.meeting.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.communicator.meeting.dtos.GroupMatchDTO;
import com.communicator.meeting.dtos.UpdateMeetingRequest;
import com.communicator.meeting.entities.Meeting;
import com.communicator.meeting.entities.MeetingAttendee;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.repositories.MeetingAttendeeRepository;
import com.communicator.meeting.repositories.MeetingRepository;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupRepositories.SocialGroupRepository;

import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionId;
import coommunicator.connections.Connections.ConnectionsRepositories.ConnectionRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.GroupMemberService;

import jakarta.persistence.EntityNotFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MeetingEditServiceTest {

    @Mock MeetingRepository meetingRepository;
    @Mock MeetingAttendeeRepository attendeeRepository;
    @Mock FriendService friendService;
    @Mock SocialGroupRepository groupRepository;
    @Mock GroupMemberService groupMemberService;
    @Mock ConnectionRepository connectionRepository;
    @Mock GroupMatchingService groupMatchingService;

    private MeetingEditService newService() {
        return new MeetingEditService(meetingRepository, attendeeRepository, friendService,
            groupRepository, groupMemberService, connectionRepository, groupMatchingService);
    }

    private Friend friend(int id) {
        Friend f = new Friend();
        f.setId(id);
        f.setName("Friend" + id);
        return f;
    }

    private Meeting existingMeeting() {
        Meeting m = new Meeting();
        m.setId(1L);
        m.setSource(MeetingSource.MANUAL);
        m.setStatus(MeetingStatus.PROPOSED);
        m.setSelfAttending(true);
        return m;
    }

    @Test
    void oneAttendeePlusSelf_resolvesToFriend() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(10)).thenReturn(friend(10));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10), true, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getFriend().getId()).isEqualTo(10);
        assertThat(result.getGroup()).isNull();
        assertThat(result.getConnection()).isNull();
        verify(attendeeRepository).save(any(MeetingAttendee.class));
    }

    @Test
    void twoAttendeesNoSelf_resolvesToConnectionWhenTracked() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(10)).thenReturn(friend(10));
        when(friendService.getFriendById(11)).thenReturn(friend(11));
        Connection connection = new Connection();
        connection.setId(new ConnectionId(10L, 11L));
        when(connectionRepository.findById(new ConnectionId(10L, 11L))).thenReturn(Optional.of(connection));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(11, 10), false, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.isSelfAttending()).isFalse();
        assertThat(result.getConnection()).isSameAs(connection);
        assertThat(result.getFriend()).isNull();
    }

    @Test
    void twoAttendeesNoSelf_untrackedConnection_leavesFkNullButStillValid() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(anyInt())).thenAnswer(inv -> friend(inv.getArgument(0)));
        when(connectionRepository.findById(any(ConnectionId.class))).thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(20, 21), false, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getConnection()).isNull(); // no FK, but this doesn't throw / isn't invalid
    }

    @Test
    void threeAttendeesWithSelf_autoMatchesBestGroup() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(anyInt())).thenAnswer(inv -> friend(inv.getArgument(0)));
        when(groupMatchingService.findBestMatch(any())).thenReturn(Optional.of(new GroupMatchDTO(5, "Book Club", 1.0, 3)));
        SocialGroup matched = SocialGroup.builder().id(5).name("Book Club").build();
        when(groupRepository.getReferenceById(5)).thenReturn(matched);
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10, 11, 12), true, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getGroup()).isSameAs(matched);
        verify(groupRepository, never()).save(any(SocialGroup.class));
    }

    @Test
    void groupTypeWithNoMatch_staysAdHoc_groupNull() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(anyInt())).thenAnswer(inv -> friend(inv.getArgument(0)));
        when(groupMatchingService.findBestMatch(any())).thenReturn(Optional.empty());
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10, 11, 12), true, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getGroup()).isNull();
    }

    @Test
    void explicitGroupIdOverride_skipsAutoMatch() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(anyInt())).thenAnswer(inv -> friend(inv.getArgument(0)));
        SocialGroup picked = SocialGroup.builder().id(7).name("Picked").build();
        when(groupRepository.findById(7)).thenReturn(Optional.of(picked));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10, 11, 12), true, 7, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getGroup()).isSameAs(picked);
        verify(groupMatchingService, never()).findBestMatch(any());
    }

    @Test
    void createNewGroupName_createsGroupAndAddsAttendeesAsMembers() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(anyInt())).thenAnswer(inv -> friend(inv.getArgument(0)));
        when(groupRepository.save(any(SocialGroup.class))).thenAnswer(inv -> {
            SocialGroup g = inv.getArgument(0);
            g.setId(9);
            return g;
        });
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10, 11, 12), true, null, "New Crew");

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getGroup().getName()).isEqualTo("New Crew");
        verify(groupMemberService).addFriendsToGroup(eq(List.of(10, 11, 12)), eq(9));
    }

    @Test
    void attendeeDiff_removesDroppedAndAddsNew() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        MeetingAttendee stale = new MeetingAttendee(meeting, friend(99));
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of(stale));
        when(friendService.getFriendById(10)).thenReturn(friend(10));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10), true, null, null);

        service.updateMeeting(1L, request);

        verify(attendeeRepository).delete(stale);
        verify(attendeeRepository).save(any(MeetingAttendee.class));
    }

    @Test
    void noAttendees_rejected() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(), true, null, null);

        assertThatThrownBy(() -> service.updateMeeting(1L, request))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void noSelfWithOnlyOneAttendee_rejected() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10), false, null, null);

        assertThatThrownBy(() -> service.updateMeeting(1L, request))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void bothGroupIdAndNewGroupName_rejected() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10, 11), true, 5, "New");

        assertThatThrownBy(() -> service.updateMeeting(1L, request))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void dragAndDropReschedule_dateOnlyChange() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(attendeeRepository.findByMeetingId(1L)).thenReturn(List.of());
        when(friendService.getFriendById(10)).thenReturn(friend(10));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate newDate = LocalDate.now().plusDays(3);
        UpdateMeetingRequest request = new UpdateMeetingRequest(newDate, null, null, List.of(10), true, null, null);

        Meeting result = service.updateMeeting(1L, request);

        assertThat(result.getDate()).isEqualTo(newDate);
    }

    @Test
    void cancelMeeting_setsCancelledStatus() {
        MeetingEditService service = newService();
        Meeting meeting = existingMeeting();
        when(meetingRepository.findById(1L)).thenReturn(Optional.of(meeting));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        Meeting result = service.cancelMeeting(1L);

        assertThat(result.getStatus()).isEqualTo(MeetingStatus.CANCELLED);
    }

    @Test
    void unknownMeeting_throwsNotFound() {
        MeetingEditService service = newService();
        when(meetingRepository.findById(1L)).thenReturn(Optional.empty());

        UpdateMeetingRequest request = new UpdateMeetingRequest(
            LocalDate.now(), null, null, List.of(10), true, null, null);

        assertThatThrownBy(() -> service.updateMeeting(1L, request))
            .isInstanceOf(EntityNotFoundException.class);
    }
}
