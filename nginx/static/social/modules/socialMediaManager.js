/**
 * Main Social Media Manager class
 */

import { URLHelper } from './urlHelper.js';
import { MessageManager } from './messageManager.js';
import { FormValidator } from './formValidator.js';
import { SocialAPIService } from './socialApiService.js';
import { SocialListRenderer } from './socialListRenderer.js';
import { ModalManager } from './modalManager.js';

export class SocialMediaManager {
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
                URL: URLHelper.formatURL(formData.url, formData.platform)
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
                URL: URLHelper.formatURL(formData.url, formData.platform)
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
        ModalManager.showDeleteModal(socialId, (id) => this.confirmDelete(id));
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
