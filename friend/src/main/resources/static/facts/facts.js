// Knowledge Table Management Module
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const knowledgeForm = document.getElementById('knowledgeForm');
    const knowledgeTableBody = document.querySelector('#knowledgeTable tbody');
    const committedTableBody = document.querySelector('#committedTable tbody');
    const submitInfoBtn = document.getElementById('submitInfoBtn');

    // Configuration
    const API_BASE_URL = 'http://localhost:8085';
    
    // Table Management Class
    class KnowledgeTableManager {
        constructor() {
            this.initEventListeners();
        }
        
        initEventListeners() {
            // Form submission
            if (knowledgeForm) {
                knowledgeForm.addEventListener('submit', this.handleFormSubmit.bind(this));
            }
            
            // Submit button
            if (submitInfoBtn) {
                submitInfoBtn.addEventListener('click', this.handleSubmitInfo.bind(this));
            }
            
            // Initialize existing table rows
            this.initExistingTableRows();
        }
        
        initExistingTableRows() {
            const tableRows = document.querySelectorAll('#committedTable tbody tr');
            
            tableRows.forEach(row => {
                const updateButton = row.querySelector('.updateKnowledgeBtn');
                const deleteButton = row.querySelector('.deleteKnowledgeBtn');
                const knowledgeId = row.getAttribute('data-id');
                
                if (updateButton) {
                    updateButton.addEventListener('click', () => this.handleUpdate(row, knowledgeId));
                }
                
                if (deleteButton) {
                    deleteButton.addEventListener('click', () => this.handleDelete(row, knowledgeId));
                }
            });
        }
        
        handleFormSubmit(e) {
            e.preventDefault();
            
            const factInput = document.getElementById('factInput');
            const importanceInput = document.getElementById('importanceInput');
            
            const fact = factInput.value.trim();
            const importance = importanceInput.value.trim();
            
            if (fact && importance) {
                this.addRowToTable(knowledgeTableBody, fact, importance);
                
                // Clear inputs
                factInput.value = '';
                importanceInput.value = '';
            } else {
                alert('Please enter both a fact and its importance!');
            }
        }
        
        handleSubmitInfo(e) {
            e.preventDefault();
            
            const knowledgeData = this.collectKnowledgeData();
            
            this.sendKnowledgeData(knowledgeData)
                .then(data => {
                    if (data && data.ids) {
                        data.ids.forEach((id, index) => {
                            const { fact, importance } = knowledgeData[index];
                            this.addRowToTable(committedTableBody, fact, importance, id);
                        });
                    }
                    
                    // Clear the temporary table
                    if (knowledgeTableBody) {
                        knowledgeTableBody.innerHTML = '';
                    }
                })
                .catch(error => {
                    console.error('Error processing knowledge data:', error);
                });
        }
        
        handleUpdate(row, knowledgeId) {
            const fact = row.cells[1].innerText;
            const importance = row.cells[2].innerText;
            
            const knowledgeData = {
                id: knowledgeId,
                fact: fact,
                importance: importance
            };
            
            // Remove the row from the table
            row.remove();
            
            // Add the updated row back
            this.addRowToTable(committedTableBody, fact, importance, knowledgeId);
            
            // Send update request
            fetch(`${API_BASE_URL}/updateKnowledge`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(knowledgeData)
            })
            .then(response => response.text())
            .then(data => console.log('Knowledge updated:', data))
            .catch(error => console.error('Error updating knowledge:', error));
        }
        
        handleDelete(row, knowledgeId) {
            fetch(`${API_BASE_URL}/deleteKnowledge/${knowledgeId}`, {
                method: 'DELETE'
            })
            .then(response => response.text())
            .then(data => {
                console.log('Knowledge deleted:', data);
                row.remove();
            })
            .catch(error => console.error('Error deleting knowledge:', error));
        }
        
        addRowToTable(tableBody, fact, importance, id = null) {
            if (!tableBody) return;
            
            // Create new row and cells
            const newRow = document.createElement('tr');
            if (id) newRow.setAttribute('data-id', id);
            
            // Different structure based on table type
            if (tableBody === committedTableBody) {
                // ID cell for committed table
                const idCell = document.createElement('td');
                idCell.textContent = id || '';
                newRow.appendChild(idCell);
            }
            
            // Fact cell
            const factCell = document.createElement('td');
            factCell.textContent = fact;
            factCell.setAttribute('contenteditable', 'true');
            newRow.appendChild(factCell);
            
            // Importance cell
            const importanceCell = document.createElement('td');
            importanceCell.textContent = importance;
            importanceCell.setAttribute('contenteditable', 'true');
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
            if (tableBody === knowledgeTableBody) {
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
            actionsCell.style.minWidth = '300px';
            actionsCell.style.display = 'flex';
            actionsCell.style.justifyContent = 'space-around';
            newRow.appendChild(actionsCell);
            
            // Insert at correct position based on importance
            this.insertRowSorted(tableBody, newRow, parseFloat(importance));
        }
        
        insertRowSorted(tableBody, newRow, importance) {
            // Determine which column index to use for importance based on table type
            const importanceColumnIndex = tableBody === committedTableBody ? 2 : 1;
            
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
        
        // Preserved method for collecting knowledge data
        collectKnowledgeData() {
            const knowledgeEntries = [];
            const rows = document.querySelectorAll('#knowledgeTable tbody tr');

            rows.forEach(row => {
                const fact = row.cells[0].textContent;
                const importance = row.cells[1].textContent;
                knowledgeEntries.push({ fact, importance });
            });

            return knowledgeEntries;
        }
        
        // Preserved method for getting ID from URL
        getIdFromUrl() {
            const path = window.location.pathname;
            return path.split('/').pop();
        }
        
        // Preserved method for sending knowledge data
        sendKnowledgeData(knowledgeData) {
            const id = this.getIdFromUrl();
            
            console.log('Sending data:', knowledgeData);
            
            return fetch(`${API_BASE_URL}/addKnowledge/${id}`, {
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
    
    // Initialize the knowledge table manager
    const tableManager = new KnowledgeTableManager();

    // Export methods to be used in other modules
    window.KnowledgeTableManager = {
        collectKnowledgeData: () => new KnowledgeTableManager().collectKnowledgeData(),
        sendKnowledgeData: (knowledgeData) => new KnowledgeTableManager().sendKnowledgeData(knowledgeData),
        getIdFromUrl: () => new KnowledgeTableManager().getIdFromUrl()
    };
});

// Export for module-based systems
export const collectKnowledgeData = () => {
    const knowledgeEntries = [];
    const rows = document.querySelectorAll('#knowledgeTable tbody tr');

    rows.forEach(row => {
        const fact = row.cells[0].textContent;
        const importance = row.cells[1].textContent;
        knowledgeEntries.push({ fact, importance });
    });

    return knowledgeEntries;
};

export const sendKnowledgeData = (knowledgeData) => {
    const id = getIdFromUrl();
    
    console.log('Sending data:', knowledgeData);
    
    return fetch(`http://localhost:8085/addKnowledge/${id}`, {
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
};

export const getIdFromUrl = () => {
    const path = window.location.pathname;
    return path.split('/').pop();
};