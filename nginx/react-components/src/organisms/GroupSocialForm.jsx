/**
 * GroupSocialForm Organism Component
 * Complete form for adding/editing group social links
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../atoms';
import { FormField } from '../molecules';
import { PLATFORM_OPTIONS, PLATFORM_ICONS } from '../groupSocial/utils/config.js';
import { FormValidator } from '../groupSocial/utils/FormValidator.js';

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

        // Call parent submit handler
        onSubmit(cleanedData);
    };

    const handleReset = () => {
        setFormData({
            platform: '',
            url: ''
        });
        setErrors({});
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Platform Selection */}
            <div className="w-full">
                <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
                    Platform <span className="text-red-500">*</span>
                </label>
                <select
                    id="platform"
                    name="platform"
                    value={formData.platform}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        errors.platform 
                            ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' 
                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white'
                    }`}
                    required
                >
                    <option value="">Select a platform</option>
                    {PLATFORM_OPTIONS.map(platform => (
                        <option key={platform} value={platform}>
                            {PLATFORM_ICONS[platform]} {platform}
                        </option>
                    ))}
                </select>
                {errors.platform && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                        <span className="mr-1">⚠️</span>
                        {errors.platform}
                    </p>
                )}
            </div>

            {/* URL/Contact Input */}
            <FormField
                label="URL or Contact"
                name="url"
                type="text"
                value={formData.url}
                onChange={handleInputChange}
                placeholder={formData.platform === 'Email' ? 'Enter email address' : 
                           formData.platform === 'Phone' ? 'Enter phone number' : 
                           'Enter URL'}
                required
                error={errors.url}
                helpText={formData.platform === 'Email' ? 'Enter a valid email address' :
                         formData.platform === 'Phone' ? 'Enter phone number with country code' :
                         'Enter the complete URL including https://'}
            />

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={isLoading}
                >
                    Reset
                </Button>
                
                {onCancel && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                )}
                
                <Button
                    type="submit"
                    variant="primary"
                    loading={isLoading}
                    disabled={isLoading}
                >
                    {initialData ? 'Update' : 'Add'} Social Link
                </Button>
            </div>
        </form>
    );
};

export default GroupSocialForm;
