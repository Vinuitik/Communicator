import {
    CreateGroupPayload, CreateGroupResponse, GroupListResponse, DeleteGroupResponse,
    Group, GetGroupResponse, GroupCrudItem, GetGroupKnowledgeResponse, GetGroupPermissionResponse,
} from '../../types/api';
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

// Added for GroupDetailsPage — GroupApiController.getGroupDetails already
// existed (GroupsPage's row-click just never linked to a page that called it;
// see PROTO.md's GroupDetailsPage note for why that page was dead until now).
export const getGroup = async (groupId: number): Promise<Group> => {
    const response = await fetch(`${API_URL}/${groupId}`);
    const data: GetGroupResponse = await response.json();
    if (!response.ok || !data.success || !data.group) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.group;
};

export const getGroupKnowledge = async (groupId: number): Promise<GroupCrudItem[]> => {
    const response = await fetch(`${API_URL}/getKnowledge/${groupId}`);
    const data: GetGroupKnowledgeResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.knowledge;
};

export const addGroupKnowledge = async (groupId: number, fact: string, importance: number): Promise<void> => {
    const response = await fetch(`${API_URL}/addKnowledge/${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ fact, importance }]),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const deleteGroupKnowledge = async (knowledgeId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/deleteKnowledge/${knowledgeId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

// "Settings" in the legacy template — GroupPermission.java, same shape and
// controller pattern as GroupKnowledge, just a separate table/endpoint
// (GroupPermissionController, mounted at /api/groups/permission/...).
export const getGroupPermissions = async (groupId: number): Promise<GroupCrudItem[]> => {
    const response = await fetch(`${API_URL}/permission/getPermission/${groupId}`);
    const data: GetGroupPermissionResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.permission;
};

export const addGroupPermission = async (groupId: number, fact: string, importance: number): Promise<void> => {
    const response = await fetch(`${API_URL}/permission/addPermission/${groupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ fact, importance }]),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const deleteGroupPermission = async (permissionId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/permission/deletePermission/${permissionId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};
