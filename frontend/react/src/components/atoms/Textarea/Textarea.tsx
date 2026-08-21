import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, ...props }) => {
  return (
    <div className="flex flex-col">
      {label && <label className="mb-1.5 text-xs font-semibold text-text-muted">{label}</label>}
      <textarea
        className="w-full bg-input border border-white/10 rounded-input px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60"
        {...props}
      />
    </div>
  );
};

export default Textarea;
