// Shared Knowledge Management Module
// This module can be used for both friend facts and group knowledge

export class KnowledgeManager {
    constructor(config) {
        this.config = {
            apiBaseUrl: config.apiBaseUrl || '/api',
            entityType: config.entityType || 'friend', // 'friend' or 'group'
            entityIdKey: config.entityIdKey || 'friendId', // 'friendId' or 'groupId'
            textFieldName: config.textFieldName || 'text',
            priorityFieldName: config.priorityFieldName || 'priority',
            pageSize: config.pageSize || 10,
            ...config
        };
        
        this.currentPage = 1;
        this.totalPages = 1;
        this.entityId = null;
        
        this.initializeEntityId();
        this.initializeElements();
        this.initializeEventListeners();
        this.initializePagination();
        
        if (this.entityId) {
            this.loadKnowledgePage(1);
        }
    }
    
    initializeEntityId() {
        // Extract entity ID from URL
        const urlPath = window.location.pathname;
        const pathParts = urlPath.split('/');
        
        // Look for specific patterns based on entity type
        if (this.config.entityType === 'group') {
            // Pattern: /api/groups/{id}/knowledge
            const groupsIndex = pathParts.indexOf('groups');
            if (groupsIndex >= 0 && pathParts[groupsIndex + 1] && pathParts[groupsIndex + 2] === 'knowledge') {
                this.entityId = parseInt(pathParts[groupsIndex + 1]);
            }
        } else {
            // Pattern for friends: /knowledge/{id} or /{entityType}/{id}/knowledge
            const knowledgeIndex = pathParts.indexOf('knowledge');
            if (knowledgeIndex >= 0) {
                // Pattern: /knowledge/{id}
                if (pathParts[knowledgeIndex + 1]) {
                    this.entityId = parseInt(pathParts[knowledgeIndex + 1]);
                }
                // Pattern: /{entityType}/{id}/knowledge
                else if (knowledgeIndex > 0 && pathParts[knowledgeIndex - 1]) {
                    this.entityId = parseInt(pathParts[knowledgeIndex - 1]);
                }
            }
        }
        
        // Alternative: try to get from data attribute
        if (!this.entityId) {
            const container = document.querySelector(`[data-${this.config.entityIdKey}]`);
            if (container) {
                this.entityId = parseInt(container.getAttribute(`data-${this.config.entityIdKey}`));
            }
        }
        
        console.log(`Detected ${this.config.entityType} ID:`, this.entityId, 'from URL:', urlPath);
    }
    
    initializeElements() {
        this.elements = {
            form: document.getElementById('knowledgeForm'),
            tableBody: document.querySelector('#knowledgeTable tbody'),
            committedTableBody: document.querySelector('#committedTable tbody'),
            submitBtn: document.getElementById('submitInfoBtn'),
            factInput: document.getElementById('factInput'),
            importanceInput: document.getElementById('importanceInput'),
            
            // Pagination elements
            prevBtn: document.getElementById('prevPageBtn'),
            nextBtn: document.getElementById('nextPageBtn'),
            pageInput: document.getElementById('pageInput'),
            totalPagesSpan: document.getElementById('totalPages'),
            knowledgeInfo: document.getElementById('knowledgeInfo')
        };
    }
    
    initializeEventListeners() {
        // Form submission
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }
        
        // Submit button
        if (this.elements.submitBtn) {
            this.elements.submitBtn.addEventListener('click', this.handleSubmitInfo.bind(this));
        }
        
        // Initialize existing table rows (for server-rendered content)
        this.initExistingTableRows();
    }
    
    initializePagination() {
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentPage > 1) {
                    this.goToPage(this.currentPage - 1);
                }
            });
        }
        
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentPage < this.totalPages) {
                    this.goToPage(this.currentPage + 1);
                }
            });
        }
        
        if (this.elements.pageInput) {
            this.elements.pageInput.addEventListener('change', (e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= this.totalPages) {
                    this.goToPage(page);
                } else {
                    e.target.value = this.currentPage; // Reset to current page if invalid
                }
            });
            
            this.elements.pageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= this.totalPages) {
                        this.goToPage(page);
                    } else {
                        e.target.value = this.currentPage; // Reset to current page if invalid
                    }
                }
            });
        }
    }
    
    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.entityId) {
            this.showError(`No ${this.config.entityType} ID available`);
            return;
        }
        
        const fact = this.elements.factInput?.value.trim();
        const importance = this.elements.importanceInput?.value.trim();
        
        if (!fact || !importance) {
            this.showError('Please fill in all fields');
            return;
        }
        
        const knowledgeData = {
            [this.config.textFieldName]: fact,
            [this.config.priorityFieldName]: parseInt(importance)
        };
        
        this.addKnowledgeToTable(knowledgeData);
        
        // Clear form
        this.elements.factInput.value = '';
        this.elements.importanceInput.value = '';
    }
    
    addKnowledgeToTable(knowledgeData) {
        if (!this.elements.tableBody) return;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Fact">${knowledgeData[this.config.textFieldName]}</td>
            <td data-label="Importance">${knowledgeData[this.config.priorityFieldName]}</td>
            <td data-label="Actions">
                <button class="button removeFromTableBtn">Remove</button>
            </td>
        `;
        
        // Add remove button functionality
        const removeBtn = row.querySelector('.removeFromTableBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                row.remove();
            });
        }
        
        this.elements.tableBody.appendChild(row);
    }
    
    async handleSubmitInfo() {
        if (!this.entityId) {
            this.showError(`No ${this.config.entityType} ID available`);
            return;
        }
        
        const rows = this.elements.tableBody?.querySelectorAll('tr') || [];
        if (rows.length === 0) {
            this.showError('No knowledge items to submit');
            return;
        }
        
        const knowledgeItems = Array.from(rows).map(row => {
            const cells = row.querySelectorAll('td');
            return {
                [this.config.textFieldName]: cells[0].textContent.trim(),
                [this.config.priorityFieldName]: parseInt(cells[1].textContent.trim())
            };
        });
        
        try {
            // Fix URL construction for addKnowledge
            const url = `${this.config.apiBaseUrl}/addKnowledge/${this.entityId}`;
            console.log('Submit URL:', url); // Debug log
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(knowledgeItems)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Clear the form table and reload the committed table
            this.elements.tableBody.innerHTML = '';
            this.loadKnowledgePage(this.currentPage);
            this.showSuccess('Knowledge items added successfully!');
            
        } catch (error) {
            console.error('Error submitting knowledge:', error);
            this.showError('Failed to submit knowledge items. Please try again.');
        }
    }
    
    async loadKnowledgePage(page) {
        if (!this.entityId) {
            console.log(`No ${this.config.entityType} ID available for pagination`);
            return;
        }
        
        try {
            console.log(`Loading page ${page} for ${this.config.entityType} ${this.entityId}`);
            
            // Fix URL construction - don't double the entity type
            const url = `${this.config.apiBaseUrl}/getKnowledge/${this.entityId}/page/${page - 1}`;
            console.log('API URL:', url); // Debug log
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received data:', data);
            
            // Update state
            this.currentPage = page;
            this.totalPages = data.totalPages || 1;
            
            // Update UI
            this.updateKnowledgeTable(data.content || []);
            this.updatePaginationInfo(data.content?.length || 0, data.totalElements || 0, page);
            this.updatePaginationControls();
            
        } catch (error) {
            console.error('Error loading knowledge page:', error);
            // Show user-friendly error
            this.showError('Failed to load knowledge data. Please try again.');
        }
    }
    
    updateKnowledgeTable(knowledges) {
        if (!this.elements.committedTableBody) {
            console.log('Committed table body not found');
            return;
        }
        
        // Clear existing rows
        this.elements.committedTableBody.innerHTML = '';
        
        // Add new rows
        knowledges.forEach(knowledge => {
            const row = this.createKnowledgeRow(knowledge);
            this.elements.committedTableBody.appendChild(row);
        });
        
        console.log(`Updated table with ${knowledges.length} rows`);
    }
    
    createKnowledgeRow(knowledge) {
        const row = document.createElement('tr');
        row.setAttribute('data-id', knowledge.id);
        
        row.innerHTML = `
            <td data-label="Id">${knowledge.id}</td>
            <td data-label="Fact" contenteditable="true">${knowledge[this.config.textFieldName] || knowledge.text || knowledge.fact || ''}</td>
            <td data-label="Importance" contenteditable="true">${knowledge[this.config.priorityFieldName] || knowledge.priority || knowledge.importance || ''}</td>
            <td data-label="Actions">
                <button class="button updateKnowledgeBtn">Update</button>
                <button class="button deleteKnowledgeBtn">Delete</button>
            </td>
        `;
        
        // Add event listeners to the buttons
        const updateButton = row.querySelector('.updateKnowledgeBtn');
        const deleteButton = row.querySelector('.deleteKnowledgeBtn');
        
        if (updateButton) {
            updateButton.addEventListener('click', () => this.handleUpdate(row, knowledge.id));
        }
        
        if (deleteButton) {
            deleteButton.addEventListener('click', () => this.handleDelete(row, knowledge.id));
        }
        
        return row;
    }
    
    async handleUpdate(row, knowledgeId) {
        const factCell = row.querySelector('td[data-label="Fact"]');
        const importanceCell = row.querySelector('td[data-label="Importance"]');
        
        const updatedData = {
            id: knowledgeId,
            [this.config.textFieldName]: factCell.textContent.trim(),
            [this.config.priorityFieldName]: parseInt(importanceCell.textContent.trim())
        };
        
        try {
            // URL construction for updateKnowledge (no ID in path for unified API)
            const url = `${this.config.apiBaseUrl}/updateKnowledge`;
            console.log('Update URL:', url); // Debug log
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.showSuccess('Knowledge updated successfully!');
            
        } catch (error) {
            console.error('Error updating knowledge:', error);
            this.showError('Failed to update knowledge. Please try again.');
        }
    }
    
    async handleDelete(row, knowledgeId) {
        if (!confirm('Are you sure you want to delete this knowledge item?')) {
            return;
        }
        
        try {
            // URL construction for deleteKnowledge (ID in path)
            const url = `${this.config.apiBaseUrl}/deleteKnowledge/${knowledgeId}`;
            console.log('Delete URL:', url); // Debug log
            
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            row.remove();
            this.showSuccess('Knowledge deleted successfully!');
            
            // If this was the last item on the page, go to previous page
            if (this.elements.committedTableBody.children.length === 0 && this.currentPage > 1) {
                this.goToPage(this.currentPage - 1);
            } else {
                // Reload current page to update pagination info
                this.loadKnowledgePage(this.currentPage);
            }
            
        } catch (error) {
            console.error('Error deleting knowledge:', error);
            this.showError('Failed to delete knowledge. Please try again.');
        }
    }
    
    initExistingTableRows() {
        const existingRows = this.elements.committedTableBody?.querySelectorAll('tr') || [];
        existingRows.forEach(row => {
            const updateButton = row.querySelector('.updateKnowledgeBtn');
            const deleteButton = row.querySelector('.deleteKnowledgeBtn');
            const knowledgeId = parseInt(row.getAttribute('data-id'));
            
            if (updateButton) {
                updateButton.addEventListener('click', () => this.handleUpdate(row, knowledgeId));
            }
            
            if (deleteButton) {
                deleteButton.addEventListener('click', () => this.handleDelete(row, knowledgeId));
            }
        });
    }
    
    goToPage(page) {
        this.loadKnowledgePage(page);
    }
    
    updatePaginationInfo(itemsOnPage, totalItems, page) {
        if (!this.elements.knowledgeInfo) return;
        
        const startItem = totalItems === 0 ? 0 : (page - 1) * this.config.pageSize + 1;
        const endItem = Math.min(page * this.config.pageSize, totalItems);
        
        this.elements.knowledgeInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} knowledge items`;
    }
    
    updatePaginationControls() {
        if (this.elements.prevBtn) {
            this.elements.prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (this.elements.nextBtn) {
            this.elements.nextBtn.disabled = this.currentPage >= this.totalPages;
        }
        
        if (this.elements.pageInput) {
            this.elements.pageInput.value = this.currentPage;
        }
        
        if (this.elements.totalPagesSpan) {
            this.elements.totalPagesSpan.textContent = this.totalPages;
        }
    }
    
    showError(message) {
        // You can customize this to use your preferred notification system
        const knowledgeInfo = this.elements.knowledgeInfo;
        if (knowledgeInfo) {
            knowledgeInfo.textContent = message;
            knowledgeInfo.style.color = 'red';
            
            // Reset color after 3 seconds
            setTimeout(() => {
                knowledgeInfo.style.color = '';
            }, 3000);
        } else {
            alert('Error: ' + message);
        }
    }
    
    showSuccess(message) {
        // You can customize this to use your preferred notification system
        const knowledgeInfo = this.elements.knowledgeInfo;
        if (knowledgeInfo) {
            knowledgeInfo.textContent = message;
            knowledgeInfo.style.color = 'green';
            
            // Reset color after 3 seconds
            setTimeout(() => {
                knowledgeInfo.style.color = '';
            }, 3000);
        } else {
            console.log('Success: ' + message);
        }
    }
    
    // Additional methods for backward compatibility with facts.js
    addRowToTable(tableBody, fact, importance, id = null) {
        if (!tableBody) return;
        
        // Create new row and cells
        const newRow = document.createElement('tr');
        if (id) newRow.setAttribute('data-id', id);
        
        // Different structure based on table type
        if (tableBody === this.elements.committedTableBody) {
            // ID cell for committed table
            const idCell = document.createElement('td');
            idCell.textContent = id || '';
            idCell.setAttribute('data-label', 'Id');
            newRow.appendChild(idCell);
        }
        
        // Fact cell
        const factCell = document.createElement('td');
        factCell.textContent = fact;
        factCell.setAttribute('contenteditable', 'true');
        factCell.setAttribute('data-label', 'Fact');
        newRow.appendChild(factCell);
        
        // Importance cell
        const importanceCell = document.createElement('td');
        importanceCell.textContent = importance;
        importanceCell.setAttribute('contenteditable', 'true');
        importanceCell.setAttribute('data-label', 'Importance');
        newRow.appendChild(importanceCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        
        // Update button
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update';
        updateButton.classList.add('button', 'updateKnowledgeBtn');
        updateButton.style.marginRight = '5px';
        
        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('button', 'deleteKnowledgeBtn');
        
        // Add event listeners to buttons
        if (tableBody === this.elements.tableBody) {
            deleteButton.addEventListener('click', () => {
                newRow.remove();
                console.log('Temporary row deleted');
            });
        } else {
            // For committed table
            updateButton.addEventListener('click', () => this.handleUpdate(newRow, id));
            deleteButton.addEventListener('click', () => this.handleDelete(newRow, id));
        }
        
        actionsCell.appendChild(updateButton);
        actionsCell.appendChild(deleteButton);
        actionsCell.classList.add('actions-cell');
        actionsCell.setAttribute('data-label', 'Actions');
        newRow.appendChild(actionsCell);
        
        // Insert at correct position based on importance
        this.insertRowSorted(tableBody, newRow, parseFloat(importance));
    }
    
    insertRowSorted(tableBody, newRow, importance) {
        // Determine which column index to use for importance based on table type
        const importanceColumnIndex = tableBody === this.elements.committedTableBody ? 2 : 1;
        
        // Find insertion index using binary search
        const index = this.findInsertionIndex(tableBody, importance, importanceColumnIndex);
        
        // Insert the row at the correct index
        const rows = tableBody.querySelectorAll('tr');
        if (rows.length === 0 || index >= rows.length) {
            tableBody.appendChild(newRow);
        } else {
            tableBody.insertBefore(newRow, rows[index]);
        }
    }
    
    findInsertionIndex(tableBody, importance, columnIndex) {
        const rows = Array.from(tableBody.querySelectorAll('tr'));
        let low = 0, high = rows.length - 1;
        
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midImportance = parseFloat(rows[mid].children[columnIndex].textContent);
            
            if (midImportance < importance) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        
        return low;
    }
    
    // Method for collecting knowledge data from the temporary table
    collectKnowledgeData() {
        const knowledgeEntries = [];
        const rows = this.elements.tableBody?.querySelectorAll('tr') || [];

        rows.forEach(row => {
            const factText = row.cells[0].textContent;
            const importanceText = row.cells[1].textContent;
            knowledgeEntries.push({ 
                [this.config.textFieldName]: factText, 
                [this.config.priorityFieldName]: parseInt(importanceText) 
            });
        });

        return knowledgeEntries;
    }
    
    // Method for getting ID from URL
    getIdFromUrl() {
        return this.entityId;
    }
    
    // Method for sending knowledge data - wrapper for handleSubmitInfo
    sendKnowledgeData(knowledgeData) {
        if (!this.entityId) {
            throw new Error(`No ${this.config.entityType} ID available`);
        }
        
        console.log('Sending data:', knowledgeData);
        
        const url = `${this.config.apiBaseUrl}/addKnowledge/${this.entityId}`;
        
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(knowledgeData)
        })
        .then(response => {
            console.log('Response:', response);
            return response.json();
        })
        .then(data => {
            console.log('Data sent successfully:', data);
            return data;
        })
        .catch(error => {
            console.error('Error sending data:', error);
            throw error;
        });
    }
}
