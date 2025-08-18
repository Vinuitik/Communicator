/**
 * URL and Navigation Helper utilities
 */

export class URLHelper {
    /**
     * Get group ID from URL parameters
     * Supports both query param style (?groupId=52) and path style (/group/social/52).
     * @returns {string|null} Group ID or null if not found
     */
    static getGroupIdFromURL() {

        // 1) Try to parse path like /group/social/{groupId} (may be at start or deeper)
        try {
            const pathname = window.location.pathname || '';
            // Match /group/social/<id> where id can be any non-slash sequence
            const re = /\/group\/social\/([^\/\?#]+)/i;
            const m = pathname.match(re);
            if (m && m[1]) return decodeURIComponent(m[1]);
        } catch (e) {
            // ignore and continue to DOM fallback
        }

        // 3) DOM fallback: look for element that may have data-group-id
        try {
            const root = document.getElementById('group-social-root') || document.querySelector('[data-group-id]');
            if (root) {
                const datasetId = root.dataset && (root.dataset.groupId || root.dataset.groupid);
                if (datasetId) return datasetId;
            }
        } catch (e) {
            // final fallback -> null
        }

        return null;
    }

    /**
     * Get any parameter from URL
     * @param {string} paramName Parameter name to retrieve
     * @returns {string|null} Parameter value or null if not found
     */
    static getURLParameter(paramName) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(paramName);
    }

    /**
     * Add or update URL parameter without page reload
     * @param {string} paramName Parameter name
     * @param {string} paramValue Parameter value
     */
    static updateURLParameter(paramName, paramValue) {
        const url = new URL(window.location);
        url.searchParams.set(paramName, paramValue);
        window.history.replaceState({}, '', url);
    }

    /**
     * Check if a string is a valid URL
     * @param {string} string String to check
     * @returns {boolean} True if valid URL
     */
    static isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Open URL in new tab safely
     * @param {string} url URL to open
     */
    static openInNewTab(url) {
        if (this.isValidURL(url)) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Extract domain from URL for display
     * @param {string} url Full URL
     * @returns {string} Domain name or original URL if invalid
     */
    static extractDomain(url) {
        try {
            const urlObject = new URL(url);
            return urlObject.hostname;
        } catch (_) {
            return url;
        }
    }
}
