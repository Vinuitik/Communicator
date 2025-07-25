/**
 * Message Manager for displaying user notifications
 */

import { CONFIG } from './config.js';

export class MessageManager {
    /**
     * Show a message to the user
     * @param {string} message Message text
     * @param {string} type Message type (success, error, info)
     */
    static showMessage(message, type = 'info') {
        const container = document.getElementById('messageContainer');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        container.appendChild(messageElement);
        
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, CONFIG.MESSAGE_DURATION);
    }

    /**
     * Show success message
     * @param {string} message Success message
     */
    static showSuccess(message) {
        this.showMessage(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message Error message
     */
    static showError(message) {
        this.showMessage(message, 'error');
    }
}
