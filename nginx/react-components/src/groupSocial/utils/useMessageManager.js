/**
 * Custom React Hook for Message Management
 */

import { useState, useEffect } from 'react';
import { CONFIG } from '../utils/config.js';

export const useMessageManager = () => {
    const [message, setMessage] = useState(null);

    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
    };

    const showSuccess = (text) => {
        showMessage(text, 'success');
    };

    const showError = (text) => {
        showMessage(text, 'error');
    };

    const showWarning = (text) => {
        showMessage(text, 'warning');
    };

    const clearMessage = () => {
        setMessage(null);
    };

    // Auto-clear messages after configured duration
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                clearMessage();
            }, CONFIG.MESSAGE_DURATION);

            return () => clearTimeout(timer);
        }
    }, [message]);

    return {
        message,
        showMessage,
        showSuccess,
        showError,
        showWarning,
        clearMessage
    };
};
