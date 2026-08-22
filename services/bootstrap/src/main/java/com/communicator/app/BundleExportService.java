package com.communicator.app;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.demo.Group.GroupDTOs.GroupDTO;
import com.example.demo.Group.GroupEntities.SocialGroup;
import com.example.demo.Group.GroupServices.SocialGroupService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.communicator.meeting.dtos.MeetingExportRow;
import com.communicator.meeting.service.MeetingQueryService;

import communicate.Friend.DTOs.FriendDTO;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;
import communicate.Friend.FriendService.FriendService;
import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;

import coommunicator.connections.Connections.ConnectionsDTOs.ConnectionDTO;
import coommunicator.connections.Connections.ConnectionsEntities.Connection;
import coommunicator.connections.Connections.ConnectionService.ConnectionService;

/**
 * Periodically exports a read-model snapshot (friends/groups/connections/meetings/scheduling
 * presets) to Google Drive as one encrypted JSON file — the "T0" bundle shape from
 * docs/designs/offline-pwa-plan.md. This is the read-tier counterpart to
 * MailboxConsumeService's write-tier mailbox drain, and lives here for the exact same reason
 * that class does: it needs friend + group + connections + meeting data *and* backup's
 * Drive/encryption plumbing, and bootstrap already depends on all five modules — putting it in
 * {@code services/backup} instead would require backup's pom.xml to newly depend on four
 * business modules it deliberately has zero dependency on today (see backup/pom.xml's module
 * comment: backup only knows Postgres + Drive, never any domain entity). No new Maven edges
 * needed here.
 *
 * <p><b>"settings" in the plan doc's original JSON shape → {@code schedulingPresets} here:</b>
 * there is no unified app-level Settings entity to export — LLM keys (ai_agent/Python),
 * backup's own Drive-OAuth settings (communicate.backup.settings.SettingsService), and the
 * friend module's per-role FSRS scheduling presets (SchedulingRolePreset) are three unrelated
 * things. Only the scheduling presets are plausibly useful offline (LLM keys and Drive/OAuth
 * settings need the live server regardless), so that's the only slice bundled.
 *
 * <p><b>Consulted by:</b> the frontend's drivePull.ts, only when both the server and the local
 * IndexedDB cache miss (fresh install / evicted storage — see the plan doc's Architecture
 * section). It reads this file directly from Drive using the accessToken + encryptionKeyBase64
 * already handed out by {@code BackupController.syncBridge} (GET /backup/sync/bridge) — no new
 * REST endpoint was needed, the plan's assumption held. It should list/get by file name
 * ({@link #BUNDLE_FILE_NAME}) without needing a parent-folder id: {@code drive.file} OAuth
 * scope already limits what's visible to files this app created, so an unscoped
 * {@code name = '...' and trashed = false} query is sufficient (mirrors how driveClient.ts's
 * mailbox writes don't need the folder id echoed back either, beyond what syncBridge sends).
 *
 * <p><b>All-or-nothing:</b> if ANY entity query throws, the whole run is abandoned and nothing
 * is uploaded — a half-written bundle would be worse than a stale one, since drivePull.ts has
 * no way to distinguish "some entity types are missing because the export failed partway" from
 * "this install genuinely has zero groups." The previous bundle on Drive (if any) is left
 * untouched on failure. An {@link AtomicBoolean} guards against two overlapping runs — a
 * single-JVM in-memory lock, adequate for this single-tenant deployment (see bootstrap's
 * FLOWS.md "Single JVM, single point of failure" note) but not distributed-safe; that's fine,
 * there is only ever one JVM.
 *
 * <p><b>Timestamps:</b> Meeting has real createdAt/updatedAt (see MeetingQueryService's
 * MeetingExportRow); Friend/SocialGroup/Connection/SchedulingRolePreset do not, so their bundle
 * rows use the export's own timestamp as a stand-in "updatedAt". This is an accepted
 * approximation for a snapshot bundle (every non-Meeting row in one export always shares the
 * same updatedAt), not a correctness bug — flagged here rather than fixed, per this session's
 * decision.
 */
@Component
public class BundleExportService {

    private static final Logger log = LoggerFactory.getLogger(BundleExportService.class);
    private static final int BUNDLE_VERSION = 1;

    /** Root-folder filename — one refreshed copy per run, never versioned. Distinct from both
     * the timestamped {@code kind=db}/{@code kind=files} backups and the transient
     * {@code _mailbox} relay files (see DriveService.uploadOrReplace's doc). */
    public static final String BUNDLE_FILE_NAME = "offline-bundle.json.enc";
    private static final String BUNDLE_KIND = "offline-bundle";

    private final FriendService friendService;
    private final SocialGroupService groupService;
    private final ConnectionService connectionService;
    private final MeetingQueryService meetingQueryService;
    private final SchedulingRolePresetRepository presetRepository;
    private final DriveService driveService;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    // Package-private (not private) so BundleExportServiceTest can directly force the
    // "already running" branch without a real concurrent thread.
    final AtomicBoolean running = new AtomicBoolean(false);

