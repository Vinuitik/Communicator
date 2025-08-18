/**
 * Form Validation utilities for Group Social Media Management
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
     * @param {string} platform Platform name
     * @returns {Object} Validation result
     */
    static validateURL(url, platform) {
        const trimmedUrl = url.trim();
        
        // Check for email pattern
        if (CONFIG.VALIDATION_PATTERNS.email.test(trimmedUrl)) {
            return { isValid: true };
        }
        
        // Check for phone pattern
        if (CONFIG.VALIDATION_PATTERNS.phone.test(trimmedUrl)) {
            return { isValid: true };
        }
        
        // For URL platforms, validate URL format
        if (platform && !['Email', 'Phone'].includes(platform)) {
            if (!CONFIG.VALIDATION_PATTERNS.url.test(trimmedUrl)) {
                return { 
                    isValid: false, 
                    message: 'Please enter a valid URL starting with http:// or https://' 
                };
            }
        }
        
        return { isValid: true };
    }

    /**
     * Clean and format input data
     * @param {Object} formData Raw form data
     * @returns {Object} Cleaned form data
     */
    static cleanFormData(formData) {
        return {
            platform: formData.platform?.trim() || '',
            url: formData.url?.trim() || ''
        };
    }
}
