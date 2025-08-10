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
                window.location.href = `/social?friendId=${friendId}`;
            });
        }
    }

    /**
     * Load social links from the API
     */
    async loadSocialLinks() {
        try {
            console.log('Loading social links for friend ID:', this.friendId);
            const response = await fetch(`/api/friend/socials/${this.friendId}`);
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const socials = await response.json();
                console.log('Received socials data:', socials);
                console.log('Number of socials:', socials.length);
                
                // Log each social object structure
                socials.forEach((social, index) => {
                    console.log(`Social ${index + 1}:`, {
                        id: social.id,
                        platform: social.platform,
                        URL: social.URL,
                        url: social.url,
                        displayName: social.displayName
                    });
                });
                
                this.renderSocialLinks(socials);
            } else if (response.status === 404) {
                console.log('404 error: Friend not found');
                this.renderError('Friend not found');
            } else {
                console.error('Error loading social links, status:', response.status);
                const errorText = await response.text();
                console.error('Error response text:', errorText);
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
        console.log('Creating HTML for social:', social);
        
        const icon = this.platformIcons[social.platform] || '🔗';
        const displayText = social.displayName || social.platform;
        const platformClass = social.platform.toLowerCase().replace(/\s+/g, '');
        
        // Handle both URL and url fields (backend inconsistency)
        const rawUrl = social.URL || social.url;
        const actualUrl = this.formatUrlForPlatform(rawUrl, social.platform);
        
        console.log('Final HTML details:', {
            icon,
            displayText,
            platformClass,
            rawUrl,
            actualUrl
        });
        
        return `
            <a href="${actualUrl}" target="_blank" class="social-link ${platformClass}" title="Open ${social.platform}">
                <i>${icon}</i> ${social.platform}: ${displayText}
            </a>
        `;
    }

    /**
     * Format URL based on platform for proper social media links
     * @param {string} url Raw URL from database
     * @param {string} platform Social media platform
     * @returns {string} Formatted URL for the platform
     */
    formatUrlForPlatform(url, platform) {
        console.log('formatUrlForPlatform called with:', { url, platform });
        
        if (!url) {
            console.log('URL is empty/null, returning #');
            return '#';
        }
        
        const trimmedUrl = url.trim();
        console.log('Trimmed URL:', trimmedUrl);
        
        // If it's already a full URL (starts with http/https), use it directly
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            console.log('URL is already full URL, using as-is:', trimmedUrl);
            return trimmedUrl;
        }
        
        // Handle special cases first
        if (platform.toLowerCase() === 'email') {
            // Email should open in default email client
            if (trimmedUrl.startsWith('mailto:')) {
                console.log('Email already has mailto, using as-is:', trimmedUrl);
                return trimmedUrl;
            }
            const emailUrl = `mailto:${trimmedUrl}`;
            console.log('Adding mailto to email:', emailUrl);
            return emailUrl;
        }
        
        if (platform.toLowerCase() === 'phone') {
            // For phone, do nothing (return # to prevent navigation)
            console.log('Phone platform, returning #');
            return '#';
        }
        
        // For non-URL entries, construct platform-specific URLs
        let finalUrl;
        switch (platform.toLowerCase()) {
            case 'instagram':
                const instagramHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://www.instagram.com/${instagramHandle}`;
                break;
                
            case 'facebook':
                const facebookHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://www.facebook.com/${facebookHandle}`;
                break;
                
            case 'twitter':
                const twitterHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://twitter.com/${twitterHandle}`;
                break;
                
            case 'linkedin':
                const linkedinHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://www.linkedin.com/in/${linkedinHandle}`;
                break;
                
            case 'github':
                const githubHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://github.com/${githubHandle}`;
                break;
                
            case 'youtube':
                const youtubeHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://www.youtube.com/${youtubeHandle}`;
                break;
                
            case 'tiktok':
                const tiktokHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://www.tiktok.com/@${tiktokHandle}`;
                break;
                
            case 'snapchat':
                const snapchatHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://snapchat.com/add/${snapchatHandle}`;
                break;
                
            case 'whatsapp':
                // For WhatsApp, if it's a phone number, create a WhatsApp link
                const phoneNumber = trimmedUrl.replace(/[^\d+]/g, '');
                if (phoneNumber.startsWith('+') || phoneNumber.length > 7) {
                    finalUrl = `https://wa.me/${phoneNumber.replace('+', '')}`;
                } else {
                    // If it's not a phone number, treat as username
                    const whatsappHandle = trimmedUrl.replace('@', '');
                    finalUrl = `https://wa.me/${whatsappHandle}`;
                }
                break;
                
            case 'telegram':
                const telegramHandle = trimmedUrl.replace('@', '');
                finalUrl = `https://t.me/${telegramHandle}`;
                break;
                
            case 'website':
            case 'other':
            default:
                // For websites and others, ensure it has a protocol
                finalUrl = `https://${trimmedUrl}`;
                break;
        }
        
        console.log('Formatted URL result:', finalUrl);
        return finalUrl;
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
