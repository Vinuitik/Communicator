/**
 * NavBar Organism Component
 * Complete navigation component with logo and links
 */

import React from 'react';
import { Button } from '../atoms';

const NavBar = ({ title = 'Friends Tracker', className = '' }) => {
    const navLinks = [
        { href: '/calendarView/calendar.html', label: 'Home' },
        { href: '/addFriendForm/addForm.html', label: 'Add Friend' },
        { href: '/', label: 'All Friends' },
        { href: '/', label: 'This Week' },
        { href: '/api/groups/', label: 'Relationship Groups' },
        { href: '/stats', label: 'Stats' }
    ];

    return (
        <nav className={`bg-white shadow-sm border-b border-gray-200 ${className}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo/Brand */}
                    <div className="flex-shrink-0">
                        <h1 className="text-xl font-bold text-gray-900">
                            {title}
                        </h1>
                    </div>
                    
                    {/* Navigation Links */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {navLinks.map((link, index) => (
                                <a
                                    key={index}
                                    href={link.href}
                                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </div>
                    
                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-900"
                            aria-label="Open menu"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Mobile menu (hidden by default) */}
            <div className="md:hidden hidden">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
                    {navLinks.map((link, index) => (
                        <a
                            key={index}
                            href={link.href}
                            className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>
        </nav>
    );
};

export default NavBar;