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
        if (!knowledgeData || !knowledgeData.facts || knowledgeData.facts.length === 0) {
            this.showEmptyState();
            return;
        }

        // Create table structure
        const table = document.createElement('table');
        table.className = 'knowledge-table-content';

        // Add table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Fact</th>
                <th>Value</th>
                <th>Confidence</th>
                <th>References</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        // Process facts
        knowledgeData.facts.forEach((fact) => {
            const row = document.createElement('tr');
            row.className = 'knowledge-item';

            // Fact key cell
            const keyCell = document.createElement('td');
            keyCell.className = 'fact-key';
            keyCell.textContent = fact.key || 'Unknown';

            // Fact value cell
            const valueCell = document.createElement('td');
            valueCell.className = 'fact-value';
            valueCell.textContent = fact.value || '';

            // Confidence cell
            const confidenceCell = document.createElement('td');
            confidenceCell.className = 'fact-confidence';
            const confidencePercent = Math.round((fact.stability_score || 0) * 100);
            const confidenceClass = this.getConfidenceClass(confidencePercent);
            confidenceCell.innerHTML = `<span class="confidence-badge ${confidenceClass}">${confidencePercent}%</span>`;

            // References cell with tooltip
            const referencesCell = document.createElement('td');
            referencesCell.className = 'fact-references';
            
            if (fact.references && fact.references.length > 0) {
                const refCount = fact.references.length;
                const refButton = document.createElement('button');
                refButton.className = 'references-btn';
                refButton.innerHTML = `🔗 ${refCount} source${refCount > 1 ? 's' : ''}`;
                refButton.title = 'Click to view supporting evidence';
                
                // Create tooltip container
                const tooltip = document.createElement('div');
                tooltip.className = 'references-tooltip';
                tooltip.style.display = 'none';
                
                // Add reference texts to tooltip
                fact.references.forEach((ref, index) => {
                    const refItem = document.createElement('div');
                    refItem.className = 'reference-item';
                    refItem.innerHTML = `
                        <div class="reference-header">
                            <strong>Source ${index + 1}</strong>
                            <span class="reference-score">${Math.round(ref.relevance_score * 100)}% match</span>
                        </div>
                        <div class="reference-text">${this.escapeHtml(ref.chunk_text || '[Text not available]')}</div>
                    `;
                    tooltip.appendChild(refItem);
                });
                
                refButton.appendChild(tooltip);
                
                // Toggle tooltip on click
                refButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isVisible = tooltip.style.display === 'block';
                    // Hide all other tooltips
                    document.querySelectorAll('.references-tooltip').forEach(t => t.style.display = 'none');
                    // Toggle this tooltip
                    tooltip.style.display = isVisible ? 'none' : 'block';
                });
                
                referencesCell.appendChild(refButton);
            } else {
                referencesCell.innerHTML = '<span class="no-references">No sources</span>';
            }

            // Append cells to row
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            row.appendChild(confidenceCell);
            row.appendChild(referencesCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableContainer.appendChild(table);

        // Close tooltips when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.references-tooltip').forEach(t => t.style.display = 'none');
        });

        logger.info(`Rendered ${knowledgeData.facts.length} facts`);
    },

    /**
     * Get CSS class for confidence badge based on percentage
     * @param {number} percent - Confidence percentage (0-100)
     * @returns {string} - CSS class name
     */
    getConfidenceClass(percent) {
        if (percent >= 80) return 'confidence-high';
        if (percent >= 60) return 'confidence-medium';
        return 'confidence-low';
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
        // Edit knowledge buttons - removed as new structure doesn't have edit buttons
        // Can be added back if needed in the future
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
