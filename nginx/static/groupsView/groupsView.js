// groupsView.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Groups View loaded');
    
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

    // Add click handlers for group links
    initializeGroupLinks();
});

/**
 * Initialize click handlers for group navigation
 */
function initializeGroupLinks() {
    // Handle group detail links
    const groupLinks = document.querySelectorAll('[data-group-id]');
    groupLinks.forEach(link => {
        if (link.getAttribute('data-action') !== 'delete') {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const groupId = this.getAttribute('data-group-id');
                navigateToGroupDetails(groupId);
            });
        }
    });

    // Handle create group button
    const createGroupBtns = document.querySelectorAll('a[href="/groups/create"], .button[href="/groups/create"]');
    createGroupBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToCreateGroup();
        });
    });
}

/**
 * Navigate to group details page
 * @param {number} groupId - The ID of the group
 */
function navigateToGroupDetails(groupId) {
    window.location.href = `/groups/${groupId}`;
}

/**
 * Navigate to group knowledge page
 * @param {number} groupId - The ID of the group
 */
function navigateToGroupKnowledge(groupId) {
    window.location.href = `/groups/${groupId}/knowledge`;
}

/**
 * Navigate to create group page
 */
function navigateToCreateGroup() {
    window.location.href = '/groups/create';
}

/**
 * Navigate to groups list page
 */
function navigateToGroups() {
    window.location.href = '/groups';
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

        // Make API call to delete the group with better error handling
        fetch(`/api/groups/${groupId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                // If API fails, try to parse error message
                return response.json().catch(() => {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }).then(errorData => {
                    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showSuccessMessage(data.message);
                // Refresh the page or remove the group element
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
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
