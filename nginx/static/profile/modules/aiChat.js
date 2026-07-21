/**
 * AI Chat Module
 * Handles WebSocket connection and messaging with AI agent
 */

const AiChat = {
    ws: null,
    friendId: null,
    friendName: null,
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    messageQueue: [],
    // Show LLM thought/tool traces in the chat as grey lines. Toggle at runtime:
    // AiChat.debug = false  (traces are always console.log'd regardless).
    debug: true,

    /**
     * Initialize the AI chat module
     */
    init() {
        this.friendId = window.friendId;
        this.friendName = window.friendName || 'this friend';
        
        if (!this.friendId) {
            console.error('AiChat: friendId not available');
            return;
        }

        this.connect();
        this.setupEventListeners();
    },

    /**
     * Setup event listeners for window events
     */
    setupEventListeners() {
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });

        // Handle visibility change (reconnect when tab becomes visible)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isConnected) {
                this.reconnect();
            }
        });
    },

    /**
     * Establish WebSocket connection to AI agent
     */
    connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        
        try {
            // Get the current protocol and host
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/api/ai/chat/ws`;
            
            console.log('AiChat: Connecting to', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            this.setupWebSocketHandlers();
            
        } catch (error) {
            console.error('AiChat: Failed to create WebSocket connection:', error);
            this.handleConnectionError();
        }
    },

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocketHandlers() {
        this.ws.onopen = (event) => {
            console.log('AiChat: WebSocket connected');
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            // Send initial context
            this.sendInitialContext();
            
            // Process any queued messages
            this.processMessageQueue();
            
            // Update UI
            if (typeof AiChatUI !== 'undefined') {
                AiChatUI.updateConnectionStatus('connected');
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('AiChat: Failed to parse message:', error);
                // Treat as plain text message
                this.handleMessage({ message: event.data, type: 'ai' });
            }
        };

        this.ws.onclose = (event) => {
            console.log('AiChat: WebSocket closed', event.code, event.reason);
            this.isConnected = false;
            this.isConnecting = false;
            
            // Update UI
            if (typeof AiChatUI !== 'undefined') {
                AiChatUI.updateConnectionStatus('disconnected');
            }
            
            // Attempt reconnection if not a clean close
            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('AiChat: WebSocket error:', error);
            this.handleConnectionError();
        };
    },

    /**
     * Send initial context to AI agent
     */
    sendInitialContext() {
        const contextMessage = {
            type: 'context',
            friendId: this.friendId,
            friendName: this.friendName,
            action: 'initialize',
            message: `Current friend profile being viewed: ${this.friendName} (ID: ${this.friendId}). The user is viewing this friend's profile and wants to chat about them. Please respond with: "Hello! Would you like to chat about ${this.friendName}? I'm ready to help you learn more about them."`,
            timestamp: new Date().toISOString()
        };

        this.sendRawMessage(contextMessage);
    },

    /**
     * Handle incoming messages from AI agent.
     *
     * The backend now streams a state machine, not one blob:
     *   thinking     - agent started reasoning
     *   tool_call    - agent invoked a tool {name, data:args}
     *   tool_result  - a tool returned {name, data:result}
     *   token        - a streamed delta of the answer
     *   trace        - raw LLM/agent thought line (debug: "stir it")
     *   ai_response  - final complete answer (terminal)
     *   error        - failure {content, data}
     * Plain strings / legacy shapes still render as a single AI message.
     * @param {Object} data - Message data
     */
    handleMessage(data) {
        if (typeof AiChatUI === 'undefined') {
            return;
        }

        // Legacy / non-typed payloads → single message, as before
        if (typeof data === 'string') {
            AiChatUI.finalizeStream(data);
            AiChatUI.hideTyping();
            this.maybeNotify();
            return;
        }

        switch (data.type) {
            case 'thinking':
                console.log('AiChat[thinking]:', data.content || '');
                AiChatUI.showTyping();
                break;

            case 'tool_call':
                console.log('AiChat[tool_call]:', data.name, data.data);
                AiChatUI.addTrace(`🔧 ${data.name}(${this.summarize(data.data)})`);
                break;

            case 'tool_result':
                console.log('AiChat[tool_result]:', data.name, data.data);
                if (this.debug) {
                    AiChatUI.addTrace(`↳ ${data.name} → ${this.summarize(data.data)}`);
                }
                break;

            case 'trace':
                // Raw LLM "thoughts" — always logged, shown only in debug mode
                console.log('AiChat[trace]:', data.phase, data.name || '', data.data ?? '');
                if (this.debug) {
                    AiChatUI.addTrace(`💭 ${data.name || data.phase}: ${this.summarize(data.data)}`);
                }
                break;

            case 'token':
                AiChatUI.hideTyping();
                AiChatUI.appendStream(data.content || '');
                break;

            case 'error':
                console.error('AiChat[error]:', data.content, data.data);
                AiChatUI.hideTyping();
                AiChatUI.discardStream();
                AiChatUI.addSystemMessage(`⚠️ ${data.content || 'Agent error'}`);
                break;

            case 'ai_response':
            default: {
                // Terminal: finalize the streamed bubble (or render if none streamed)
                const text = data.content ?? data.message ?? data.response ?? '';
                AiChatUI.finalizeStream(text);
                AiChatUI.hideTyping();
                this.maybeNotify();
                break;
            }
        }
    },

    /** Compact a tool arg/result object for a one-line trace. */
    summarize(value) {
        if (value == null) return '';
        let s = typeof value === 'string' ? value : JSON.stringify(value);
        return s.length > 120 ? s.slice(0, 117) + '…' : s;
    },

    /** Notify when a completed answer lands while the chat is minimized. */
    maybeNotify() {
        if (typeof AiChatUI !== 'undefined' && !AiChatUI.isExpanded) {
            AiChatUI.showNewMessageIndicator();
        }
    },

    /**
     * Send a user message to AI agent
     * @param {string} message - User message text
     */
    sendMessage(message) {
        if (!message || !message.trim()) {
            return;
        }

        const messageData = {
            type: 'chat',
            message: message.trim(),
            friendId: this.friendId,
            timestamp: new Date().toISOString()
        };

        if (this.isConnected) {
            this.sendRawMessage(messageData);
            
            // Show typing indicator
            if (typeof AiChatUI !== 'undefined') {
                AiChatUI.showTyping();
            }
        } else {
            // Queue message for when connection is restored
            this.messageQueue.push(messageData);
            
            // Show connection error
            if (typeof AiChatUI !== 'undefined') {
                AiChatUI.addSystemMessage('Message queued - reconnecting to AI agent...');
            }
            
            // Attempt to reconnect
            this.reconnect();
        }
    },

    /**
     * Send raw message through WebSocket
     * @param {Object} data - Message data to send
     */
    sendRawMessage(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('AiChat: Failed to send message:', error);
                this.handleConnectionError();
            }
        }
    },

    /**
     * Process queued messages when connection is restored
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendRawMessage(message);
        }
    },

    /**
     * Handle connection errors
     */
    handleConnectionError() {
        this.isConnected = false;
        this.isConnecting = false;
        
        if (typeof AiChatUI !== 'undefined') {
            AiChatUI.updateConnectionStatus('error');
        }
        
        this.scheduleReconnect();
    },

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('AiChat: Max reconnection attempts reached');
            if (typeof AiChatUI !== 'undefined') {
                AiChatUI.updateConnectionStatus('failed');
            }
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`AiChat: Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(() => {
            this.reconnect();
        }, delay);
    },

    /**
     * Attempt to reconnect
     */
    reconnect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        console.log('AiChat: Attempting to reconnect...');
        
        if (typeof AiChatUI !== 'undefined') {
            AiChatUI.updateConnectionStatus('connecting');
        }
        
        this.connect();
    },

    /**
     * Manually disconnect WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Manual disconnect');
            this.ws = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
    },

    /**
     * Get connection status
     * @returns {Object} Connection status information
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            friendId: this.friendId,
            friendName: this.friendName
        };
    },

    /**
     * Reset chat session (for debugging)
     */
    reset() {
        this.disconnect();
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        
        if (typeof AiChatUI !== 'undefined') {
            AiChatUI.clearMessages();
        }
        
        setTimeout(() => {
            this.connect();
        }, 1000);
    }
};
