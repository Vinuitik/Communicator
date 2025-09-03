/**
 * Knowledge Table Module
 * Handles AI-powered knowledge summarization and display for friend profiles
 */

const KnowledgeTable = {
    friendId: null,
    isLoading: false,
    knowledgeData: {},

    /**
     * Initialize the knowledge table module
     */
    init() {
        this.friendId = window.friendId;
        if (!this.friendId) {
            console.error('KnowledgeTable: friendId not available');
            return;
        }
        
        this.initializeEventListeners();
        this.loadKnowledgeData(); // Start loading immediately on page load
    },

    /**
     * Set up event listeners for knowledge table interactions
     */
    initializeEventListeners() {
        const addBtn = document.querySelector('.knowledge-section .section-title button');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddKnowledgeModal());
        }
    },

    /**
     * Load knowledge data from the AI summarization endpoint
     */
    async loadKnowledgeData() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();

        try {
            const response = await fetch('http://localhost:8090/api/ai/knowledge/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friend_id: parseInt(this.friendId) })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.knowledgeData = data;
            this.renderKnowledgeTable(data);
            
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showSuccess('Knowledge summary loaded successfully!');
            }
            
        } catch (error) {
            console.error('Error loading knowledge data:', error);
            this.showErrorState(error.message);
            
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.showError('Failed to load knowledge summary');
            }
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Show loading state with spinner and message
     */
    showLoadingState() {
        const tableContainer = document.querySelector('.knowledge-table');
        if (!tableContainer) return;

        tableContainer.innerHTML = `
            <div class="knowledge-loading">
                <div class="loading-spinner"></div>
                <p>AI is analyzing knowledge about this friend...</p>
                <p class="loading-subtext">This may take a few moments</p>
            </div>
        `;
    },

    /**
     * Show error state with retry option
     * @param {string} errorMessage - The error message to display
     */
    showErrorState(errorMessage) {
        const tableContainer = document.querySelector('.knowledge-table');
        if (!tableContainer) return;

        tableContainer.innerHTML = `
            <div class="knowledge-error">
                <div class="error-icon">⚠️</div>
                <p>Failed to load knowledge summary</p>
                <p class="error-message">${this.escapeHtml(errorMessage)}</p>
                <button class="retry-btn" onclick="KnowledgeTable.loadKnowledgeData()">
                    Try Again
                </button>
            </div>
        `;
    },

    /**
     * Render the knowledge table with AI-generated data
     * @param {Object} knowledgeData - The knowledge data to render
     */
    renderKnowledgeTable(knowledgeData) {
        const tableContainer = document.querySelector('.knowledge-table');
        if (!tableContainer) return;

        // Clear loading state
        tableContainer.innerHTML = '';

        // Check if we have knowledge data
        if (!knowledgeData || Object.keys(knowledgeData).length === 0) {
            this.showEmptyState();
            return;
        }

        // Filter out error keys and empty values
        const validEntries = Object.entries(knowledgeData).filter(
            ([category, value]) => category !== 'error' && value && value.trim()
        );

        if (validEntries.length === 0) {
            this.showEmptyState();
            return;
        }

        // Create table structure
        const table = document.createElement('table');
        table.className = 'knowledge-table-content';

        // Render each knowledge item
        validEntries.forEach(([category, value]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <th>${this.formatCategoryName(category)}</th>
                <td>
                    <span class="knowledge-value">${this.escapeHtml(value)}</span>
                    <div class="knowledge-actions">
                        <button class="edit-knowledge-btn" data-category="${this.escapeHtml(category)}" data-value="${this.escapeHtml(value)}" title="Edit this information">
                            ✏️
                        </button>
                    </div>
                </td>
            `;
            table.appendChild(row);
        });

        tableContainer.appendChild(table);
        this.attachTableEventListeners();
    },

    /**
     * Show empty state when no knowledge is available
     */
    showEmptyState() {
        const tableContainer = document.querySelector('.knowledge-table');
        if (!tableContainer) return;

        tableContainer.innerHTML = `
            <div class="knowledge-empty">
                <div class="empty-icon">🤔</div>
                <p>No knowledge available yet</p>
                <p class="empty-subtext">Start adding some facts about this friend!</p>
                <button class="add-first-knowledge-btn" onclick="KnowledgeTable.showAddKnowledgeModal()">
                    Add First Fact
                </button>
            </div>
        `;
    },

    /**
     * Format category name from camelCase or snake_case to Title Case
     * @param {string} category - The category name to format
     * @returns {string} - Formatted category name
     */
    formatCategoryName(category) {
        return category
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },

    /**
     * Attach event listeners to table elements
     */
    attachTableEventListeners() {
        // Edit knowledge buttons
        document.querySelectorAll('.edit-knowledge-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                const value = e.target.dataset.value;
                this.showEditKnowledgeModal(category, value);
            });
        });
    },

    /**
     * Show modal for adding new knowledge (placeholder for future implementation)
     */
    showAddKnowledgeModal() {
        console.log('Opening add knowledge modal...');
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showInfo('Add knowledge feature coming soon!');
        }
    },

    /**
     * Show modal for editing existing knowledge (placeholder for future implementation)
     * @param {string} category - The category to edit
     * @param {string} value - The current value
     */
    showEditKnowledgeModal(category, value) {
        console.log('Editing knowledge:', category, value);
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.showInfo('Edit knowledge feature coming soon!');
        }
    },

    /**
     * Escape HTML characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Public method to refresh knowledge data
     */
    refresh() {
        this.loadKnowledgeData();
    },

    /**
     * Get current knowledge data
     * @returns {Object} - Current knowledge data
     */
    getKnowledgeData() {
        return this.knowledgeData;
    },

    /**
     * Check if knowledge table is currently loading
     * @returns {boolean} - Loading state
     */
    isLoadingData() {
        return this.isLoading;
    }
};
