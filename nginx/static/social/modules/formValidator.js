/**
 * Form Validation utilities for Social Media Management
 */

import { CONFIG } from './config.js';

export class FormValidator {
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
