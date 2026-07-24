import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => {
  return (
    <div className="flex flex-col">
      {label && <label className="mb-1 text-sm font-medium">{label}</label>}
      <textarea
        className="w-full border border-gray-300 rounded p-2.5 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand"
        {...props}
      />
    </div>
  );
};

export default Textarea;
