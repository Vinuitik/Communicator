/**
 * Message Display Component for showing success/error/warning messages
 */

import React from 'react';

const MessageDisplay = ({ message, onClose }) => {
    if (!message) return null;

    const getMessageClass = (type) => {
        const baseClass = 'message';
        switch (type) {
            case 'success':
                return `${baseClass} message-success`;
            case 'error':
                return `${baseClass} message-error`;
            case 'warning':
                return `${baseClass} message-warning`;
            default:
                return `${baseClass} message-info`;
        }
    };

    const getMessageIcon = (type) => {
        switch (type) {
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

    const base = 'rounded-md p-3 mb-4 flex items-start gap-3';
    const typeClass = (type) => {
        switch (type) {
            case 'success': return 'bg-green-50 border border-green-200 text-green-800';
            case 'error': return 'bg-red-50 border border-red-200 text-red-800';
            case 'warning': return 'bg-yellow-50 border border-yellow-200 text-yellow-800';
            default: return 'bg-blue-50 border border-blue-200 text-blue-800';
        }
    };

    return (
        <div className={`${base} ${typeClass(message.type)}`} role="status">
            <div className="text-xl flex-shrink-0">{getMessageIcon(message.type)}</div>
            <div className="flex-1 text-sm">{message.text}</div>
            {onClose && (
                <button onClick={onClose} aria-label="Close message" className="text-xl opacity-80 hover:opacity-100">×</button>
            )}
        </div>
    );
};

export default MessageDisplay;
