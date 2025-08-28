import React from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'url' | 'tel' | 'password';
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
}

/**
 * Input Atom - Basic input field with validation states
 * Based on your existing CSS class: form-input
 */
export function Input({
  type = 'text',
  placeholder,
  value,
  defaultValue,
  error = false,
  disabled = false,
  required = false,
  className = '',
  onChange,
  onBlur,
  onFocus,
  id,
  name,
  ...props
}: InputProps) {
  const baseClasses = 'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  const stateClasses = error
    ? 'border-red-500 text-red-900 placeholder-red-400 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500';
    
  const disabledClasses = disabled
    ? 'bg-gray-100 cursor-not-allowed opacity-60'
    : 'bg-white hover:border-gray-400';

  const classes = `
    ${baseClasses}
    ${stateClasses}
    ${disabledClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <input
      type={type}
      id={id}
      name={name}
      className={classes}
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      disabled={disabled}
      required={required}
      {...props}
    />
  );
}
