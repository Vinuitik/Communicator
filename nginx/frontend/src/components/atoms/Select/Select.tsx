import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  id?: string;
  name?: string;
}

/**
 * Select Atom - Dropdown select with options and icons
 * Based on your existing CSS class: form-select
 * Supports the platform options with emojis from your social form
 */
export function Select({
  options,
  value,
  defaultValue,
  placeholder,
  error = false,
  disabled = false,
  required = false,
  className = '',
  onChange,
  onBlur,
  id,
  name,
  ...props
}: SelectProps) {
  const baseClasses = 'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 bg-white';
  
  const stateClasses = error
    ? 'border-red-500 text-red-900 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500';
    
  const disabledClasses = disabled
    ? 'bg-gray-100 cursor-not-allowed opacity-60'
    : 'hover:border-gray-400 cursor-pointer';

  const classes = `
    ${baseClasses}
    ${stateClasses}
    ${disabledClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <select
      id={id}
      name={name}
      className={classes}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.icon ? `${option.icon} ${option.label}` : option.label}
        </option>
      ))}
    </select>
  );
}
