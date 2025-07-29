/**
 * Social Media Management Application - Main Entry Point
 * Modular version with separated concerns
 */

import { URLHelper } from './modules/urlHelper.js';
import { MessageManager } from './modules/messageManager.js';
import { SocialMediaManager } from './modules/socialMediaManager.js';

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
    
    // Export for global access after initialization
    window.socialManager = socialManager;
});
