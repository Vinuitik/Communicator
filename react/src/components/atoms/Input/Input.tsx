import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, ...props }) => {
  return (
    <div className="flex flex-col">
      {label && <label className="mb-1 text-sm font-medium">{label}</label>}
      <input
        className="w-full border border-gray-300 rounded p-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand"
        {...props}
      />
    </div>
  );
};

export default Input;