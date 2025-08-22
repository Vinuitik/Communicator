/**
 * Reusable Button Component
 * Supports multiple variants, sizes, and states
 */

import React from 'react';

const Button = ({ 
    variant = 'primary', 
    size = 'md', 
    children, 
    disabled = false,
    loading = false,
    className = '',
    ...props 
}) => {
    const baseClasses = 'font-medium rounded-button transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center';
    
    const variants = {
        primary: 'bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-300 shadow-button hover:shadow-md',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300 border border-gray-300 shadow-button hover:shadow-md',
        success: 'bg-success-500 hover:bg-success-600 text-white focus:ring-success-300 shadow-button hover:shadow-md',
        danger: 'bg-error-500 hover:bg-error-600 text-white focus:ring-error-300 shadow-button hover:shadow-md',
        warning: 'bg-warning-500 hover:bg-warning-600 text-white focus:ring-warning-300 shadow-button hover:shadow-md',
        ghost: 'hover:bg-gray-100 text-gray-700 focus:ring-gray-300'
    };
    
    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };
    
    return (
        <button 
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            )}
            {children}
        </button>
    );
};

export default Button;
