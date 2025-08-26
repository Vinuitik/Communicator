/**
 * Card Atom Component
 * Basic content container with variants and padding options
 */

import React from 'react';

const Card = ({ 
    children, 
    variant = 'default',
    padding = 'md',
    hover = false,
    className = '',
    ...props 
}) => {
    const baseClasses = 'rounded-lg transition-all duration-200';
    
    const variantClasses = {
        default: 'bg-white border border-gray-200 shadow-sm',
        elevated: 'bg-white shadow-md border border-gray-100',
        outlined: 'bg-white border-2 border-gray-300',
        flat: 'bg-gray-50 border border-gray-200',
        primary: 'bg-blue-50 border border-blue-200',
        success: 'bg-green-50 border border-green-200',
        warning: 'bg-yellow-50 border border-yellow-200',
        danger: 'bg-red-50 border border-red-200'
    };
    
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8'
    };
    
    const hoverClasses = hover ? 'hover:shadow-lg hover:scale-105 cursor-pointer' : '';
    
    const classes = `${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${className}`;
    
    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
};

export default Card;