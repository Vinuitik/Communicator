/**
 * Social Media Management Application
 * Follows SOLID principles and clean code practices
 */

// Configuration and Constants
const CONFIG = {
    API_BASE_URL: '/socials',
    MESSAGE_DURATION: 3000,
    VALIDATION_PATTERNS: {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        phone: /^[\+]?[0-9\s\-\(\)]{7,}$/,
        url: /^https?:\/\/.+/
    }
};

const PLATFORM_ICONS = {
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

// Utility Classes
class URLHelper {
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
        window.location.href = `/profile/${friendId}`;
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

class MessageManager {
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

class FormValidator {
    /**
     * Validate social media form data
     * @param {Object} formData Form data object
     * @returns {Object} Validation result with isValid and errors
     */
    static validateSocialForm(formData) {
        const errors = {};
        let isValid = true;

        // Validate platform
        if (!formData.platform || formData.platform.trim() === '') {
            errors.platform = 'Platform is required';
            isValid = false;
        }

        // Validate URL
        if (!formData.url || formData.url.trim() === '') {
            errors.url = 'URL/Contact is required';
            isValid = false;
        } else {
            const urlValidation = this.validateURL(formData.url, formData.platform);
            if (!urlValidation.isValid) {
                errors.url = urlValidation.message;
                isValid = false;
            }
        }

        return { isValid, errors };
    }

    /**
     * Validate URL based on platform
     * @param {string} url URL to validate
     * @param {string} platform Platform type
     * @returns {Object} Validation result
     */
    static validateURL(url, platform) {
        const trimmedUrl = url.trim();

        switch (platform) {
            case 'Email':
                return {
                    isValid: CONFIG.VALIDATION_PATTERNS.email.test(trimmedUrl),
                    message: 'Please enter a valid email address'
                };
            case 'Phone':
                return {
                    isValid: CONFIG.VALIDATION_PATTERNS.phone.test(trimmedUrl),
                    message: 'Please enter a valid phone number'
                };
            default:
                return {
                    isValid: trimmedUrl.length > 0,
                    message: 'Please enter a valid URL'
                };
        }
    }

    /**
     * Display validation errors in the form
     * @param {Object} errors Error object
     */
    static displayErrors(errors) {
        // Clear all existing errors
        document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

        // Display new errors
        Object.keys(errors).forEach(field => {
            const errorElement = document.getElementById(`${field}Error`);
            if (errorElement) {
                errorElement.textContent = errors[field];
            }
        });
    }
}

// API Service Class
class SocialAPIService {
    /**
     * Get all social media links for a friend
     * @param {string} friendId Friend ID
     * @returns {Promise<Array>} Array of social media links
     */
    static async getSocialsForFriend(friendId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${friendId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching socials:', error);
            throw new Error('Failed to load social media links');
        }
    }

    /**
     * Create a new social media link
     * @param {string} friendId Friend ID
     * @param {Object} socialData Social media data
     * @returns {Promise<Object>} Created social media link
     */
    static async createSocial(friendId, socialData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${friendId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(socialData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error creating social:', error);
            throw new Error('Failed to create social media link');
        }
    }

    /**
     * Update an existing social media link
     * @param {string} socialId Social media link ID
     * @param {Object} socialData Updated social media data
     * @returns {Promise<Object>} Updated social media link
     */
    static async updateSocial(socialId, socialData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/update/${socialId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(socialData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error updating social:', error);
            throw new Error('Failed to update social media link');
        }
    }

    /**
     * Delete a social media link
     * @param {string} socialId Social media link ID
     * @returns {Promise<void>}
     */
    static async deleteSocial(socialId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/delete/${socialId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting social:', error);
            throw new Error('Failed to delete social media link');
        }
    }
}

// UI Management Classes
class SocialListRenderer {
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
        
        return `
            <div class="social-item" data-platform="${social.platform}">
                <div class="social-info">
                    <div class="social-icon">${icon}</div>
                    <div class="social-details">
                        <div class="social-platform">${social.platform}</div>
                        ${social.displayName ? `<div class="social-display-name">${social.displayName}</div>` : ''}
                        <a href="${social.url}" target="_blank" class="social-url">${social.url}</a>
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

class ModalManager {
    /**
     * Show edit modal with social data
     * @param {Object} social Social media data
     */
    static showEditModal(social) {
        document.getElementById('editSocialId').value = social.id;
        document.getElementById('editPlatform').value = social.platform;
        document.getElementById('editUrl').value = social.url;
        document.getElementById('editDisplayName').value = social.displayName || '';
        
        document.getElementById('editModal').style.display = 'flex';
    }

    /**
     * Hide edit modal
     */
    static hideEditModal() {
        document.getElementById('editModal').style.display = 'none';
        document.getElementById('editSocialForm').reset();
    }

    /**
     * Show delete confirmation modal
     * @param {string} socialId Social media link ID
     */
    static showDeleteModal(socialId) {
        document.getElementById('deleteModal').style.display = 'flex';
        document.getElementById('confirmDelete').onclick = () => {
            socialManager.confirmDelete(socialId);
        };
    }

    /**
     * Hide delete confirmation modal
     */
    static hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
    }
}

// Main Application Class
class SocialMediaManager {
    constructor(friendId) {
        this.friendId = friendId;
        this.socials = [];
        this.currentEditId = null;
        this.pendingDeleteId = null;
        this.isLoading = false;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        this.setupEventListeners();
        this.updateFriendDisplay();
        await this.loadSocials();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Main form submission
        document.getElementById('socialForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmission();
        });

        // Edit form submission
        document.getElementById('editSocialForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEditFormSubmission();
        });

        // Modal controls
        document.getElementById('closeEditModal').addEventListener('click', () => {
            ModalManager.hideEditModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            ModalManager.hideEditModal();
        });

        document.getElementById('closeDeleteModal').addEventListener('click', () => {
            ModalManager.hideDeleteModal();
        });

        document.getElementById('cancelDelete').addEventListener('click', () => {
            ModalManager.hideDeleteModal();
        });

        // Back button
        document.getElementById('backToProfile').addEventListener('click', () => {
            URLHelper.navigateToProfile(this.friendId);
        });

        // Cancel form
        document.getElementById('cancelForm').addEventListener('click', () => {
            URLHelper.navigateToProfile(this.friendId);
        });

        // URL input help text update based on platform
        document.getElementById('platform').addEventListener('change', (e) => {
            this.updateURLHelpText(e.target.value);
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                ModalManager.hideEditModal();
                ModalManager.hideDeleteModal();
            }
        });
    }

    /**
     * Update URL help text based on selected platform
     * @param {string} platform Selected platform
     */
    updateURLHelpText(platform) {
        const helpElement = document.getElementById('urlHelp');
        const urlInput = document.getElementById('url');
        
        switch (platform) {
            case 'Email':
                helpElement.textContent = 'Enter email address (e.g., friend@example.com)';
                urlInput.placeholder = 'friend@example.com';
                break;
            case 'Phone':
                helpElement.textContent = 'Enter phone number (e.g., +1 234 567 8900)';
                urlInput.placeholder = '+1 234 567 8900';
                break;
            case 'Instagram':
                helpElement.textContent = 'Enter Instagram URL or username';
                urlInput.placeholder = 'https://instagram.com/username or @username';
                break;
            case 'Twitter':
                helpElement.textContent = 'Enter Twitter URL or handle';
                urlInput.placeholder = 'https://twitter.com/handle or @handle';
                break;
            default:
                helpElement.textContent = 'Enter the full URL, phone number, or email address';
                urlInput.placeholder = 'Enter URL, phone number, or email';
        }
    }

    /**
     * Update friend display information
     */
    updateFriendDisplay() {
        // You can enhance this to fetch friend info if needed
        document.getElementById('friendNameDisplay').textContent = `Managing social media for friend #${this.friendId}`;
    }

    /**
     * Load social media links from the server
     */
    async loadSocials() {
        try {
            this.setLoadingState(true);
            this.socials = await SocialAPIService.getSocialsForFriend(this.friendId);
            SocialListRenderer.renderSocialList(this.socials);
        } catch (error) {
            MessageManager.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Handle main form submission
     */
    async handleFormSubmission() {
        if (this.isLoading) return;

        const formData = this.getFormData('socialForm');
        const validation = FormValidator.validateSocialForm(formData);

        if (!validation.isValid) {
            FormValidator.displayErrors(validation.errors);
            return;
        }

        try {
            this.setSubmissionState(true);
            FormValidator.displayErrors({}); // Clear errors

            const formattedData = {
                ...formData,
                url: URLHelper.formatURL(formData.url, formData.platform)
            };

            await SocialAPIService.createSocial(this.friendId, formattedData);
            MessageManager.showSuccess('Social media link added successfully!');
            
            document.getElementById('socialForm').reset();
            await this.loadSocials();
        } catch (error) {
            MessageManager.showError(error.message);
        } finally {
            this.setSubmissionState(false);
        }
    }

    /**
     * Handle edit form submission
     */
    async handleEditFormSubmission() {
        const socialId = document.getElementById('editSocialId').value;
        const formData = this.getFormData('editSocialForm');
        const validation = FormValidator.validateSocialForm(formData);

        if (!validation.isValid) {
            MessageManager.showError('Please check your input and try again');
            return;
        }

        try {
            const formattedData = {
                ...formData,
                url: URLHelper.formatURL(formData.url, formData.platform)
            };

            await SocialAPIService.updateSocial(socialId, formattedData);
            MessageManager.showSuccess('Social media link updated successfully!');
            
            ModalManager.hideEditModal();
            await this.loadSocials();
        } catch (error) {
            MessageManager.showError(error.message);
        }
    }

    /**
     * Get form data from a form element
     * @param {string} formId Form element ID
     * @returns {Object} Form data object
     */
    getFormData(formId) {
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        
        return {
            platform: formData.get('platform'),
            url: formData.get('url'),
            displayName: formData.get('displayName')
        };
    }

    /**
     * Edit a social media link
     * @param {string} socialId Social media link ID
     */
    editSocial(socialId) {
        const social = this.socials.find(s => s.id === socialId);
        if (social) {
            ModalManager.showEditModal(social);
        }
    }

    /**
     * Delete a social media link
     * @param {string} socialId Social media link ID
     */
    deleteSocial(socialId) {
        ModalManager.showDeleteModal(socialId);
    }

    /**
     * Confirm deletion of a social media link
     * @param {string} socialId Social media link ID
     */
    async confirmDelete(socialId) {
        try {
            await SocialAPIService.deleteSocial(socialId);
            MessageManager.showSuccess('Social media link deleted successfully!');
            
            ModalManager.hideDeleteModal();
            await this.loadSocials();
        } catch (error) {
            MessageManager.showError(error.message);
        }
    }

    /**
     * Set loading state
     * @param {boolean} isLoading Loading state
     */
    setLoadingState(isLoading) {
        this.isLoading = isLoading;
        const loadingElement = document.querySelector('.social-list-loading');
        if (loadingElement) {
            loadingElement.style.display = isLoading ? 'flex' : 'none';
        }
    }

    /**
     * Set form submission state
     * @param {boolean} isSubmitting Submission state
     */
    setSubmissionState(isSubmitting) {
        const submitButton = document.getElementById('submitForm');
        const buttonText = submitButton.querySelector('.btn-text');
        const buttonLoading = submitButton.querySelector('.btn-loading');
        
        submitButton.disabled = isSubmitting;
        buttonText.style.display = isSubmitting ? 'none' : 'inline';
        buttonLoading.style.display = isSubmitting ? 'inline' : 'none';
    }
}

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
