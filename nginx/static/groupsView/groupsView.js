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
});

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

        // Create a form and submit it for deletion
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `/groups/${groupId}/delete`;
        
        document.body.appendChild(form);
        form.submit();
        
        // Reset button state if submission fails (shouldn't happen normally)
        setTimeout(() => {
            deleteButton.textContent = originalText;
            deleteButton.disabled = false;
        }, 5000);
    }
}
