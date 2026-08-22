package com.communicator.app;

import java.util.List;
import java.util.Map;

/**
 * The whole offline-bundle payload, verbatim to the "T0" JSON shape in
 * docs/designs/offline-pwa-plan.md — {@code entities} keys are "friends", "groups",
 * "connections", "meetings", "schedulingPresets" (this last one replaces the plan's original
 * generic "settings" key: there is no unified app-Settings entity, see BundleExportService's
 * class doc). Encrypted whole (not per-row) by EncryptionService before upload.
 */
public record OfflineBundle(int bundleVersion, String exportedAt, Map<String, List<BundleRow>> entities) {
}
