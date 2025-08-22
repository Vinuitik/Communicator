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

    const base = 'message';
    const typeClass = (type) => {
        switch (type) {
            case 'success': return 'message-success';
            case 'error': return 'message-error';
            case 'warning': return 'message-warning';
            default: return 'message-info';
        }
    };

    return (
        <div className={`${base} ${typeClass(message.type)}`} role="status">
            <div className="message-icon">{getMessageIcon(message.type)}</div>
            <div className="message-text">{message.text}</div>
            {onClose && (
                <button onClick={onClose} aria-label="Close message" className="message-close">×</button>
            )}
        </div>
    );
};

export default MessageDisplay;
