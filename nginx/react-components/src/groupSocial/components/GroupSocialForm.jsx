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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="platform" className="block text-sm font-medium text-gray-700">Platform <span className="text-red-500">*</span></label>
                <select
                    id="platform"
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-2 focus:ring-brand focus:border-brand ${errors.platform ? 'border-red-300' : ''}`}
                    required
                >
                    <option value="">Select Platform</option>
                    {PLATFORM_OPTIONS.map(platform => (
                        <option key={platform} value={platform}>{PLATFORM_ICONS[platform]} {platform}</option>
                    ))}
                </select>
                {errors.platform && <p className="text-xs text-red-600 mt-1">{errors.platform}</p>}
            </div>

            <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700">{formData.platform === 'Email' ? 'Email Address' : formData.platform === 'Phone' ? 'Phone Number' : 'URL'} <span className="text-red-500">*</span></label>
                <input
                    id="url"
                    name="url"
                    type={getInputType(formData.platform)}
                    value={formData.url}
                    onChange={handleInputChange}
                    placeholder={formData.platform ? getPlaceholderText(formData.platform) : 'Select a platform first'}
                    className={`mt-1 block w-full rounded-md border-gray-200 shadow-sm focus:ring-2 focus:ring-brand focus:border-brand ${errors.url ? 'border-red-300' : ''}`}
                    required
                />
                {errors.url && <p className="text-xs text-red-600 mt-1">{errors.url}</p>}
            </div>

            <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-white border border-gray-200 text-sm text-gray-700" disabled={isLoading}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-brand text-white text-sm" disabled={isLoading}>
                    {isLoading ? (initialData ? 'Updating...' : 'Adding...') : (initialData ? 'Update Social Link' : 'Add Social Link')}
                </button>
            </div>
        </form>
    );
};

export default GroupSocialForm;
