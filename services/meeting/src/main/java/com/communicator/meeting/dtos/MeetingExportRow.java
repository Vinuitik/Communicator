package com.communicator.meeting.dtos;

import java.time.LocalDateTime;

/**
 * MeetingDTO + the entity's updatedAt, for the offline-bundle export only (see
 * MeetingQueryService.allForExport() / BundleExportService in bootstrap). Kept as a separate
 * shape rather than adding updatedAt to MeetingDTO itself — MeetingDTO is a public read
 * contract other callers (HomePage, ProfilePage) already depend on, and every other caller
 * of MeetingDTO.from() would need updating for a field none of them need.
 */
public record MeetingExportRow(MeetingDTO dto, LocalDateTime updatedAt) {
}
