/**
 * Social Links Manager for Profile Page
 * Loads and displays social media links in the profile
 */

class ProfileSocialManager {
    constructor(friendId) {
        this.friendId = friendId;
        this.container = document.getElementById('socialLinksContainer');
        this.platformIcons = {
            'Instagram': '📸',
            'Facebook': '👤',
            'Twitter': '🐦',
            'LinkedIn': '💼',
            'GitHub': '💻',
            'YouTube': '🎥',
            'TikTok': '🎵',
            'Snapchat': '👻',
            'WhatsApp': '💬',
            'Telegram': '✈️',
            'Phone': '📞',
            'Email': '📧',
            'Website': '🌐',
            'Other': '🔗'
        };
    }

    /**
     * Initialize the social links manager
     */
    async initialize() {
        await this.loadSocialLinks();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for social interactions
     */
    setupEventListeners() {
        // Add Social button click handler
        const addSocialBtn = document.querySelector('.add-social-btn');
        if (addSocialBtn) {
            addSocialBtn.addEventListener('click', () => {
                const friendId = addSocialBtn.dataset.friendId;
                window.location.href = `/social/social.html?friendId=${friendId}`;
            });
        }
    }

    /**
     * Load social links from the API
     */
    async loadSocialLinks() {
        try {
            const response = await fetch(`/socials/${this.friendId}`);
            
            if (response.ok) {
                const socials = await response.json();
                this.renderSocialLinks(socials);
            } else if (response.status === 404) {
                // Friend not found
                this.renderError('Friend not found');
            } else {
                // Other errors
                console.error('Error loading social links, status:', response.status);
                this.renderError('Unable to load social media links');
            }
        } catch (error) {
            console.error('Error loading social links:', error);
            this.renderError('Network error - unable to load social media links');
        }
    }

    /**
     * Render social links in the container
     * @param {Array} socials Array of social media links
     */
    renderSocialLinks(socials) {
        if (!socials || socials.length === 0) {
            this.renderEmptyState();
            return;
        }

        const socialLinksHTML = socials.map(social => this.createSocialLinkHTML(social)).join('');
        this.container.innerHTML = socialLinksHTML;
    }

    /**
     * Create HTML for a single social link
     * @param {Object} social Social media data
     * @returns {string} HTML string
     */
    createSocialLinkHTML(social) {
        const icon = this.platformIcons[social.platform] || '🔗';
        const displayText = social.displayName || social.platform;
        const platformClass = social.platform.toLowerCase().replace(/\s+/g, '');
        
        return `
            <a href="${social.url}" target="_blank" class="social-link ${platformClass}" title="Open ${social.platform}">
                <i>${icon}</i> ${social.platform}: ${displayText}
            </a>
        `;
    }

    /**
     * Render empty state when no social links exist
     */
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="social-empty-state">
                <p>No social media links added yet.</p>
                <small>Click "Add Social" to add social media links for this friend.</small>
            </div>
        `;
    }

    /**
     * Render error state when loading fails
     */
    renderError(message = 'Unable to load social media links') {
        this.container.innerHTML = `
            <div class="social-error-state">
                <p>${message}</p>
                <button onclick="profileSocialManager.loadSocialLinks()" class="retry-btn">
                    Retry
                </button>
            </div>
        `;
    }
}

// Global variable for the social manager
let profileSocialManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get friend ID from the page context (assuming it's available globally)
    const friendId = window.friendId || document.querySelector('[data-friend-id]')?.dataset.friendId;
    
    if (friendId) {
        profileSocialManager = new ProfileSocialManager(friendId);
        profileSocialManager.initialize();
    }
});
