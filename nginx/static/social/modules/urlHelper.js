/**
 * URL Helper utilities for Social Media Management
 */

export class URLHelper {
    /**
     * Extract friend ID from URL parameters
     * @returns {string|null} Friend ID or null if not found
     */
    static getFriendIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('friendId');
    }

    /**
     * Navigate back to profile page
     * @param {string} friendId Friend ID
     */
    static navigateToProfile(friendId) {
        window.location.href = `/api/friends/profile/${friendId}`;
    }

    /**
     * Validate and format URL based on platform
     * @param {string} url Raw URL input
     * @param {string} platform Platform type
     * @returns {string} Formatted URL
     */
    static formatURL(url, platform) {
        const trimmedUrl = url.trim();
        
        switch (platform) {
            case 'Email':
                return trimmedUrl.includes('@') && !trimmedUrl.startsWith('mailto:') 
                    ? `mailto:${trimmedUrl}` 
                    : trimmedUrl;
            case 'Phone':
                return trimmedUrl.startsWith('tel:') 
                    ? trimmedUrl 
                    : `tel:${trimmedUrl.replace(/[^\d\+]/g, '')}`;
            default:
                return trimmedUrl.startsWith('http') 
                    ? trimmedUrl 
                    : `https://${trimmedUrl}`;
        }
    }
}
