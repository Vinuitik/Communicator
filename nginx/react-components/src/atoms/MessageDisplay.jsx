/**
 * MessageDisplay Atom Component
 * Basic message/notification display with different types
 */

import React from 'react';

const MessageDisplay = ({ 
    message, 
    type = 'info', 
    onClose, 
    dismissible = true,
    className = '' 
}) => {
    if (!message) return null;

    const baseClasses = 'flex items-center justify-between p-4 rounded-lg border transition-all duration-200';
    
    const typeClasses = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };
    
    const getIcon = (messageType) => {
        switch (messageType) {
            case 'success':
                return '✅';
            case 'error':
                return '❌';
            case 'warning':
                return '⚠️';
            default:
                return 'ℹ️';
        }
    };
    
    const messageType = typeof message === 'object' ? message.type : type;
    const messageText = typeof message === 'object' ? message.text : message;
    
    const classes = `${baseClasses} ${typeClasses[messageType]} ${className}`;
    
    return (
        <div className={classes} role="status" aria-live="polite">
            <div className="flex items-center">
                <span className="mr-2 text-lg">{getIcon(messageType)}</span>
                <span className="font-medium">{messageText}</span>
            </div>
            {dismissible && onClose && (
                <button
                    onClick={onClose}
                    className="ml-4 text-current hover:opacity-70 focus:outline-none focus:opacity-70 transition-opacity"
                    aria-label="Close message"
                >
                    <span className="text-lg">×</span>
                </button>
            )}
        </div>
    );
};

export default MessageDisplay;