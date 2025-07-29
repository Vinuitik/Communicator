/**
 * Fallback Social Media Management Script (Non-module version)
 * Use this if the module version doesn't load properly
 */

// Simple URL helper
const URLHelper = {
    getFriendIdFromURL: function() {
        // First try to get from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const friendIdFromQuery = urlParams.get('friendId');
        
        if (friendIdFromQuery) {
            return friendIdFromQuery;
        }
        
        // Then try to get from path (e.g., /social/123)
        const pathSegments = window.location.pathname.split('/');
        const socialIndex = pathSegments.indexOf('social');
        
        if (socialIndex !== -1 && pathSegments[socialIndex + 1]) {
            const friendIdFromPath = pathSegments[socialIndex + 1];
            // Validate it's a number
            if (/^\d+$/.test(friendIdFromPath)) {
                return friendIdFromPath;
            }
        }
        
        return null;
    },
    
    navigateToProfile: function(friendId) {
        window.location.href = `/profile?friendId=${friendId}`;
    }
};

// Simple message manager
const MessageManager = {
    showMessage: function(message, type = 'info') {
        const container = document.getElementById('messageContainer');
        if (!container) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        container.appendChild(messageElement);
        
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    },
    
    showSuccess: function(message) {
        this.showMessage(message, 'success');
    },
    
    showError: function(message) {
        this.showMessage(message, 'error');
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const friendId = URLHelper.getFriendIdFromURL();
    
    if (!friendId) {
        MessageManager.showError('Friend ID not found in URL');
        return;
    }
    
    // Display friend ID in the subtitle
    const friendNameDisplay = document.getElementById('friendNameDisplay');
    if (friendNameDisplay) {
        friendNameDisplay.textContent = `Managing social media for Friend ID: ${friendId}`;
    }
    
    // Set up back button
    const backButton = document.getElementById('backToProfile');
    if (backButton) {
        backButton.addEventListener('click', function() {
            URLHelper.navigateToProfile(friendId);
        });
    }
    
    console.log('Social media management initialized with friend ID:', friendId);
    MessageManager.showSuccess('Social media management loaded successfully');
});
