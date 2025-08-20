/**
 * Main Entry Point for Group Social Media Management React App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import GroupSocialApp from './components/GroupSocialApp.jsx';
import './styles/groupSocial.css';

// Initialize React app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('group-social-root');
    
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<GroupSocialApp />);
    } else {
        console.error('Root element #group-social-root not found');
    }
});
