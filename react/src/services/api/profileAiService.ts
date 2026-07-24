import { KnowledgeSummaryResponse } from '../../types/api';
import { API_BASE } from './config';

// Mirrors profile's knowledgeTable.js — ai_agent's routers/knowledge.py
// POST /summarize already existed (built for the MCP/knowledge pipeline);
// this port just adds a UI caller, no backend changes.
export const summarizeFriendKnowledge = async (friendId: number): Promise<KnowledgeSummaryResponse> => {
    const response = await fetch(`${API_BASE.AI}/knowledge/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id: friendId }),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
};

// Mirrors profile's aiChat.js's connect() — builds the same-origin WebSocket
// URL for ai_agent's /chat/ws endpoint (routers/chat.py). nginx's /api/ai/
// location already has WebSocket upgrade headers configured (see
// nginx/nginx.conf), same path the legacy MPA used.
export const buildAiChatWsUrl = (): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${API_BASE.AI}/chat/ws`;
};
