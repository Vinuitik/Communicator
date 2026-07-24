import { Friend, NewFriendPayload } from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.FRIEND;

// TODO(FriendsPage port): wire to GET `${API_URL}/friends/ui/page/{page}/size/{size}`
// (see nginx/static/mainPage/index.js) once that page is ported.
export const getFriends = async (): Promise<Friend[]> => {
    return [];
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

// TODO(FriendsPage port): wire to DELETE `${API_URL}/deleteFriend/{id}`.
export const removeFriend = async (friendId: string): Promise<void> => {
    console.log('Remove friend:', friendId);
};