package com.communicator.app;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.SocialGroupService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.communicator.meeting.dtos.MeetingDTO;
import com.communicator.meeting.dtos.MeetingExportRow;
import com.communicator.meeting.entities.MeetingSource;
import com.communicator.meeting.entities.MeetingStatus;
import com.communicator.meeting.entities.MeetingType;
import com.communicator.meeting.service.MeetingQueryService;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;
import communicate.Friend.FriendService.FriendService;
import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;

import coommunicator.connections.Connections.ConnectionService.ConnectionService;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionsEntities.ConnectionType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Covers BundleExportService's three risk areas per the task: a correct happy-path bundle
 * shape, the all-or-nothing guarantee (one entity query throwing must never ship a partial
 * bundle to Drive), and the overlapping-run guard.
 */
@ExtendWith(MockitoExtension.class)
class BundleExportServiceTest {

    @Mock FriendService friendService;
    @Mock SocialGroupService groupService;
    @Mock ConnectionService connectionService;
    @Mock MeetingQueryService meetingQueryService;
    @Mock SchedulingRolePresetRepository presetRepository;
    @Mock DriveService driveService;
    @Mock EncryptionService encryptionService;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    private BundleExportService service() {
        return new BundleExportService(friendService, groupService, connectionService,
            meetingQueryService, presetRepository, driveService, encryptionService, objectMapper);
    }

    private void configured() {
        when(driveService.isConfigured()).thenReturn(true);
        when(encryptionService.isConfigured()).thenReturn(true);
    }

    private Friend friend(int id) {
        Friend f = new Friend();
        f.setId(id);
        f.setName("Alice");
        return f;
    }

    private SocialGroup group(int id) {
        return SocialGroup.builder().id(id).name("Book Club").description("Weekly").build();
    }

    private Connection connection(long a, long b) {
        Connection c = new Connection(a, b);
        c.setDescription("met at work");
        c.setType(ConnectionType.FRIENDSHIP);
        return c;
    }

    private MeetingExportRow meetingRow(long id) {
        MeetingDTO dto = new MeetingDTO(id, MeetingType.FRIEND, 1, "Alice", null, null, null, null,
            null, null, null, true, List.of(), MeetingSource.MANUAL, MeetingStatus.DONE, null, null);
        return new MeetingExportRow(dto, LocalDateTime.of(2026, 8, 1, 12, 0));
    }

    private SchedulingRolePreset preset() {
        return new SchedulingRolePreset("acquaintance", 0.85, 90);
    }

    // ── Happy path ──────────────────────────────────────────────────────────────

    @Test
    void allQueriesSucceed_uploadsEncryptedBundleWithAllFiveEntityTypes() throws Exception {
        configured();
        when(friendService.getAllFriends()).thenReturn(List.of(friend(1)));
        when(groupService.getAllGroups()).thenReturn(List.of(group(2)));
        when(connectionService.getAll()).thenReturn(List.of(connection(1L, 3L)));
        when(meetingQueryService.allForExport()).thenReturn(List.of(meetingRow(9L)));
        when(presetRepository.findAll()).thenReturn(List.of(preset()));
        byte[] encrypted = {7, 7, 7};
        when(encryptionService.encrypt(any())).thenReturn(encrypted);

        boolean result = service().exportNow();

        assertThat(result).isTrue();
        verify(driveService).uploadOrReplace(encrypted, BundleExportService.BUNDLE_FILE_NAME, "offline-bundle");

        // Verify the plaintext handed to encrypt() actually has the T0 shape (bundleVersion,
        // exportedAt, entities.{friends,groups,connections,meetings,schedulingPresets}).
        var captor = org.mockito.ArgumentCaptor.forClass(byte[].class);
        verify(encryptionService).encrypt(captor.capture());
        var json = objectMapper.readTree(captor.getValue());
        assertThat(json.get("bundleVersion").asInt()).isEqualTo(1);
        assertThat(json.get("exportedAt").asText()).isNotBlank();
        var entities = json.get("entities");
        assertThat(entities.get("friends")).hasSize(1);
        assertThat(entities.get("groups")).hasSize(1);
        assertThat(entities.get("connections")).hasSize(1);
        assertThat(entities.get("meetings")).hasSize(1);
        assertThat(entities.get("schedulingPresets")).hasSize(1);
        assertThat(entities.get("connections").get(0).get("id").asText()).isEqualTo("1_3");
        assertThat(entities.get("meetings").get(0).get("updatedAt").asText()).contains("2026-08-01");
    }

    @Test
    void notConfigured_doesNotQueryAnythingOrUpload() {
        when(driveService.isConfigured()).thenReturn(false);

        boolean result = service().exportNow();

        assertThat(result).isFalse();
        verifyNoInteractions(friendService, groupService, connectionService, meetingQueryService, presetRepository);
    }

    // ── All-or-nothing on partial failure ──────────────────────────────────────

    @Test
    void oneEntityQueryThrows_abortsRun_neverUploads() throws Exception {
        configured();
        when(friendService.getAllFriends()).thenReturn(List.of(friend(1)));
        when(groupService.getAllGroups()).thenThrow(new RuntimeException("DB hiccup"));

        boolean result = service().exportNow();

        assertThat(result).isFalse();
        verify(driveService, never()).uploadOrReplace(any(), anyString(), anyString());
        verify(encryptionService, never()).encrypt(any()); // never even builds/encrypts a partial payload
    }

    @Test
    void encryptionThrows_neverUploads() throws Exception {
        configured();
        when(friendService.getAllFriends()).thenReturn(List.of());
        when(groupService.getAllGroups()).thenReturn(List.of());
        when(connectionService.getAll()).thenReturn(List.of());
        when(meetingQueryService.allForExport()).thenReturn(List.of());
        when(presetRepository.findAll()).thenReturn(List.of());
        when(encryptionService.encrypt(any())).thenThrow(new RuntimeException("key not ready"));

        boolean result = service().exportNow();

        assertThat(result).isFalse();
        verify(driveService, never()).uploadOrReplace(any(), anyString(), anyString());
    }

    // ── Overlapping-run guard ───────────────────────────────────────────────────

    @Test
    void alreadyRunning_skipsWithoutTouchingAnything() throws Exception {
        configured();
        BundleExportService svc = service();
        svc.running.set(true); // simulate a run already in flight

        boolean result = svc.exportNow();

        assertThat(result).isFalse();
        verify(driveService, never()).uploadOrReplace(any(), anyString(), anyString());
        verifyNoInteractions(friendService, groupService, connectionService, meetingQueryService, presetRepository);
    }

    @Test
    void runResetsGuard_soASubsequentCallCanProceed() throws Exception {
        configured();
        when(friendService.getAllFriends()).thenReturn(List.of());
        when(groupService.getAllGroups()).thenReturn(List.of());
        when(connectionService.getAll()).thenReturn(List.of());
        when(meetingQueryService.allForExport()).thenReturn(List.of());
        when(presetRepository.findAll()).thenReturn(List.of());
        when(encryptionService.encrypt(any())).thenReturn(new byte[]{1});
        BundleExportService svc = service();

        svc.exportNow();
        boolean second = svc.exportNow();

        assertThat(second).isTrue();
        assertThat(svc.running.get()).isFalse();
    }

    @Test
    void failedRun_alsoResetsGuard() throws Exception {
        configured();
        when(friendService.getAllFriends()).thenThrow(new RuntimeException("boom"));
        BundleExportService svc = service();

        svc.exportNow();

        assertThat(svc.running.get()).isFalse();
    }
}
