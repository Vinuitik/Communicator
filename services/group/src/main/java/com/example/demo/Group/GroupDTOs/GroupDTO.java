package com.example.demo.Group.GroupDTOs;

/**
 * Minimal flat read view of a SocialGroup — mirrors friend module's FriendDTO pattern.
 * Added for the offline-bundle export (see BundleExportService in bootstrap); no controller
 * used a group DTO before this (GroupApiController serializes SocialGroup entities directly),
 * so this is intentionally small — just what the bundle needs, not a general-purpose DTO.
 */
public record GroupDTO(Integer id, String name, String description) {
}
