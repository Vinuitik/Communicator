export interface ApiResponse<T> {
    data: T;
    message: string;
    status: number;
}

// Mirrors friend/src/main/java/communicate/Friend/FriendEntities/Friend.java
// (only the fields the SPA currently reads/writes — the entity has more).
export interface Friend {
    id: number;
    name: string;
    relationshipType?: string;
    plannedSpeakingTime: string; // ISO date
    experience: string;
    dateOfBirth?: string | null; // ISO date
    knowledge?: FriendKnowledge[];
    analytics?: FriendAnalyticsEntry[];
    // Exponential moving averages, computed server-side by the chrono
    // service — drive the friends-list "intensity score" color.
    averageFrequency?: number;
    averageDuration?: number;
    averageExcitement?: number;
    // Only populated by GET /api/friend/thisWeek (FriendController.getWeekFriends) —
    // computed server-side against the current week's Mon-Sun window, not a stored field.
    isBirthdayThisWeek?: boolean;
}

// Mirrors FriendKnowledge.java — @JsonProperty renames text->fact, priority->importance.
export interface FriendKnowledge {
    id?: number;
    fact: string;
    importance: number;
}

// One "last time spoken" entry, as sent on friend creation (FriendController
// reads analytics[0].date to compute plannedSpeakingTime server-side).
export interface FriendAnalyticsEntry {
    date: string; // ISO date
    experience: string;
    hours: number;
}

// A stored Analytics row as returned by GET /api/friend/analyticsList
// (FriendAnalyticsController) — same fields as FriendAnalyticsEntry plus the
// row's own id, since this is the persisted entity, not a creation payload.
export interface AnalyticsRecord extends FriendAnalyticsEntry {
    id: number;
}

// Response shape from GET /api/friend/shortList (FriendController.getShortList)
// — mirrors the Java record ShortFriendDTO, used to populate the analytics
// page's friend picker without pulling full Friend objects.
export interface ShortFriend {
    id: number;
    name: string;
    averageFrequency?: number;
    averageDuration?: number;
    averageExcitement?: number;
}

// Body for POST /api/friend/addFriend. The endpoint returns plain text
// ("Friend added successfully!"), not the created Friend — see
// FriendController.addFriend.
export interface NewFriendPayload {
    name: string;
    plannedSpeakingTime: string; // required by @Valid even though the server recomputes it
    experience: string;
    dateOfBirth: string | null;
    analytics: FriendAnalyticsEntry[];
    knowledge: FriendKnowledge[];
}

// Mirrors group/.../GroupEntities/SocialGroup.java (only the fields the
// SPA currently reads/writes — the entity has more: permissions, socials).
export interface Group {
    id: number;
    name: string;
    description?: string;
    primaryPhotoId?: number;
}

// Body for POST /api/groups/create.
export interface CreateGroupPayload {
    name: string;
}

// Response shape from GroupApiController.createGroup — {success, message,
// group} on both success (201) and failure (400), not a bare Group.
export interface CreateGroupResponse {
    success: boolean;
    message: string;
    group?: Group;
}

// Response shape from GroupApiController.listGroups (GET /api/groups/list).
// Count maps are keyed by group id (JSON gives string keys even though the
// Java side is Map<Integer, Long>).
export interface GroupListResponse {
    success: boolean;
    groups: Group[];
    knowledgeCounts: Record<string, number>;
    permissionCounts: Record<string, number>;
}

// Response shape from GroupApiController.deleteGroup.
export interface DeleteGroupResponse {
    success: boolean;
    message: string;
}

// Response shape from GroupApiController.getGroupDetails (GET /api/groups/{id}).
export interface GetGroupResponse {
    success: boolean;
    group?: Group;
    message?: string;
}

// Shared shape across every fact/importance knowledge-like entity in the app —
// GroupKnowledge.java ("Notes"), GroupPermission.java ("Settings"), and
// FriendKnowledge.java (facts.html) all serialize to this same {id, fact,
// importance} wire shape (via @JsonProperty text->fact, priority->importance),
// even though they're three separate backend tables/endpoints. Drives every
// KnowledgeCrudPanel instance.
export interface KnowledgeCrudItem {
    id: number;
    fact: string;
    importance: number;
}

// Response shape from GroupApiController.getAllGroupKnowledge
// (GET /api/groups/getKnowledge/{groupId}).
export interface GetGroupKnowledgeResponse {
    success: boolean;
    knowledge: KnowledgeCrudItem[];
    message?: string;
}

// Response shape from GroupPermissionController.getAllGroupPermission
// (GET /api/groups/permission/getPermission/{groupId}).
export interface GetGroupPermissionResponse {
    success: boolean;
    permission: KnowledgeCrudItem[];
    message?: string;
}

export interface Connection {
    id: string;
    userId: string;
    friendId: string;
}

export interface ErrorResponse {
    error: string;
    status: number;
}

// ── Settings (settings.html port) ──────────────────────────────────────────

export const KNOWN_PROVIDERS = ['gemini', 'github', 'mistral', 'groq', 'deepseek', 'anthropic'] as const;
export type LlmProvider = typeof KNOWN_PROVIDERS[number];

// Response shape from ai_agent's GET /settings/llm (routers/settings.py).
export interface LlmSettings {
    mode: 'ollama' | 'cloud';
    providers: Record<string, boolean>;
}

// Response shape from GET /settings/llm/host-wrapper-status.
export interface HostWrapperStatus {
    reachable: boolean;
    error?: string;
    providers?: Record<string, { configured: boolean }>;
}

// Response shape from backup service's GET /backup/status
// (BackupController.status) — fields are only meaningful once clientConfigured
// && connected are both true; see SettingsPage for the gating logic.
export interface BackupStatus {
    clientConfigured: boolean;
    connected: boolean;
    accountEmail?: string | null;
    enabled: boolean;
    running?: boolean;
    phase?: string;
    lastRunAt?: string | null;
    lastResult?: string;
    db?: { exists: boolean };
    quota?: { usage: number; limit?: number };
    quotaError?: string;
}