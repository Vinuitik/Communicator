/**
 * Input Atom Component
 * Basic form input element with validation states
 */

import React from 'react';

const Input = ({ 
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    error = null,
    success = false,
    className = '',
    id,
    name,
    required = false,
    ...props 
}) => {
    const baseClasses = 'w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1';
    
    const stateClasses = () => {
        if (error) {
            return 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50';
        }
        if (success) {
            return 'border-green-500 focus:ring-green-500 focus:border-green-500 bg-green-50';
        }
        return 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 bg-white';
    };
    
    const disabledClasses = disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : '';
    
    const classes = `${baseClasses} ${stateClasses()} ${disabledClasses} ${className}`;
    
    return (
        <div className="w-full">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                className={classes}
                id={id}
                name={name}
                required={required}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                    <span className="mr-1">⚠️</span>
                    {error}
                </p>
            )}
        </div>
    );
};

export default Input;