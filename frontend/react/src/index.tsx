import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './pwa/installPrompt';
import { registerServiceWorker } from './pwa/registerSW';
import { wireAutoFlush } from './pwa/outbox';

registerServiceWorker();
wireAutoFlush();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);