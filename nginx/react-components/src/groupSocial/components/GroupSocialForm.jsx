/**
 * Social Media Form Component for adding/editing group social links
 */

import React, { useState, useEffect } from 'react';
import { PLATFORM_OPTIONS, PLATFORM_ICONS } from '../utils/config.js';
import { FormValidator } from '../utils/FormValidator.js';

const GroupSocialForm = ({ onSubmit, onCancel, initialData = null, isLoading = false }) => {
    const [formData, setFormData] = useState({
        platform: '',
        url: ''
    });
    const [errors, setErrors] = useState({});

    // Populate form with initial data for editing
    useEffect(() => {
        if (initialData) {
            setFormData({
                platform: initialData.platform || '',
                url: initialData.url || ''
            });
        }
    }, [initialData]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        
        // Clean and validate form data
        const cleanedData = FormValidator.cleanFormData(formData);
        const validation = FormValidator.validateSocialForm(cleanedData);

        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        // Clear errors and submit
        setErrors({});
        onSubmit(cleanedData);
    };

    const getPlaceholderText = (platform) => {
        switch (platform) {
            case 'Email':
                return 'Enter email address';
            case 'Phone':
                return 'Enter phone number';
            case 'Website':
                return 'https://example.com';
            default:
                return `https://${platform.toLowerCase()}.com/username`;
        }
    };

    const getInputType = (platform) => {
        switch (platform) {
            case 'Email':
                return 'email';
            case 'Phone':
                return 'tel';
            default:
                return 'url';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="social-form">
            <div className="form-group">
                <label htmlFor="platform" className="form-label">Platform <span style={{color: 'var(--danger-color)'}}>*</span></label>
                <select
                    id="platform"
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className={`form-select ${errors.platform ? 'error' : ''}`}
                    required
                >
                    <option value="">Select Platform</option>
                    {PLATFORM_OPTIONS.map(platform => (
                        <option key={platform} value={platform}>{PLATFORM_ICONS[platform]} {platform}</option>
                    ))}
                </select>
                {errors.platform && <div className="form-error">{errors.platform}</div>}
            </div>

            <div className="form-group">
                <label htmlFor="url" className="form-label">
                    {formData.platform === 'Email' ? 'Email Address' : formData.platform === 'Phone' ? 'Phone Number' : 'URL'} 
                    <span style={{color: 'var(--danger-color)'}}>*</span>
                </label>
                <input
                    id="url"
                    name="url"
                    type={getInputType(formData.platform)}
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder={formData.platform ? getPlaceholderText(formData.platform) : 'Select a platform first'}
                    className={`form-input ${errors.url ? 'error' : ''}`}
                    required
                />
                {errors.url && <div className="form-error">{errors.url}</div>}
            </div>

            <div className="form-actions">
                <button type="button" onClick={onCancel} className="btn-secondary" disabled={isLoading}>
                    Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? (initialData ? 'Updating...' : 'Adding...') : (initialData ? 'Update Social Link' : 'Add Social Link')}
                </button>
            </div>
        </form>
    );
};

export default GroupSocialForm;
