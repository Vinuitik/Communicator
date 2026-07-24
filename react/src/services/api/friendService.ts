import { Friend, NewFriendPayload, KnowledgeCrudItem, ShortFriend, AnalyticsRecord } from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.FRIEND;

// page is 0-indexed, matching the backend endpoint directly (HomePage passes page-1).
export const getFriendsPage = async (page: number, size: number): Promise<Friend[]> => {
    const response = await fetch(`${API_URL}/friends/ui/page/${page}/size/${size}`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const getFriendsCount = async (): Promise<number> => {
    const response = await fetch(`${API_URL}/friends/count`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const getFriendsThisWeek = async (): Promise<Friend[]> => {
    const response = await fetch(`${API_URL}/thisWeek`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

// Added for the talkedForm SPA port — FriendController.getFriend (GET /api/friend/{id}),
// mirrors what WebController's Thymeleaf /talked/{id} used to bind into the template.
export const getFriend = async (friendId: number): Promise<Friend> => {
    const response = await fetch(`${API_URL}/${friendId}`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

// Mirrors nginx/static/addFriendForm/addForm.js. The endpoint returns plain
// text on success/failure, not the created Friend — see FriendController.addFriend.
export const addFriend = async (payload: NewFriendPayload): Promise<void> => {
    const response = await fetch(`${API_URL}/addFriend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
};

// Mirrors nginx/static/updateForm/talkedForm.js. The endpoint returns plain
// text, not the updated Friend — see FriendController.updateFriend.
export const talkedToFriend = async (friendId: number, payload: NewFriendPayload): Promise<void> => {
    const response = await fetch(`${API_URL}/talkedToFriend/${friendId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
};

export const removeFriend = async (friendId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/deleteFriend/${friendId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

// Added for the facts.html SPA port. FriendKnowledgeController.getKnowledgePaginatedCustomSize
// (GET /api/friend/getKnowledge/{friendId}/page/{page}/size/{size}) already returns exactly the
// {id, fact, importance} shape we need (it exists for the MCP/AI server) — reused here with a
// large size instead of adding a new endpoint, since this app's per-friend fact counts are small
// enough that real pagination isn't worth the UI complexity (matches the same call GroupDetailsPage
// made for group knowledge/settings).
export const getFriendKnowledge = async (friendId: number): Promise<KnowledgeCrudItem[]> => {
    const response = await fetch(`${API_URL}/getKnowledge/${friendId}/page/0/size/1000`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const addFriendKnowledgeItem = async (friendId: number, fact: string, importance: number): Promise<void> => {
    const response = await fetch(`${API_URL}/addKnowledge/${friendId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ fact, importance }]),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const deleteFriendKnowledgeItem = async (knowledgeId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/deleteKnowledge/${knowledgeId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

// Added for the analytics.html SPA port — populates the friend picker
// without pulling every field of every Friend. FriendController.getShortList
// already existed and returns exactly this shape.
export const getShortFriendList = async (): Promise<ShortFriend[]> => {
    const response = await fetch(`${API_URL}/shortList`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

// Mirrors nginx/static/analytics/analytics.js's fetch to /analyticsList.
// FriendAnalyticsController.getAnalyticsList already existed — left/right are
// LocalDate query params (yyyy-MM-dd), inclusive on both ends server-side.
export const getFriendAnalytics = async (friendId: number, left: string, right: string): Promise<AnalyticsRecord[]> => {
    const response = await fetch(`${API_URL}/analyticsList?friendId=${friendId}&left=${left}&right=${right}`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};