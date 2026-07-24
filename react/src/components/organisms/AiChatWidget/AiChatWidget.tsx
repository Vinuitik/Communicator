import React, { useCallback, useEffect, useRef, useState } from 'react';
import { buildAiChatWsUrl } from '../../../services/api/profileAiService';
import { AiChatFrame, AiChatMessage } from '../../../types/api';
import { safeParseMarkdown } from '../../../utils/markdownParser';

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system' | 'trace';
  text: string;
  html?: string;
  time: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'failed';

const STORE_PREFIX = 'frm_chat:';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

// Show LLM thought/tool traces as grey lines, matching aiChat.js's `debug: true` default.
const SHOW_TRACES = true;

const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const summarize = (value: unknown): string => {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
};

const loadStored = (key: string): AiChatMessage[] => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const dropOtherFriendChats = (keepKey: string) => {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORE_PREFIX) && key !== keepKey) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // sessionStorage unavailable — nothing to clean.
  }
};

interface AiChatWidgetProps {
  friendId: number;
  friendName: string;
}

// Ported from profile's modules/{aiChat,aiChatUI,markdownParser}.js — the
// floating AI chat widget. aiChat.js's WebSocket state machine and
// client-authoritative transcript (sessionStorage, replayed to the stateless
// server every turn) are preserved exactly; aiChatUI.js's DOM patching is
// replaced by React state, same collapse as MediaGallery's 6 modules.
//
// ai_agent's WS /chat/ws (routers/chat.py) already existed and matches this
// protocol (thinking/tool_call/tool_result/trace/token/ai_response/error) —
// no backend changes needed. nginx's /api/ai/ location already has WebSocket
// upgrade headers (see nginx/nginx.conf), same path the legacy MPA used.
const AiChatWidget: React.FC<AiChatWidgetProps> = ({ friendId, friendName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [streamText, setStreamText] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<AiChatMessage[]>([]);
  const storageKeyRef = useRef(`${STORE_PREFIX}${friendId}`);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRenderedStoredRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(storageKeyRef.current, JSON.stringify(transcriptRef.current));
    } catch {
      // sessionStorage unavailable — transcript just won't survive reload.
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ block: 'end' }), 100);
  }, []);

  const maybeNotify = useCallback(() => {
    if (!isExpandedRef.current) setUnreadCount((c) => c + 1);
  }, []);

  const addMessage = useCallback((role: DisplayMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { role, text, html: role === 'assistant' ? safeParseMarkdown(text) : undefined, time: formatTime(new Date()) }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const finalizeStream = useCallback((fullText: string) => {
    setStreamText((current) => {
      const text = fullText && fullText.trim() ? fullText : (current ?? '');
      if (text.trim()) {
        addMessage('assistant', text);
        transcriptRef.current = [...transcriptRef.current, { role: 'assistant', content: text }];
        persist();
      }
      return null;
    });
  }, [addMessage, persist]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    setStatus('connecting');
    const ws = new WebSocket(buildAiChatWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus('connected');

      if (!hasRenderedStoredRef.current) {
        hasRenderedStoredRef.current = true;
        if (transcriptRef.current.length > 0) {
          transcriptRef.current.forEach((m) => addMessage(m.role, m.content));
        } else {
          ws.send(JSON.stringify({
            type: 'context',
            friendId,
            friendName,
            action: 'initialize',
            message: `Current friend profile being viewed: ${friendName} (ID: ${friendId}). The user is viewing this friend's profile and wants to chat about them. Please respond with: "Hello! Would you like to chat about ${friendName}? I'm ready to help you learn more about them."`,
            timestamp: new Date().toISOString(),
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      let data: AiChatFrame | string;
      try {
        data = JSON.parse(event.data);
      } catch {
        data = { type: 'ai_response', content: event.data };
      }

      if (typeof data === 'string') {
        finalizeStream(data);
        setIsTyping(false);
        maybeNotify();
        return;
      }

      const frame: AiChatFrame = data;

      switch (frame.type) {
        case 'thinking':
          setIsTyping(true);
          break;
        case 'tool_call':
          if (SHOW_TRACES) addMessage('trace', `🔧 ${frame.name}(${summarize(frame.data)})`);
          break;
        case 'tool_result':
          if (SHOW_TRACES) addMessage('trace', `↳ ${frame.name} → ${summarize(frame.data)}`);
          break;
        case 'trace':
          if (SHOW_TRACES) addMessage('trace', `💭 ${frame.name || frame.phase}: ${summarize(frame.data)}`);
          break;
        case 'token':
          setIsTyping(false);
          setStreamText((prev) => (prev ?? '') + (frame.content || ''));
          scrollToBottom();
          break;
        case 'error':
          setIsTyping(false);
          setStreamText(null);
          addMessage('system', `⚠️ ${frame.content || 'Agent error'}`);
          break;
        case 'ai_response':
        default: {
          const text = frame.content ?? '';
          finalizeStream(text);
          setIsTyping(false);
          maybeNotify();
          break;
        }
      }
    };

    ws.onclose = (event) => {
      setStatus('disconnected');
      if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * 2 ** reconnectAttemptsRef.current;
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      } else if (event.code !== 1000) {
        setStatus('failed');
      }
    };

    ws.onerror = () => setStatus('error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, friendName, addMessage, finalizeStream, maybeNotify, scrollToBottom]);

  useEffect(() => {
    storageKeyRef.current = `${STORE_PREFIX}${friendId}`;
    dropOtherFriendChats(storageKeyRef.current);
    transcriptRef.current = loadStored(storageKeyRef.current);
    hasRenderedStoredRef.current = false;
    setMessages([]);
    setStreamText(null);

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close(1000, 'Component unmount');
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && wsRef.current?.readyState !== WebSocket.OPEN) connect();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [connect]);

  useEffect(() => () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }, []);

  const toggleWidget = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    addMessage('user', text);
    setInput('');

    transcriptRef.current = [...transcriptRef.current, { role: 'user', content: text }];
    persist();

    const frame = { type: 'chat', friendId, messages: transcriptRef.current, timestamp: new Date().toISOString() };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(frame));
      setIsTyping(true);
    } else {
      addMessage('system', 'Message queued - reconnecting to AI agent...');
      connect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const statusText: Record<ConnectionStatus, string> = {
    connecting: 'Connecting...', connected: 'Online', disconnected: 'Disconnected', error: 'Connection Error', failed: 'Connection Failed',
  };
  const statusColor: Record<ConnectionStatus, string> = {
    connecting: 'text-amber-300', connected: 'text-emerald-300', disconnected: 'text-gray-300', error: 'text-red-300', failed: 'text-red-300',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {!isExpanded && (
        <button
          type="button"
          onClick={toggleWidget}
          className="relative w-14 h-14 rounded-full bg-brand text-white text-2xl shadow-lg hover:bg-brand-dark transition-colors flex items-center justify-center"
        >
          🤖
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-xs flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {isExpanded && (
        <div className="w-[350px] h-[500px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-brand text-white">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-xl">🤖</div>
              <div className="min-w-0">
                <div className="font-medium text-sm">AI Assistant</div>
                <div className={`text-xs ${statusColor[status]}`}>{statusText[status]}</div>
              </div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={toggleWidget} title="Minimize" className="w-6 h-6 hover:bg-white/20 rounded flex items-center justify-center">─</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-gray-50">
            {messages.length === 0 && streamText === null && (
              <div className="text-center text-gray-500 p-4">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-sm">{status === 'connected' ? <>Hello! Would you like to chat about <strong>{friendName}</strong>?</> : 'Connecting to AI assistant...'}</p>
              </div>
            )}
            {messages.map((m, i) => (
              m.role === 'trace' ? (
                <div key={i} className="text-xs text-gray-400 italic px-2">{m.text}</div>
              ) : m.role === 'system' ? (
                <div key={i} className="text-xs text-gray-500 text-center px-2">{m.text}</div>
              ) : (
                <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'self-end bg-brand text-white' : 'self-start bg-white border border-gray-200'}`}>
                  {m.role === 'assistant' ? <div dangerouslySetInnerHTML={{ __html: m.html || '' }} /> : m.text}
                  <div className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>{m.time}</div>
                </div>
              )
            ))}
            {streamText !== null && (
              <div className="max-w-[85%] self-start rounded-lg px-3 py-2 text-sm bg-white border border-gray-200">
                <div dangerouslySetInnerHTML={{ __html: safeParseMarkdown(streamText) }} />
              </div>
            )}
            {isTyping && (
              <div className="text-xs text-gray-500 italic px-2">AI is typing...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-200 p-2">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={1000}
                placeholder="Type your message..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand max-h-28"
              />
              <button
                type="button"
                onClick={sendMessage}
                title="Send message"
                className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-dark flex-shrink-0"
              >
                ➤
              </button>
            </div>
            <div className="text-right text-[10px] text-gray-400 mt-1">{input.length}/1000</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiChatWidget;
