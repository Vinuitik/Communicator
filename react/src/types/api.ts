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

// A friend's social/contact link. Mirrors SocialController's responses —
// note the wire property is lowercase "url" despite the Java field being
// named `URL` (Social.java/SocialDTO.java) and the legacy frontend sending
// "URL"; see friendService.ts's social functions for why that distinction
// matters.
export interface Social {
    id: number;
    url: string;
    platform: string;
    displayName?: string;
}

export interface SocialPayload {
    url: string;
    platform: string;
    displayName?: string;
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

// ── Profile (profile.html port) ────────────────────────────────────────────

// Response shape from FriendController.getProfileData (GET /api/friend/profile/{id}/data) —
// JSON twin of WebController.profile's Thymeleaf model, resolved server-side
// (mainPhotoName comes from the friend's primaryPhotoId, already looked up).
export interface FriendProfileData {
    id: number;
    name: string;
    relationshipType: string | null;
    dateMet: string | null;
    mainPhotoName: string | null;
}

// Mirrors Photos.java (only the fields the SPA reads — @JsonBackReference
// hides the `friend` field from the wire).
export interface MediaPhoto {
    id: number;
    photoName: string;
    mimeType?: string;
    timeBuilt?: string;
}

// Mirrors Videos.java.
export interface MediaVideo {
    id: number;
    videoName: string;
    mimeType?: string;
    timeBuilt?: string;
}

// Mirrors PersonalResource.java.
export interface MediaResource {
    id: number;
    resourceName: string;
    mimeType: string;
    timeBuilt?: string;
}

// Response shape from FileController.getFileUploadPage
// (GET /api/friend/files/{friendId}/page/{pageId}) — mirrors PaginationDTO.java.
// currentPage is 1-indexed on the wire (PaginationLogicService's own convention).
export interface MediaPageResponse {
    photos: MediaPhoto[];
    videos: MediaVideo[];
    resources: MediaResource[];
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
}

export type MediaType = 'photo' | 'video' | 'resource';

// Response shape from FriendController.getPrimaryPhoto (GET /api/friend/{friendId}/primary-photo).
export interface PrimaryPhotoResponse {
    primaryPhotoId: number | null;
}

// One fact in ai_agent's knowledge summary response (routers/knowledge.py).
// stability_score is 0-1 (rendered as a confidence percentage); references
// are the supporting knowledge-base chunks the summarizer drew from.
export interface KnowledgeSummaryFact {
    key: string;
    value: string;
    stability_score?: number;
    references?: KnowledgeSummaryReference[];
}

export interface KnowledgeSummaryReference {
    chunk_text?: string;
    relevance_score: number;
}

// Response shape from POST /api/ai/knowledge/summarize.
export interface KnowledgeSummaryResponse {
    friend_id: number;
    facts: KnowledgeSummaryFact[];
    fact_count: number;
    last_updated: string;
}

// One frame of the AI chat websocket protocol (ai_agent/routers/chat.py,
// models.schemas.WebSocketMessage) — a state machine, not one blob:
// thinking → agent started reasoning; tool_call/tool_result → an agent tool
// invocation and its result; trace → raw LLM thought (debug only); token →
// a streamed answer delta; ai_response → the terminal complete answer;
// error → failure. See utils/aiChatSocket.ts.
export interface AiChatFrame {
    type: 'thinking' | 'tool_call' | 'tool_result' | 'trace' | 'token' | 'ai_response' | 'error';
    content?: string;
    name?: string;
    data?: unknown;
    phase?: string;
}

// One turn of the client-owned chat transcript (sessionStorage-persisted,
// replayed to the stateless server every message — see AiChatWidget).
export interface AiChatMessage {
    role: 'user' | 'assistant';
    content: string;
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