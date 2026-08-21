package com.communicator.app;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.services.drive.model.File;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendService.OutboxWriteService;
import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Covers MailboxConsumeService's partial-failure semantics (a file is deleted only once every
 * request inside it committed) and dispatch behavior — the part of the offline-outbox Drive
 * relay tier that, before this test, had only ever been exercised by one manual live-browser
 * session (see tasks/SYNC_ENGINE_TESTING_HANDOFF.md).
 */
@ExtendWith(MockitoExtension.class)
class MailboxConsumeServiceTest {

    @Mock DriveService driveService;
    @Mock EncryptionService encryptionService;
    @Mock OutboxWriteService outboxWriteService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private MailboxConsumeService service() {
        return new MailboxConsumeService(driveService, encryptionService, outboxWriteService, objectMapper);
    }

    private void configured() {
        when(driveService.isConfigured()).thenReturn(true);
        when(encryptionService.isConfigured()).thenReturn(true);
    }

    private File file(String id, String name) {
        return new File().setId(id).setName(name);
    }

    private byte[] batchJson(MailboxConsumeService.MailboxRequest... requests) throws Exception {
        return objectMapper.writeValueAsBytes(
            new MailboxConsumeService.MailboxBatch("device-1", List.of(requests)));
    }

    private MailboxConsumeService.MailboxRequest addFriendRequest() {
        return new MailboxConsumeService.MailboxRequest(null, "addFriend", null, Map.of("experience", "beginner"));
    }

    private MailboxConsumeService.MailboxRequest talkedToFriendRequest(int friendId) {
        return new MailboxConsumeService.MailboxRequest(null, "talkedToFriend", friendId, Map.of("experience", "expert"));
    }

    @Test
    void allRequestsSucceed_deletesFile() throws Exception {
        configured();
        File f = file("f1", "batch1.json.enc");
        byte[] encrypted = {1, 2, 3};
        when(driveService.listMailboxFiles()).thenReturn(List.of(f));
        when(driveService.downloadFile("f1")).thenReturn(encrypted);
        when(encryptionService.decrypt(encrypted)).thenReturn(batchJson(addFriendRequest()));

        service().consumeAll();

        verify(outboxWriteService).applyAddFriend(any(Friend.class), isNull());
        verify(driveService).deleteMailboxFile("f1");
    }

    @Test
    void oneRequestThrows_othersStillApplied_fileNotDeleted() throws Exception {
        configured();
        File f = file("f1", "batch1.json.enc");
        byte[] encrypted = {1};
        when(driveService.listMailboxFiles()).thenReturn(List.of(f));
        when(driveService.downloadFile("f1")).thenReturn(encrypted);
        when(encryptionService.decrypt(encrypted)).thenReturn(
            batchJson(addFriendRequest(), talkedToFriendRequest(7)));
        doThrow(new RuntimeException("boom")).when(outboxWriteService)
            .applyAddFriend(any(Friend.class), isNull());

        service().consumeAll();

        verify(outboxWriteService).applyAddFriend(any(Friend.class), isNull());
        verify(outboxWriteService).applyTalkedToFriend(eq(7), any(Friend.class), isNull());
        verify(driveService, never()).deleteMailboxFile(any());
    }

    @Test
    void unknownKind_doesNotFailBatch_fileStillDeleted() throws Exception {
        configured();
        File f = file("f1", "batch1.json.enc");
        byte[] encrypted = {1};
        MailboxConsumeService.MailboxRequest unknown =
            new MailboxConsumeService.MailboxRequest(null, "deleteEverything", null, Map.of());
        when(driveService.listMailboxFiles()).thenReturn(List.of(f));
        when(driveService.downloadFile("f1")).thenReturn(encrypted);
        when(encryptionService.decrypt(encrypted)).thenReturn(batchJson(unknown));

        service().consumeAll();

        verifyNoInteractions(outboxWriteService);
        verify(driveService).deleteMailboxFile("f1");
    }

    @Test
    void multipleFiles_processedInListOrder() throws Exception {
        configured();
        File f1 = file("f1", "a.json.enc");
        File f2 = file("f2", "b.json.enc");
        byte[] enc1 = {1};
        byte[] enc2 = {2};
        when(driveService.listMailboxFiles()).thenReturn(List.of(f1, f2));
        when(driveService.downloadFile("f1")).thenReturn(enc1);
        when(driveService.downloadFile("f2")).thenReturn(enc2);
        when(encryptionService.decrypt(enc1)).thenReturn(batchJson(talkedToFriendRequest(1)));
        when(encryptionService.decrypt(enc2)).thenReturn(batchJson(talkedToFriendRequest(2)));

        service().consumeAll();

        InOrder order = inOrder(outboxWriteService, driveService);
        order.verify(outboxWriteService).applyTalkedToFriend(eq(1), any(Friend.class), isNull());
        order.verify(driveService).deleteMailboxFile("f1");
        order.verify(outboxWriteService).applyTalkedToFriend(eq(2), any(Friend.class), isNull());
        order.verify(driveService).deleteMailboxFile("f2");
    }

    @Test
    void decryptThrows_leavesFileForNextPass_doesNotCrashOtherFiles() throws Exception {
        configured();
        File bad = file("f1", "corrupt.json.enc");
        File good = file("f2", "ok.json.enc");
        byte[] badBytes = {9};
        byte[] goodBytes = {2};
        when(driveService.listMailboxFiles()).thenReturn(List.of(bad, good));
        when(driveService.downloadFile("f1")).thenReturn(badBytes);
        when(driveService.downloadFile("f2")).thenReturn(goodBytes);
        when(encryptionService.decrypt(badBytes)).thenThrow(new RuntimeException("bad key"));
        when(encryptionService.decrypt(goodBytes)).thenReturn(batchJson(talkedToFriendRequest(2)));

        service().consumeAll();

        verify(driveService, never()).deleteMailboxFile("f1");
        verify(outboxWriteService).applyTalkedToFriend(eq(2), any(Friend.class), isNull());
        verify(driveService).deleteMailboxFile("f2");
    }

    @Test
    void emptyMailbox_noop() throws Exception {
        configured();
        when(driveService.listMailboxFiles()).thenReturn(List.of());

        service().consumeAll();

        verifyNoInteractions(outboxWriteService);
        verify(driveService, never()).deleteMailboxFile(any());
    }
}
