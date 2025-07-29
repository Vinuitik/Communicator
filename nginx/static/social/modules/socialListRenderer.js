/**
 * Social List Renderer for displaying social media links
 */

import { PLATFORM_ICONS } from './config.js';

export class SocialListRenderer {
    /**
     * Render the social media list
     * @param {Array} socials Array of social media links
     */
    static renderSocialList(socials) {
        const socialList = document.getElementById('socialList');
        
        if (socials.length === 0) {
            socialList.innerHTML = this.getEmptyStateHTML();
            return;
        }

        socialList.innerHTML = socials.map(social => this.getSocialItemHTML(social)).join('');
    }

    /**
     * Generate HTML for a social media item
     * @param {Object} social Social media data
     * @returns {string} HTML string
     */
    static getSocialItemHTML(social) {
        
        const icon = PLATFORM_ICONS[social.platform] || '🔗';
        const displayName = social.displayName || social.platform;
        const url = social.URL || social.url || 'No URL';
        
        return `
            <div class="social-item" data-platform="${social.platform}">
                <div class="social-info">
                    <div class="social-icon">${icon}</div>
                    <div class="social-details">
                        <div class="social-platform">${social.platform}</div>
                        ${social.displayName ? `<div class="social-display-name">${social.displayName}</div>` : ''}
                        <a href="${url}" target="_blank" class="social-url">${url}</a>
                    </div>
                </div>
                <div class="social-actions">
                    <button class="action-btn edit-btn" onclick="socialManager.editSocial(${social.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="action-btn delete-btn" onclick="socialManager.deleteSocial(${social.id})" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Generate empty state HTML
     * @returns {string} HTML string for empty state
     */
    static getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📱</div>
                <div class="empty-state-text">No social media links yet</div>
                <div class="empty-state-subtext">Add social media links to keep track of how to reach this friend</div>
            </div>
        `;
    }
}
