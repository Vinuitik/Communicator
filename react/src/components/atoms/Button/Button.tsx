import React from 'react';

// Primary-button visual weight from the redesign handoff (accent gradient +
// glow shadow) — reused for react-router <Link> "Cancel"/secondary-styled
// buttons too, since a link can't be a <button> element.
export const buttonClasses =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white ' +
    'bg-accent-gradient rounded-input text-center cursor-pointer transition-all duration-150 ' +
    'shadow-button hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed';

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className, ...props }) => {
    return (
        <button className={`${buttonClasses}${className ? ` ${className}` : ''}`} {...props}>
            {children}
        </button>
    );
};

export default Button;
