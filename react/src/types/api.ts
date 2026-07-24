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

export interface Group {
    id: string;
    name: string;
    members: Friend[];
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