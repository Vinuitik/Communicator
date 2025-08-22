/**
 * Reusable Input Component
 * Supports text, email, url, tel, select with validation states
 */

import React from 'react';

const Input = ({ 
    label,
    type = 'text',
    error,
    required = false,
    placeholder,
    options = [], // For select type
    className = '',
    ...props 
}) => {
    const baseInputClasses = 'w-full px-3 py-2 border rounded-button text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:bg-gray-100 disabled:cursor-not-allowed';
    
    const inputStateClasses = error 
        ? 'border-error-500 focus:border-error-500 focus:ring-error-300' 
        : 'border-border-light focus:border-primary-500 focus:ring-primary-300';

    const inputClasses = `${baseInputClasses} ${inputStateClasses} ${className}`;

    const renderInput = () => {
        if (type === 'select') {
            return (
                <select className={inputClasses} {...props}>
                    <option value="">{placeholder || 'Select an option'}</option>
                    {options.map((option, index) => (
                        <option key={index} value={option.value || option}>
                            {option.label || option}
                        </option>
                    ))}
                </select>
            );
        }

        return (
            <input
                type={type}
                className={inputClasses}
                placeholder={placeholder}
                {...props}
            />
        );
    };

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-text-primary">
                    {label}
                    {required && <span className="text-error-500 ml-1">*</span>}
                </label>
            )}
            {renderInput()}
            {error && (
                <p className="text-xs text-error-500 mt-1">{error}</p>
            )}
        </div>
    );
};

export default Input;
