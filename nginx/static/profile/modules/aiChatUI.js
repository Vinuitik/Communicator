/**
 * AI Chat UI Module
 * Handles the visual interface and user interactions for the AI chat widget
 */

const AiChatUI = {
    isExpanded: false,
    messageHistory: [],
    unreadCount: 0,
    typingTimeout: null,
    
    /**
     * Initialize the AI chat UI
     */
    init() {
        this.createChatWidget();
        this.setupEventListeners();
        this.loadChatState();
    },

    /**
     * Create the chat widget HTML structure
     */
    createChatWidget() {
        // Create main chat container
        const chatContainer = document.createElement('div');
        chatContainer.id = 'ai-chat-widget';
        chatContainer.className = 'ai-chat-widget';
        
        chatContainer.innerHTML = `
            <!-- Chat Toggle Button (collapsed state) -->
            <div class="chat-toggle-btn" id="chatToggleBtn">
                <div class="chat-icon">🤖</div>
                <div class="chat-badge" id="chatBadge" style="display: none;">
                    <span id="chatBadgeCount">0</span>
                </div>
            </div>

            <!-- Chat Window (expanded state) -->
            <div class="chat-window" id="chatWindow" style="display: none;">
                <!-- Header -->
                <div class="chat-header">
                    <div class="chat-header-left">
                        <div class="ai-avatar">🤖</div>
                        <div class="chat-header-text">
                            <div class="ai-name">AI Assistant</div>
                            <div class="connection-status" id="connectionStatus">Connecting...</div>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button class="chat-action-btn" id="minimizeBtn" title="Minimize">─</button>
                        <button class="chat-action-btn" id="closeBtn" title="Close">✕</button>
                    </div>
                </div>

                <!-- Messages Container -->
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-welcome">
                        <div class="welcome-icon">👋</div>
                        <p>Connecting to AI assistant...</p>
                    </div>
                </div>

                <!-- Typing Indicator -->
                <div class="typing-indicator" id="typingIndicator" style="display: none;">
                    <div class="typing-dots">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                    <span>AI is typing...</span>
                </div>

                <!-- Input Area -->
                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea 
                            id="chatInput" 
                            class="chat-input" 
                            placeholder="Type your message..." 
                            rows="1"
                            maxlength="1000"></textarea>
                        <button id="sendBtn" class="send-btn" title="Send message">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="input-footer">
                        <div class="char-count">
                            <span id="charCount">0</span>/1000
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(chatContainer);
    },

    /**
     * Setup event listeners for chat interactions
     */
    setupEventListeners() {
        const toggleBtn = document.getElementById('chatToggleBtn');
        const minimizeBtn = document.getElementById('minimizeBtn');
        const closeBtn = document.getElementById('closeBtn');
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');

        // Toggle chat window
        toggleBtn.addEventListener('click', () => {
            this.toggleWidget();
        });

        // Minimize chat
        minimizeBtn.addEventListener('click', () => {
            this.minimizeWidget();
        });

        // Close chat
        closeBtn.addEventListener('click', () => {
            this.closeWidget();
        });

        // Send message
        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Input handling
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            } else if (e.key === 'Escape') {
                this.minimizeWidget();
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeInput();
        });

        // Click outside to minimize (optional)
        document.addEventListener('click', (e) => {
            const widget = document.getElementById('ai-chat-widget');
            if (this.isExpanded && !widget.contains(e.target)) {
                // Uncomment to enable click-outside to minimize
                // this.minimizeWidget();
            }
        });
    },

    /**
     * Toggle chat widget visibility
     */
    toggleWidget() {
        if (this.isExpanded) {
            this.minimizeWidget();
        } else {
            this.expandWidget();
        }
    },

    /**
     * Expand chat widget
     */
    expandWidget() {
        const chatWindow = document.getElementById('chatWindow');
        const toggleBtn = document.getElementById('chatToggleBtn');
        
        this.isExpanded = true;
        chatWindow.style.display = 'flex';
        toggleBtn.style.display = 'none';
        
        // Clear unread indicator
        this.clearUnreadIndicator();
        
        // Focus input
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 300);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Save state
        this.saveChatState();
    },

    /**
     * Minimize chat widget
     */
    minimizeWidget() {
        const chatWindow = document.getElementById('chatWindow');
        const toggleBtn = document.getElementById('chatToggleBtn');
        
        this.isExpanded = false;
        chatWindow.style.display = 'none';
        toggleBtn.style.display = 'flex';
        
        // Save state
        this.saveChatState();
    },

    /**
     * Close chat widget completely
     */
    closeWidget() {
        this.minimizeWidget();
        // Could add logic to disconnect or clear chat
    },

    /**
     * Send a message
     */
    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add message to UI immediately
        this.addMessage(message, true, new Date());
        
        // Clear input
        input.value = '';
        this.updateCharCount();
        this.autoResizeInput();
        
        // Send to AI agent
        if (typeof AiChat !== 'undefined') {
            AiChat.sendMessage(message);
        }
        
        // Scroll to bottom
        this.scrollToBottom();
    },

    /**
     * Add a message to the chat
     * @param {string} text - Message text
     * @param {boolean} isUser - Whether message is from user
     * @param {Date} timestamp - Message timestamp
     */
    addMessage(text, isUser = false, timestamp = new Date()) {
        const messagesContainer = document.getElementById('chatMessages');
        
        // Remove welcome message if present
        const welcomeMsg = messagesContainer.querySelector('.chat-welcome');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;
        
        const timeString = this.formatTime(timestamp);
        
        // Format message text based on sender
        let formattedText;
        if (isUser) {
            // Escape HTML for user messages (security)
            formattedText = this.escapeHtml(text);
        } else {
            // Parse Markdown for AI messages
            formattedText = this.parseMarkdown(text);
        }
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${formattedText}</div>
                <div class="message-time">${timeString}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageEl);
        
        // Add to history
        this.messageHistory.push({
            text,
            isUser,
            timestamp
        });
        
        // Update unread count if minimized
        if (!this.isExpanded && !isUser) {
            this.incrementUnreadCount();
        }
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Animate new message
        setTimeout(() => {
            messageEl.classList.add('message-visible');
        }, 50);
    },

    /**
     * Add a system message (for status updates)
     * @param {string} text - System message text
     */
    addSystemMessage(text) {
        const messagesContainer = document.getElementById('chatMessages');
        
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message system-message';
        
        messageEl.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(text)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    },

    /**
     * Show typing indicator
     */
    showTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = 'flex';
        this.scrollToBottom();
        
        // Auto-hide after 30 seconds
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.hideTyping();
        }, 30000);
    },

    /**
     * Hide typing indicator
     */
    hideTyping() {
        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = 'none';
        clearTimeout(this.typingTimeout);
    },

    /**
     * Update connection status
     * @param {string} status - Connection status
     */
    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        
        const statusMap = {
            connecting: { text: 'Connecting...', class: 'connecting' },
            connected: { text: 'Online', class: 'connected' },
            disconnected: { text: 'Disconnected', class: 'disconnected' },
            error: { text: 'Connection Error', class: 'error' },
            failed: { text: 'Connection Failed', class: 'failed' }
        };
        
        const statusInfo = statusMap[status] || statusMap.disconnected;
        
        statusEl.textContent = statusInfo.text;
        statusEl.className = `connection-status ${statusInfo.class}`;
        
        // Update welcome message based on status
        if (status === 'connected') {
            this.updateWelcomeMessage();
        }
    },

    /**
     * Update welcome message when connected
     */
    updateWelcomeMessage() {
        const welcomeMsg = document.querySelector('.chat-welcome');
        if (welcomeMsg) {
            const friendName = window.friendName || 'this friend';
            welcomeMsg.innerHTML = `
                <div class="welcome-icon">🤖</div>
                <p>Hello! Would you like to chat about <strong>${this.escapeHtml(friendName)}</strong>?</p>
                <p class="welcome-subtext">I'm ready to help you learn more about them.</p>
            `;
        }
    },

    /**
     * Show new message indicator
     */
    showNewMessageIndicator() {
        this.incrementUnreadCount();
    },

    /**
     * Increment unread message count
     */
    incrementUnreadCount() {
        this.unreadCount++;
        this.updateUnreadBadge();
    },

    /**
     * Clear unread indicator
     */
    clearUnreadIndicator() {
        this.unreadCount = 0;
        this.updateUnreadBadge();
    },

    /**
     * Update unread badge display
     */
    updateUnreadBadge() {
        const badge = document.getElementById('chatBadge');
        const count = document.getElementById('chatBadgeCount');
        
        if (this.unreadCount > 0) {
            badge.style.display = 'flex';
            count.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        } else {
            badge.style.display = 'none';
        }
    },

    /**
     * Clear all messages
     */
    clearMessages() {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-icon">👋</div>
                <p>Chat cleared. Reconnecting...</p>
            </div>
        `;
        this.messageHistory = [];
    },

    /**
     * Auto-resize input textarea
     */
    autoResizeInput() {
        const input = document.getElementById('chatInput');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    },

    /**
     * Update character count
     */
    updateCharCount() {
        const input = document.getElementById('chatInput');
        const counter = document.getElementById('charCount');
        counter.textContent = input.value.length;
        
        // Add warning class if near limit
        const wrapper = input.closest('.chat-input-wrapper');
        if (input.value.length > 900) {
            wrapper.classList.add('char-limit-warning');
        } else {
            wrapper.classList.remove('char-limit-warning');
        }
    },

    /**
     * Scroll messages to bottom
     */
    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    },

    /**
     * Format timestamp
     * @param {Date} date - Date to format
     * @returns {string} - Formatted time string
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Parse Markdown to HTML for AI messages
     * @param {string} text - Markdown text to parse
     * @returns {string} - HTML string
     */
    parseMarkdown(text) {
        if (typeof MarkdownParser !== 'undefined') {
            return MarkdownParser.safeParse(text);
        } else {
            // Fallback to HTML escaping if MarkdownParser is not available
            console.warn('MarkdownParser not available, falling back to HTML escaping');
            return this.escapeHtml(text);
        }
    },

    /**
     * Save chat state to localStorage
     */
    saveChatState() {
        try {
            localStorage.setItem('aiChatExpanded', this.isExpanded);
        } catch (e) {
            console.warn('Failed to save chat state:', e);
        }
    },

    /**
     * Load chat state from localStorage
     */
    loadChatState() {
        try {
            const savedState = localStorage.getItem('aiChatExpanded');
            if (savedState === 'true') {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.expandWidget();
                }, 100);
            }
        } catch (e) {
            console.warn('Failed to load chat state:', e);
        }
    }
};
