import { BackupStatus, HostWrapperStatus, LlmSettings } from '../../types/api';
import { API_BASE } from './config';

// Mirrors nginx/static/settings/settings.js. Two separate backend services
// behind two separate base paths — LLM mode/keys live in ai_agent
// (routers/settings.py), backup/restore lives in the Java `backup` service.
const LLM_API = `${API_BASE.AI}/settings/llm`;
const BACKUP_API = API_BASE.BACKUP;

export const getLlmSettings = async (): Promise<LlmSettings> => {
    const response = await fetch(LLM_API);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

export const setLlmMode = async (mode: 'ollama' | 'cloud'): Promise<void> => {
    const response = await fetch(`${LLM_API}/mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

export const saveProviderKey = async (provider: string, apiKey: string): Promise<void> => {
    const response = await fetch(`${LLM_API}/providers/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${response.status}`);
    }
};

export const removeProviderKey = async (provider: string): Promise<void> => {
    const response = await fetch(`${LLM_API}/providers/${provider}`, { method: 'DELETE' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

// Never throws — an unreachable host-wrapper is a valid, displayable state,
// not an error, matching settings.js's own try/catch-to-state pattern.
export const checkHostWrapperStatus = async (): Promise<HostWrapperStatus> => {
    try {
        const response = await fetch(`${LLM_API}/host-wrapper-status`);
        return await response.json();
    } catch (err) {
        return { reachable: false, error: err instanceof Error ? err.message : String(err) };
    }
};

export const getBackupStatus = async (): Promise<BackupStatus> => {
    const response = await fetch(`${BACKUP_API}/status`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
};

export const disconnectDrive = async (): Promise<void> => {
    const response = await fetch(`${BACKUP_API}/disconnect`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

export const setBackupEnabled = async (value: boolean): Promise<void> => {
    const response = await fetch(`${BACKUP_API}/enabled?value=${value}`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
};

// 202 = started, 409 = already running (not an error — caller checks status).
export const runBackup = async (): Promise<{ started: boolean; reason?: string }> => {
    const response = await fetch(`${BACKUP_API}/run`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
        return { started: false, reason: 'A backup is already running.' };
    }
    if (!response.ok) {
        throw new Error(data.reason || `HTTP ${response.status}`);
    }
    return { started: true };
};

export const restoreBackup = async (): Promise<{ started: boolean; reason?: string }> => {
    const response = await fetch(`${BACKUP_API}/restore?force=true`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
        return { started: false, reason: 'A backup/restore is already running.' };
    }
    if (!response.ok) {
        throw new Error(data.reason || `HTTP ${response.status}`);
    }
    return { started: true };
};
