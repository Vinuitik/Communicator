export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8090/api';

export const fetchFriends = async () => {
    const response = await fetch(`${API_BASE_URL}/friend/`);
    if (!response.ok) {
        throw new Error('Failed to fetch friends');
    }
    return response.json();
};

export const fetchGroups = async () => {
    const response = await fetch(`${API_BASE_URL}/groups/`);
    if (!response.ok) {
        throw new Error('Failed to fetch groups');
    }
    return response.json();
};

export const fetchConnections = async () => {
    const response = await fetch(`${API_BASE_URL}/connections/`);
    if (!response.ok) {
        throw new Error('Failed to fetch connections');
    }
    return response.json();
};