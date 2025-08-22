/**
 * Reusable Social Media Form Component
 * Can be used for adding/editing social media links in any context
 */

import React, { useState, useEffect } from 'react';
import Button from './Button.jsx';
import Input from './Input.jsx';
import { PLATFORM_OPTIONS, PLATFORM_ICONS } from '../utils/config.js';
import { FormValidator } from '../utils/FormValidator.js';

const SocialMediaForm = ({ 
    onSubmit, 
    onCancel, 
    initialData = null, 
    isLoading = false,
    submitLabel = 'Add Social Link',
    cancelLabel = 'Cancel'
}) => {
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

    const platformOptions = PLATFORM_OPTIONS.map(platform => ({
        value: platform,
        label: `${PLATFORM_ICONS[platform]} ${platform}`
    }));

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Platform"
                type="select"
                name="platform"
                value={formData.platform}
                onChange={handleInputChange}
                placeholder="Select Platform"
                options={platformOptions}
                error={errors.platform}
                required
            />

            <Input
                label={formData.platform === 'Email' ? 'Email Address' : formData.platform === 'Phone' ? 'Phone Number' : 'URL'}
                type={getInputType(formData.platform)}
                name="url"
                value={formData.url}
                onChange={handleInputChange}
                placeholder={formData.platform ? getPlaceholderText(formData.platform) : 'Select a platform first'}
                error={errors.url}
                required
            />

            <div className="flex justify-end gap-3 pt-2">
                <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    {cancelLabel}
                </Button>
                <Button 
                    type="submit" 
                    variant="primary"
                    loading={isLoading}
                    disabled={isLoading}
                >
                    {isLoading ? (initialData ? 'Updating...' : 'Adding...') : (initialData ? 'Update Social Link' : submitLabel)}
                </Button>
            </div>
        </form>
    );
};

export default SocialMediaForm;
