/**
 * Reusable Card Component
 * Provides consistent styling for content containers
 */

import React from 'react';

const Card = ({ 
    title,
    children,
    className = '',
    hover = false,
    padding = 'normal',
    ...props 
}) => {
    const baseClasses = 'bg-surface rounded-card border border-border-light transition-shadow duration-200';
    
    const hoverClasses = hover ? 'hover:shadow-card-hover cursor-pointer' : 'shadow-card';
    
    const paddingClasses = {
        none: '',
        sm: 'p-4',
        normal: 'p-6',
        lg: 'p-8'
    };

    const cardClasses = `${baseClasses} ${hoverClasses} ${paddingClasses[padding]} ${className}`;

    return (
        <div className={cardClasses} {...props}>
            {title && (
                <h2 className="text-xl font-semibold text-text-primary mb-4">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
};

export default Card;
