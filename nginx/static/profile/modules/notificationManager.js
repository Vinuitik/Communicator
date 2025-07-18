/**
 * Notification Manager Module
 * Handles showing success and error notifications
 */

const NotificationManager = {
    /**
     * Show success notification
     * @param {string} message - Success message to display
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    /**
     * Show error notification
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.showNotification(message, 'error');
    },

    /**
     * Show notification with specified type
     * @param {string} message - Message to display
     * @param {string} type - Notification type ('success' or 'error')
     */
    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `${type}-notification`;
        
        const icon = type === 'success' ? '✅' : '❌';
        const iconColor = type === 'success' ? '#22c55e' : '#ef4444';
        const backgroundColor = type === 'success' ? '#f0f9ff' : '#fef2f2';
        const borderColor = type === 'success' ? '#22c55e' : '#ef4444';
        
        notification.innerHTML = `
            <div class="notification-content">
                <i style="color: ${iconColor};">${icon}</i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            border: 1px solid ${borderColor};
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease-out;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Animate out and remove
        const displayTime = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, displayTime);
    }
};
