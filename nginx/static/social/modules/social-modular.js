/**
 * Social Media Management Application - Main Entry Point
 * Modular version with separated concerns
 */

import { URLHelper } from './urlHelper.js';
import { MessageManager } from './messageManager.js';
import { SocialMediaManager } from '../socialMediaManager.js';

// Global variable for the manager instance
let socialManager;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const friendId = URLHelper.getFriendIdFromURL();
    
    if (!friendId) {
        MessageManager.showError('Friend ID not found in URL');
        return;
    }

    socialManager = new SocialMediaManager(friendId);
    socialManager.initialize();
});

// Export for global access (needed for onclick handlers in HTML)
window.socialManager = socialManager;
