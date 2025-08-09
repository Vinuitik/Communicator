// groupDetails.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Group Details page loaded');
    
    // Auto-hide flash messages after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 5000);
    });

    // Initialize group details functionality
    initializeGroupDetails();
});

/**
 * Initialize group details functionality
 */
function initializeGroupDetails() {
    // Get group ID from URL or data attribute
    const groupId = getGroupIdFromUrl();
    
    if (groupId) {
        loadGroupDetails(groupId);
    }
    
    // Initialize knowledge management if present
    if (document.querySelector('#knowledgeForm')) {
        initializeKnowledgeManagement(groupId);
    }
}

/**
 * Get group ID from current URL
 */
function getGroupIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    const groupsIndex = pathParts.indexOf('groups');
    
    if (groupsIndex !== -1 && pathParts[groupsIndex + 1]) {
        return pathParts[groupsIndex + 1];
    }
    
    // Also check for data attribute
    const container = document.querySelector('[data-group-id]');
    if (container) {
        return container.getAttribute('data-group-id');
    }
    
    return null;
}

/**
 * Load group details from API
 */
async function loadGroupDetails(groupId) {
    try {
        const response = await fetch(`/api/groups/${groupId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.group) {
            updateGroupDetails(data.group);
        } else {
            showErrorMessage(data.message || 'Failed to load group details');
        }
        
    } catch (error) {
        console.error('Error loading group details:', error);
        showErrorMessage('Failed to load group details. Please try again.');
    }
}

/**
 * Update group details in the UI
 */
function updateGroupDetails(group) {
    // Update group name if element exists
    const groupNameElement = document.querySelector('#groupName, .group-name');
    if (groupNameElement) {
        groupNameElement.textContent = group.name;
    }
    
    // Update group ID if element exists
    const groupIdElement = document.querySelector('#groupId, .group-id');
    if (groupIdElement) {
        groupIdElement.textContent = `Group ID: ${group.id}`;
    }
    
    // Update description if element exists
    const descriptionElement = document.querySelector('#groupDescription, .group-description');
    if (descriptionElement && group.description) {
        descriptionElement.textContent = group.description;
    }
}

/**
 * Initialize knowledge management functionality
 */
function initializeKnowledgeManagement(groupId) {
    const knowledgeForm = document.querySelector('#knowledgeForm');
    
    if (knowledgeForm) {
        knowledgeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addKnowledge(groupId);
        });
    }
    
    // Initialize edit/delete handlers for existing knowledge items
    initializeKnowledgeActions(groupId);
}

/**
 * Add new knowledge item
 */
async function addKnowledge(groupId) {
    const titleInput = document.querySelector('#knowledgeTitle');
    const contentInput = document.querySelector('#knowledgeContent');
    
    if (!titleInput || !contentInput) {
        showErrorMessage('Knowledge form elements not found');
        return;
    }
    
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) {
        showErrorMessage('Please fill in both title and content');
        return;
    }
    
    try {
        const knowledgeData = [{
            text: content,
            priority: 1
        }];
        
        const response = await fetch(`/api/groups/addKnowledge/${groupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(knowledgeData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('Knowledge added successfully!');
            titleInput.value = '';
            contentInput.value = '';
            // Reload knowledge list
            location.reload();
        } else {
            showErrorMessage(data.message || 'Failed to add knowledge');
        }
        
    } catch (error) {
        console.error('Error adding knowledge:', error);
        showErrorMessage('Failed to add knowledge. Please try again.');
    }
}

/**
 * Initialize knowledge action handlers (edit/delete)
 */
function initializeKnowledgeActions(groupId) {
    // Handle edit buttons
    document.querySelectorAll('.edit-knowledge').forEach(button => {
        button.addEventListener('click', function() {
            const knowledgeId = this.getAttribute('data-knowledge-id');
            editKnowledge(knowledgeId);
        });
    });
    
    // Handle delete buttons
    document.querySelectorAll('.delete-knowledge').forEach(button => {
        button.addEventListener('click', function() {
            const knowledgeId = this.getAttribute('data-knowledge-id');
            deleteKnowledge(knowledgeId);
        });
    });
}

/**
 * Edit knowledge item
 */
function editKnowledge(knowledgeId) {
    // Implementation for editing knowledge
    console.log('Edit knowledge:', knowledgeId);
    // This would typically open a modal or inline edit form
}

/**
 * Delete knowledge item
 */
async function deleteKnowledge(knowledgeId) {
    if (!confirm('Are you sure you want to delete this knowledge item?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/deleteKnowledge/${knowledgeId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage('Knowledge deleted successfully!');
            // Remove the knowledge item from the DOM or reload
            location.reload();
        } else {
            showErrorMessage(data.message || 'Failed to delete knowledge');
        }
        
    } catch (error) {
        console.error('Error deleting knowledge:', error);
        showErrorMessage('Failed to delete knowledge. Please try again.');
    }
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
    showMessage(message, 'alert-success');
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    showMessage(message, 'alert-error');
}

/**
 * Show message with specified type
 */
function showMessage(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;

    // Insert at the top of the container
    const container = document.querySelector('.container');
    const firstChild = container.querySelector('h1').nextElementSibling;
    container.insertBefore(alert, firstChild);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 5000);
}
