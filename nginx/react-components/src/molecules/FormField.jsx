/**
 * FormField Molecule Component
 * Combines Input atom with label, validation, and help text
 */

import React from 'react';
import { Input } from '../atoms';

const FormField = ({ 
    label,
    id,
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    disabled = false,
    error = null,
    helpText = null,
    className = '',
    labelClassName = '',
    ...inputProps 
}) => {
    const fieldId = id || name;
    
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label 
                    htmlFor={fieldId}
                    className={`block text-sm font-medium text-gray-700 mb-1 ${labelClassName}`}
                >
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <Input
                id={fieldId}
                name={name}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                error={error}
                {...inputProps}
            />
            
            {helpText && !error && (
                <p className="mt-1 text-sm text-gray-500">
                    {helpText}
                </p>
            )}
        </div>
    );
};

export default FormField;