import { Friend, NewFriendPayload } from '../../types/api';
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

export const removeFriend = async (friendId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/deleteFriend/${friendId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};