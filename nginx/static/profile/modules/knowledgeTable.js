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

            // Extract the summary object from the response
            const summaryData = data.summary || data;
            this.knowledgeData = summaryData;
            this.renderKnowledgeTable(summaryData);
            
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

        // Create table structure
        const table = document.createElement('table');
        table.className = 'knowledge-table-content';

        // Process nested knowledge categories
        Object.entries(knowledgeData).forEach(([categoryName, categoryData]) => {
            if (categoryName === 'error' || !categoryData) return;

            // Handle nested category structure (e.g., "Basic Information": { "Name": "Anna", ... })
            if (typeof categoryData === 'object' && !Array.isArray(categoryData)) {
                // Create category header
                const categoryHeader = document.createElement('tr');
                categoryHeader.className = 'category-header';
                categoryHeader.innerHTML = `
                    <th colspan="2" class="category-title">${this.escapeHtml(categoryName)}</th>
                `;
                table.appendChild(categoryHeader);

                // Add sub-items within this category
                Object.entries(categoryData).forEach(([subKey, subValue]) => {
                    if (subValue && subValue.toString().trim()) {
                        const row = document.createElement('tr');
                        row.className = 'knowledge-item';
                        row.innerHTML = `
                            <th class="sub-category">${this.escapeHtml(subKey)}</th>
                            <td>
                                <span class="knowledge-value">${this.escapeHtml(subValue)}</span>
                                <div class="knowledge-actions">
                                    <button class="edit-knowledge-btn" 
                                            data-category="${this.escapeHtml(categoryName)}" 
                                            data-subcategory="${this.escapeHtml(subKey)}"
                                            data-value="${this.escapeHtml(subValue)}" 
                                            title="Edit this information">
                                        ✏️
                                    </button>
                                </div>
                            </td>
                        `;
                        table.appendChild(row);
                    }
                });
            } else {
                // Handle simple key-value pairs
                const row = document.createElement('tr');
                row.className = 'knowledge-item';
                row.innerHTML = `
                    <th>${this.formatCategoryName(categoryName)}</th>
                    <td>
                        <span class="knowledge-value">${this.escapeHtml(categoryData)}</span>
                        <div class="knowledge-actions">
                            <button class="edit-knowledge-btn" 
                                    data-category="${this.escapeHtml(categoryName)}" 
                                    data-value="${this.escapeHtml(categoryData)}" 
                                    title="Edit this information">
                                ✏️
                            </button>
                        </div>
                    </td>
                `;
                table.appendChild(row);
            }
        });

        // Check if table has any content
        if (table.children.length === 0) {
            this.showEmptyState();
            return;
        }

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
                const subcategory = e.target.dataset.subcategory;
                const value = e.target.dataset.value;
                this.showEditKnowledgeModal(category, subcategory, value);
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
     * @param {string} subcategory - The subcategory to edit (optional)
     * @param {string} value - The current value
     */
    showEditKnowledgeModal(category, subcategory, value) {
        const displayText = subcategory ? `${category} > ${subcategory}` : category;
        console.log('Editing knowledge:', displayText, value);
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