    public BundleExportService(FriendService friendService, SocialGroupService groupService,
                                ConnectionService connectionService, MeetingQueryService meetingQueryService,
                                SchedulingRolePresetRepository presetRepository, DriveService driveService,
                                EncryptionService encryptionService, ObjectMapper objectMapper) {
        this.friendService = friendService;
        this.groupService = groupService;
        this.connectionService = connectionService;
        this.meetingQueryService = meetingQueryService;
        this.presetRepository = presetRepository;
        this.driveService = driveService;
        this.encryptionService = encryptionService;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        exportNow();
    }

    /** Default every 4h — configurable via {@code offline.bundle.export.interval-ms}. This is
     * the read tier's freshness ceiling: a device that falls back to the Drive bundle sees data
     * at most this stale (plus however long it's been since the device was last online at all). */
    @Scheduled(fixedDelayString = "${offline.bundle.export.interval-ms:14400000}")
    public void scheduledExport() {
        exportNow();
    }

    /** Runs the export synchronously. Returns false without uploading anything if: Drive/
     * encryption isn't configured yet, a run is already in progress, or any entity query
     * failed (see class doc's "all-or-nothing" note). Public so it can be triggered manually
     * (e.g. from a future admin action) or called directly from a test. */
    public boolean exportNow() {
        if (!driveService.isConfigured() || !encryptionService.isConfigured()) {
            log.debug("[BundleExport] Drive/encryption not configured — skipping");
            return false;
        }
        if (!running.compareAndSet(false, true)) {
            log.info("[BundleExport] export already in progress — skipping this trigger");
            return false;
        }
        try {
            OfflineBundle bundle = gather();
            byte[] json = objectMapper.writeValueAsBytes(bundle);
            byte[] encrypted = encryptionService.encrypt(json);
            driveService.uploadOrReplace(encrypted, BUNDLE_FILE_NAME, BUNDLE_KIND);
            log.info("[BundleExport] uploaded offline bundle ({} bytes encrypted)", encrypted.length);
            return true;
        } catch (Exception e) {
            log.warn("[BundleExport] export failed, nothing uploaded (previous bundle on Drive, "
                + "if any, is untouched): {}", e.getMessage());
            return false;
        } finally {
            running.set(false);
        }
    }

    /** Queries all five entity sources. Any failure here (a checked or unchecked exception from
     * any repository/service call) propagates straight out of {@link #exportNow}, which is what
     * makes the whole run abort instead of uploading a partial bundle. */
    private OfflineBundle gather() {
        String exportedAt = Instant.now().toString();

        List<BundleRow> friends = friendService.getAllFriends().stream()
            .map(f -> new BundleRow(f.getId(), toFriendDTO(f), exportedAt))
            .toList();

        List<BundleRow> groups = groupService.getAllGroups().stream()
            .map(g -> new BundleRow(g.getId(), toGroupDTO(g), exportedAt))
            .toList();

        List<BundleRow> connections = connectionService.getAll().stream()
            .map(c -> new BundleRow(connectionRowId(c), toConnectionDTO(c), exportedAt))
            .toList();

        List<BundleRow> meetings = meetingQueryService.allForExport().stream()
            .map(row -> new BundleRow(row.dto().id(), row.dto(),
                row.updatedAt() != null ? row.updatedAt().toString() : exportedAt))
            .toList();

        List<BundleRow> schedulingPresets = presetRepository.findAll().stream()
            .map(p -> new BundleRow(p.getRole(), p, exportedAt))
            .toList();

        Map<String, List<BundleRow>> entities = new LinkedHashMap<>();
        entities.put("friends", friends);
        entities.put("groups", groups);
        entities.put("connections", connections);
        entities.put("meetings", meetings);
        entities.put("schedulingPresets", schedulingPresets);
        return new OfflineBundle(BUNDLE_VERSION, exportedAt, entities);
    }

    // Same field-by-field mapping FriendController.getAllFriends() uses (isBirthdayThisWeek
    // hardcoded false there too — a derived/computed field, not stored data, out of scope for
    // a snapshot bundle). Kept in sync manually; no shared Friend->FriendDTO mapper exists yet.
    private static FriendDTO toFriendDTO(Friend f) {
        return new FriendDTO(f.getId(), f.getName(), f.getExperience(), f.getDateOfBirth(),
            f.getPlannedSpeakingTime(), f.getAverageFrequency(), f.getAverageDuration(),
            f.getAverageExcitement(), f.getAverageProximity(), false, f.getRole(),
            f.getSchedulingExplanation(), f.getLeech(), f.getFlashcardsEnabled());
    }

    private static GroupDTO toGroupDTO(SocialGroup g) {
        return new GroupDTO(g.getId(), g.getName(), g.getDescription());
    }

    private static ConnectionDTO toConnectionDTO(Connection c) {
        return new ConnectionDTO(c.getId().getFriend1Id(), c.getId().getFriend2Id(), c.getDescription(), c.getType());
    }

    // No surrogate id on Connection (composite PK) — synthesize a stable string id so this
    // entity type fits the same {id, data, updatedAt} row shape as the other four.
    private static String connectionRowId(Connection c) {
        return c.getId().getFriend1Id() + "_" + c.getId().getFriend2Id();
    }
}
