/**
 * Main Index - Central export point for all components
 * Following Atomic Design Pattern
 */

// Atoms - Basic building blocks
export * from './atoms';

// Molecules - Simple component groups  
export * from './molecules';

// Organisms - Complex component sections
export * from './organisms';

// Pages - Complete page layouts
export * from './pages';

// Main page component for easy access
export { default as GroupSocialPage } from './pages/GroupSocialPage.jsx';