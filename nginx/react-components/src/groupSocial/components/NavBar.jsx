/**
 * Reusable Navigation Bar Component
 * Can be used across different pages and applications
 */

import React from 'react';

const Navigation = ({ title = 'Friends Tracker', links = [] }) => {
    const defaultLinks = [
        { href: '/calendarView/calendar.html', label: 'Home' },
        { href: '/addFriendForm/addForm.html', label: 'Add Friend' },
        { href: '/', label: 'All Friends' },
        { href: '/', label: 'This Week' },
        { href: '/api/groups/', label: 'Relationship Groups' },
        { href: '/stats', label: 'Stats' }
    ];

    const navigationLinks = links.length > 0 ? links : defaultLinks;

    return (
        <nav className="fixed top-0 left-0 right-0 h-16 bg-primary-500 text-white z-50 shadow-card">
            <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
                <div className="font-semibold text-lg">
                    {title}
                </div>
                
                <ul className="flex items-center gap-1">
                    {navigationLinks.map((link, index) => (
                        <li key={index}>
                            <a 
                                href={link.href}
                                className="text-white px-3 py-2 rounded-button text-sm font-medium hover:bg-white/10 transition-colors duration-200"
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

export default Navigation;
