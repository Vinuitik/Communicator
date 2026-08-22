package com.communicator.app;

/**
 * One row inside an offline-bundle entity list — see BundleExportService and the "T0" JSON
 * shape in docs/designs/offline-pwa-plan.md. {@code id} is deliberately {@code Object}: it's
 * an Integer for friends/groups, a Long for meetings, and a synthesized String for
 * connections/schedulingPresets (neither has a single surrogate id) — one row shape covers
 * every entity type, Jackson serializes whatever's actually there.
 */
public record BundleRow(Object id, Object data, String updatedAt) {
}
