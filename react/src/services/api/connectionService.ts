import {
    Connection, CreateConnectionPayload, ConnectionResponse, ConnectionListResponse,
    DeleteConnectionResponse, KnowledgeCrudItem, GetConnectionKnowledgeResponse,
    GetConnectionPermissionResponse,
} from '../../types/api';
import { API_BASE } from './config';

const API_URL = API_BASE.CONNECTIONS;

export const getConnections = async (): Promise<Connection[]> => {
    const response = await fetch(`${API_URL}/list`);
    const data: ConnectionListResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.connections;
};

export const getConnectionsForFriend = async (friendId: number): Promise<Connection[]> => {
    const response = await fetch(`${API_URL}/friend/${friendId}`);
    const data: ConnectionListResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.connections;
};

export const getConnection = async (friend1Id: number, friend2Id: number): Promise<Connection> => {
    const response = await fetch(`${API_URL}/${friend1Id}/${friend2Id}`);
    const data: ConnectionResponse = await response.json();
    if (!response.ok || !data.success || !data.connection) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.connection;
};

export const createConnection = async (payload: CreateConnectionPayload): Promise<Connection> => {
    const response = await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data: ConnectionResponse = await response.json();
    if (!response.ok || !data.success || !data.connection) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.connection;
};

export const deleteConnection = async (friend1Id: number, friend2Id: number): Promise<DeleteConnectionResponse> => {
    const response = await fetch(`${API_URL}/${friend1Id}/${friend2Id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    const data: DeleteConnectionResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data;
};

export const getConnectionKnowledge = async (friend1Id: number, friend2Id: number): Promise<KnowledgeCrudItem[]> => {
    const response = await fetch(`${API_URL}/getKnowledge/${friend1Id}/${friend2Id}`);
    const data: GetConnectionKnowledgeResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.knowledge;
};

export const addConnectionKnowledge = async (friend1Id: number, friend2Id: number, fact: string, importance: number): Promise<void> => {
    const response = await fetch(`${API_URL}/addKnowledge/${friend1Id}/${friend2Id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ fact, importance }]),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const deleteConnectionKnowledge = async (knowledgeId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/deleteKnowledge/${knowledgeId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const getConnectionPermissions = async (friend1Id: number, friend2Id: number): Promise<KnowledgeCrudItem[]> => {
    const response = await fetch(`${API_URL}/permission/getPermission/${friend1Id}/${friend2Id}`);
    const data: GetConnectionPermissionResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data.permission;
};

export const addConnectionPermission = async (friend1Id: number, friend2Id: number, fact: string, importance: number): Promise<void> => {
    const response = await fetch(`${API_URL}/permission/addPermission/${friend1Id}/${friend2Id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ fact, importance }]),
    });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};

export const deleteConnectionPermission = async (permissionId: number): Promise<void> => {
    const response = await fetch(`${API_URL}/permission/deletePermission/${permissionId}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }
};
