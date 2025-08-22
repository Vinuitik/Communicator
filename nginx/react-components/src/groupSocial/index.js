/**
 * Main Entry Point for Social Media Management React App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import SocialMediaApp from './components/SocialMediaApp.jsx';
import './styles/tailwind.css';

// Initialize React app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('group-social-root');
    
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<SocialMediaApp />);
    } else {
        console.error('Root element #group-social-root not found');
    }
});
