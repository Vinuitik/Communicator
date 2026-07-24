import React from 'react';

// Matches the legacy `.button` class (nginx/static/*/​*.css) — same visual
// weight is reused for the react-router <Link> "Cancel" buttons, since a
// link can't be a <button> element.
export const buttonClasses =
    'inline-block px-5 py-2.5 text-base text-white bg-brand rounded text-center ' +
    'cursor-pointer transition-colors duration-300 hover:bg-brand-dark ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className, ...props }) => {
    return (
        <button className={`${buttonClasses}${className ? ` ${className}` : ''}`} {...props}>
            {children}
        </button>
    );
};

export default Button;
