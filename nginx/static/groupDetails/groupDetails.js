// groupDetails.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Group Details page loaded');
    
    // Auto-hide flash messages
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 5000);
    });

    // Initialize interactive features
    initializeCollapsibleSections();
    
    // Initialize navigation handlers
    initializeNavigation();
});

/**
 * Initialize navigation handlers
 */
function initializeNavigation() {
    // Handle back to groups button
    const backButtons = document.querySelectorAll('a[href="/groups"], .button[href="/groups"]');
    backButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToGroups();
        });
    });

    // Handle edit group button (if it exists)
    const editButtons = document.querySelectorAll('[data-action="edit"]');
    editButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const groupId = this.getAttribute('data-group-id');
            navigateToEditGroup(groupId);
        });
    });
}

/**
 * Navigate to groups list page
 */
function navigateToGroups() {
    window.location.href = '/groups';
}

/**
 * Navigate to edit group page
 * @param {number} groupId - The ID of the group to edit
 */
function navigateToEditGroup(groupId) {
    window.location.href = `/groups/${groupId}/edit`;
}

/**
 * Delete a group with confirmation
 * @param {number} groupId - The ID of the group to delete
 */
function deleteGroup(groupId) {
    const confirmMessage = 'Are you sure you want to delete this group?\n\n' +
                          'This action will permanently delete:\n' +
                          '• The group and all its information\n' +
                          '• All associated knowledge items\n' +
                          '• All group permissions\n\n' +
                          'This action cannot be undone.';

    if (confirm(confirmMessage)) {
        // Show loading state
        const deleteButton = event.target;
        const originalText = deleteButton.textContent;
        deleteButton.textContent = 'Deleting...';
        deleteButton.disabled = true;

        // Make API call to delete the group
        fetch(`/api/groups/${groupId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccessMessage(data.message);
                // Navigate back to groups list after a short delay
                setTimeout(() => {
                    navigateToGroups();
                }, 1500);
            } else {
                showErrorMessage(data.message);
                // Reset button state
                deleteButton.textContent = originalText;
                deleteButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error deleting group:', error);
            showErrorMessage('Failed to delete group. Please try again.');
            // Reset button state
            deleteButton.textContent = originalText;
            deleteButton.disabled = false;
        });
    }
}

/**
 * Show success message
 * @param {string} message - The success message
 */
function showSuccessMessage(message) {
    showMessage(message, 'alert-success');
}

/**
 * Show error message
 * @param {string} message - The error message
 */
function showErrorMessage(message) {
    showMessage(message, 'alert-error');
}

/**
 * Show message with specified type
 * @param {string} message - The message to show
 * @param {string} type - The alert type (alert-success, alert-error, etc.)
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

/**
 * Add new knowledge item (relationship note)
 */
function addKnowledge() {
    const title = prompt('Enter note title:');
    if (!title || title.trim() === '') {
        return;
    }

    const content = prompt('Enter note content (relationship insights, important details, etc.):');
    if (!content || content.trim() === '') {
        return;
    }

    // Get group ID from URL or data attribute
    const groupId = getGroupId();
    if (!groupId) {
        alert('Error: Group ID not found');
        return;
    }

    // Create knowledge item via API call
    createKnowledgeItem(groupId, title.trim(), content.trim());
}

/**
 * Edit knowledge item
 * @param {number} knowledgeId - The ID of the knowledge item to edit
 */
function editKnowledge(knowledgeId) {
    // Find the knowledge item element
    const knowledgeItems = document.querySelectorAll('.knowledge-item');
    let targetItem = null;
    
    for (const item of knowledgeItems) {
        const editButton = item.querySelector(`button[onclick*="${knowledgeId}"]`);
        if (editButton) {
            targetItem = item;
            break;
        }
    }

    if (!targetItem) {
        alert('Knowledge item not found');
        return;
    }

    const currentTitle = targetItem.querySelector('h4').textContent;
    const currentContent = targetItem.querySelector('p').textContent;

    const newTitle = prompt('Edit knowledge title:', currentTitle);
    if (newTitle === null) return; // User cancelled

    const newContent = prompt('Edit knowledge content:', currentContent);
    if (newContent === null) return; // User cancelled

    // Update knowledge item via API call
    updateKnowledgeItem(knowledgeId, newTitle.trim(), newContent.trim());
}

/**
 * Delete knowledge item
 * @param {number} knowledgeId - The ID of the knowledge item to delete
 */
function deleteKnowledge(knowledgeId) {
    if (confirm('Are you sure you want to delete this knowledge item? This action cannot be undone.')) {
        // Delete knowledge item via API call
        deleteKnowledgeItem(knowledgeId);
    }
}

/**
 * Add new permission (group setting)
 */
function addPermission() {
    const permissionType = prompt('Enter setting type (e.g., PRIVACY, NOTIFICATION, ACCESS):');
    if (!permissionType || permissionType.trim() === '') {
        return;
    }

    const description = prompt('Enter setting description:');
    if (!description || description.trim() === '') {
        return;
    }

    // Get group ID
    const groupId = getGroupId();
    if (!groupId) {
        alert('Error: Group ID not found');
        return;
    }

    // Create permission via API call
    createPermission(groupId, permissionType.trim().toUpperCase(), description.trim());
}

/**
 * Edit permission
 * @param {number} permissionId - The ID of the permission to edit
 */
function editPermission(permissionId) {
    // Find the permission item element
    const permissionItems = document.querySelectorAll('.permission-item');
    let targetItem = null;
    
    for (const item of permissionItems) {
        const editButton = item.querySelector(`button[onclick*="${permissionId}"]`);
        if (editButton) {
            targetItem = item;
            break;
        }
    }

    if (!targetItem) {
        alert('Permission not found');
        return;
    }

    const currentType = targetItem.querySelector('h4').textContent;
    const currentDescription = targetItem.querySelector('p').textContent;

    const newType = prompt('Edit permission type:', currentType);
    if (newType === null) return; // User cancelled

    const newDescription = prompt('Edit permission description:', currentDescription);
    if (newDescription === null) return; // User cancelled

    // Update permission via API call
    updatePermission(permissionId, newType.trim().toUpperCase(), newDescription.trim());
}

/**
 * Delete permission
 * @param {number} permissionId - The ID of the permission to delete
 */
function deletePermission(permissionId) {
    if (confirm('Are you sure you want to delete this permission? This action cannot be undone.')) {
        // Delete permission via API call
        deletePermissionItem(permissionId);
    }
}

/**
 * Get group ID from various sources
 * @returns {number|null} The group ID or null if not found
 */
function getGroupId() {
    // Try to get from URL
    const pathParts = window.location.pathname.split('/');
    const groupsIndex = pathParts.indexOf('groups');
    if (groupsIndex !== -1 && pathParts[groupsIndex + 1]) {
        const id = parseInt(pathParts[groupsIndex + 1]);
        if (!isNaN(id)) {
            return id;
        }
    }

    // Try to get from data attribute
    const container = document.querySelector('.container');
    if (container && container.dataset.groupId) {
        const id = parseInt(container.dataset.groupId);
        if (!isNaN(id)) {
            return id;
        }
    }

    return null;
}

/**
 * API call to create knowledge item
 * @param {number} groupId - The group ID
 * @param {string} title - The knowledge title
 * @param {string} content - The knowledge content
 */
function createKnowledgeItem(groupId, title, content) {
    // This would typically be an AJAX call to your backend
    // For now, we'll show a message and reload the page
    alert('Knowledge item creation functionality would be implemented here.\n\n' +
          `Group ID: ${groupId}\n` +
          `Title: ${title}\n` +
          `Content: ${content}`);
    
    // In a real implementation, you would make an API call like:
    /*
    fetch(`/api/groups/${groupId}/knowledge`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content })
    })
    .then(response => response.json())
    .then(data => {
        // Handle success
        location.reload();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to create knowledge item');
    });
    */
}

/**
 * API call to update knowledge item
 * @param {number} knowledgeId - The knowledge ID
 * @param {string} title - The new title
 * @param {string} content - The new content
 */
function updateKnowledgeItem(knowledgeId, title, content) {
    alert('Knowledge item update functionality would be implemented here.\n\n' +
          `Knowledge ID: ${knowledgeId}\n` +
          `Title: ${title}\n` +
          `Content: ${content}`);
}

/**
 * API call to delete knowledge item
 * @param {number} knowledgeId - The knowledge ID
 */
function deleteKnowledgeItem(knowledgeId) {
    alert('Knowledge item deletion functionality would be implemented here.\n\n' +
          `Knowledge ID: ${knowledgeId}`);
}

/**
 * API call to create permission
 * @param {number} groupId - The group ID
 * @param {string} type - The permission type
 * @param {string} description - The permission description
 */
function createPermission(groupId, type, description) {
    alert('Permission creation functionality would be implemented here.\n\n' +
          `Group ID: ${groupId}\n` +
          `Type: ${type}\n` +
          `Description: ${description}`);
}

/**
 * API call to update permission
 * @param {number} permissionId - The permission ID
 * @param {string} type - The new permission type
 * @param {string} description - The new permission description
 */
function updatePermission(permissionId, type, description) {
    alert('Permission update functionality would be implemented here.\n\n' +
          `Permission ID: ${permissionId}\n` +
          `Type: ${type}\n` +
          `Description: ${description}`);
}

/**
 * API call to delete permission
 * @param {number} permissionId - The permission ID
 */
function deletePermissionItem(permissionId) {
    alert('Permission deletion functionality would be implemented here.\n\n' +
          `Permission ID: ${permissionId}`);
}

/**
 * Initialize collapsible sections
 */
function initializeCollapsibleSections() {
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    sectionHeaders.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
            const section = this.parentElement;
            const content = section.querySelector('.knowledge-container, .permissions-container, .description-content');
            
            if (content) {
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    header.style.opacity = '1';
                } else {
                    content.style.display = 'none';
                    header.style.opacity = '0.7';
                }
            }
        });
    });
}
