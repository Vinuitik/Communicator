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

export interface Connection {
    id: string;
    userId: string;
    friendId: string;
}

export interface ErrorResponse {
    error: string;
    status: number;
}