/**
 * SearchBox Molecule Component
 * Combines Input atom with search functionality and clear button
 */

import React from 'react';
import { Input, Button } from '../atoms';

const SearchBox = ({ 
    value = '',
    onChange,
    onClear,
    placeholder = 'Search...',
    disabled = false,
    className = '',
    showClearButton = true,
    ...props 
}) => {
    const handleClear = () => {
        if (onClear) {
            onClear();
        } else if (onChange) {
            onChange({ target: { value: '' } });
        }
    };
    
    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔍</span>
                </div>
                
                <Input
                    type="text"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="pl-10 pr-10"
                    {...props}
                />
                
                {showClearButton && value && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="p-1 h-6 w-6 min-w-0 text-gray-400 hover:text-gray-600"
                            aria-label="Clear search"
                        >
                            ×
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchBox;