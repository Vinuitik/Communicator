package coommunicator.connections.Connections.ConnectionsDTOs;

import coommunicator.connections.Connections.ConnectionsEntities.ConnectionType;

/**
 * Minimal flat read view of a Connection — mirrors friend module's FriendDTO pattern.
 * Added for the offline-bundle export (see BundleExportService in bootstrap); no controller
 * used a connection DTO before this. friend1Id/friend2Id are always (min, max) ordered, same
 * as the entity's ConnectionId (see ConnectionService.idFor) — there is no single surrogate id,
 * so BundleExportService synthesizes a "{friend1Id}_{friend2Id}" string as the bundle row id.
 */
public record ConnectionDTO(Long friend1Id, Long friend2Id, String description, ConnectionType type) {
}
