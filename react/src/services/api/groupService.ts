import { Group, CreateGroupPayload, CreateGroupResponse } from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.GROUPS;

// Mirrors nginx/static/createGroup/createGroup.js. Returns {success,message,group}
// on both success and failure — see GroupApiController.createGroup.
export const createGroup = async (payload: CreateGroupPayload): Promise<CreateGroupResponse> => {
    const response = await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data: CreateGroupResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data;
};

// TODO(GroupsPage port): wire to GET `${API_URL}/` (see nginx/static/groupsView/groupsView.js).
export const getGroups = async (): Promise<Group[]> => {
    return [];
};

// TODO(GroupsPage port): wire to DELETE `${API_URL}/{id}`.
export const deleteGroup = async (groupId: number): Promise<void> => {
    console.log('Delete group:', groupId);
};
