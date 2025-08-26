/**
 * Modal Organism Component
 * Complete modal with header, body, and actions
 */

import React, { useEffect } from 'react';
import { Button } from '../atoms';

const Modal = ({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    size = 'md',
    showCloseButton = true,
    actions = null,
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
            className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none"
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black opacity-50"></div>
            
            {/* Modal */}
            <div className={`relative w-full mx-4 ${sizeClasses[size]} ${className}`}>
                <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
                    
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-start justify-between p-6 border-b border-gray-200 rounded-t">
                            {title && (
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {title}
                                </h3>
                            )}
                            {showCloseButton && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="p-1 ml-auto text-gray-400 hover:text-gray-600"
                                    aria-label="Close modal"
                                >
                                    <span className="text-xl">×</span>
                                </Button>
                            )}
                        </div>
                    )}
                    
                    {/* Body */}
                    <div className="relative p-6 flex-auto">
                        {children}
                    </div>
                    
                    {/* Actions/Footer */}
                    {actions && (
                        <div className="flex items-center justify-end p-6 border-t border-gray-200 rounded-b space-x-2">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Modal;