// filepath: c:\Users\ACER\Desktop\Java\Communicator\react\src\services\api\friendService.ts
import { Friend } from '../../types/api';

const API_URL = '/api/friend';

export const getFriends = async (): Promise<Friend[]> => {
    // Placeholder implementation - replace with actual API call later
    return [];
};

export const addFriend = async (friend: Friend): Promise<Friend> => {
    // Placeholder implementation - replace with actual API call later
    return { ...friend, id: friend.id || '1' };
};

export const removeFriend = async (friendId: string): Promise<void> => {
    // Placeholder implementation - replace with actual API call later
    console.log('Remove friend:', friendId);
};