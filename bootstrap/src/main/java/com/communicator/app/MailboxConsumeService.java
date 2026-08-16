package com.communicator.app;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.services.drive.model.File;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendService.OutboxWriteService;
import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;

/**
 * Server-side drain for the offline-outbox's Drive relay tier. Lists every file in the
 * "_mailbox" Drive folder (each one a batch of writes the browser encrypted and pushed while
 * the server was unreachable — react/src/pwa/driveClient.ts), decrypts it with the same
 * EncryptionService key the bridge endpoint handed out, and replays each request through
 * OutboxWriteService — the exact same path FriendController/FriendKnowledgeController use, so
 * the idempotency ledger (ConsumedWriteRequest) is one mechanism shared by both replay routes.
 *
 * <p>Lives in bootstrap (not friend or backup) because it needs both modules and bootstrap
 * already depends on both — no new inter-module Maven dependency needed.
 *
 * <p>Single-tenant simplification vs. the ported designs (habitTracker/ObsidianOptimizer): no
 * per-user loop, no {@code SecurityContext}-dependent {@code ...ForUser(userId, ...)} overloads
 * — this app has no auth at all, so OutboxWriteService's methods are already safe to call from
 * this background thread as-is.
 *
 * <p>Delete-after-all-committed: a file is removed only once every request inside it succeeded.
 * A partial failure leaves the whole file for the next pass — safe, because the ledger makes
 * re-consuming already-applied requests a no-op. A request that fails on every pass (e.g. its
 * target friend was deleted) loops forever; acceptable at this scale, flagged (not fixed) the
 * same way both source projects flagged it.
 */
@Component
public class MailboxConsumeService {

    private static final Logger log = LoggerFactory.getLogger(MailboxConsumeService.class);

    private final DriveService driveService;
    private final EncryptionService encryptionService;
    private final OutboxWriteService outboxWriteService;
    private final ObjectMapper objectMapper;

    public MailboxConsumeService(DriveService driveService, EncryptionService encryptionService,
                                  OutboxWriteService outboxWriteService, ObjectMapper objectMapper) {
        this.driveService = driveService;
        this.encryptionService = encryptionService;
        this.outboxWriteService = outboxWriteService;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        consumeAll();
    }

    /** Scheduled top-up — the on-boot listener above is what actually matters for a
     * frequently-off self-hosted server; this just catches writes relayed while the
     * server has been up and running for a while. */
    @Scheduled(fixedDelay = 15 * 60 * 1000)
    public void scheduledConsume() {
        consumeAll();
    }

    public synchronized void consumeAll() {
        if (!driveService.isConfigured() || !encryptionService.isConfigured()) return;
        try {
            List<File> files = driveService.listMailboxFiles();
            for (File f : files) {
                consumeFile(f);
            }
        } catch (Exception e) {
            log.warn("[Mailbox] failed to list mailbox files: {}", e.getMessage());
        }
    }

    private void consumeFile(File f) {
        try {
            byte[] encrypted = driveService.downloadFile(f.getId());
            byte[] plain = encryptionService.decrypt(encrypted);
            MailboxBatch batch = objectMapper.readValue(plain, MailboxBatch.class);

            boolean allCommitted = true;
            for (MailboxRequest req : batch.requests()) {
                try {
                    dispatch(req);
                } catch (Exception e) {
                    allCommitted = false;
                    log.warn("[Mailbox] request failed, leaving file for next pass: kind={} error={}",
                        req.kind(), e.getMessage());
                }
            }

            if (allCommitted) {
                driveService.deleteMailboxFile(f.getId());
                log.info("[Mailbox] consumed and deleted {}", f.getName());
            }
        } catch (Exception e) {
            log.warn("[Mailbox] failed to consume {}: {}", f.getName(), e.getMessage());
        }
    }

    private void dispatch(MailboxRequest req) throws Exception {
        UUID requestId = (req.requestId() == null || req.requestId().isBlank())
            ? null : UUID.fromString(req.requestId());

        switch (req.kind()) {
            case "talkedToFriend" -> outboxWriteService.applyTalkedToFriend(
                req.friendId(), objectMapper.convertValue(req.payload(), Friend.class), requestId);
            case "addFriend" -> outboxWriteService.applyAddFriend(
                objectMapper.convertValue(req.payload(), Friend.class), requestId);
            case "addKnowledge" -> outboxWriteService.applyAddKnowledge(
                req.friendId(), objectMapper.convertValue(req.payload(), new TypeReference<List<FriendKnowledge>>() {}), requestId);
            default -> log.warn("[Mailbox] unknown write kind '{}', skipping", req.kind());
        }
    }

    // Wire format produced by react/src/pwa/driveClient.ts's pushBatch().
    record MailboxBatch(String deviceId, List<MailboxRequest> requests) {}
    record MailboxRequest(String requestId, String kind, Integer friendId, Object payload) {}
}
