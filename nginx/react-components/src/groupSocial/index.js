/**
 * Main Entry Point for Group Social Media Management React App
 * Updated to use the new Atomic Design structure
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { GroupSocialPage } from '../pages';
import './styles/tailwind.css';
import './styles/groupSocial.css';

// Initialize React app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('group-social-root');
    
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<GroupSocialPage />);
    } else {
        console.error('Root element #group-social-root not found');
    }
});
