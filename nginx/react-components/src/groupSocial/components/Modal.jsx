/**
 * Reusable Modal Component
 * For displaying forms, dialogs, and overlays
 */

import React, { useEffect } from 'react';
import Button from './Button.jsx';

const Modal = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    size = 'md',
    className = '' 
}) => {
    // Handle escape key to close modal
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl'
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" 
            onClick={handleBackdropClick}
        >
            <div className={`bg-surface rounded-card shadow-card-hover w-full ${sizeClasses[size]} max-h-[90vh] overflow-auto border border-border-light ${className}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
                    <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={onClose} 
                        className="text-text-secondary hover:text-text-primary"
                        aria-label="Close modal"
                    >
                        ✕
                    </Button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
