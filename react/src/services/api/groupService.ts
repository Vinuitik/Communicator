import { CreateGroupPayload, CreateGroupResponse, GroupListResponse, DeleteGroupResponse } from '../../types/api';
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

// Hits the new GET /api/groups/list endpoint (added alongside this page —
// no JSON list endpoint existed before; GET / only rendered the Thymeleaf view).
export const getGroups = async (): Promise<GroupListResponse> => {
    const response = await fetch(`${API_URL}/list`);
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
    return response.json();
};

export const deleteGroup = async (groupId: number): Promise<DeleteGroupResponse> => {
    const response = await fetch(`${API_URL}/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    const data: DeleteGroupResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data;
};
