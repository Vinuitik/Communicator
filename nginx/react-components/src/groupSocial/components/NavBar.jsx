import React from 'react';

const NavBar = ({ title = 'Friends Tracker' }) => {
    return (
        <nav className="fixed top-0 left-0 right-0 h-16 bg-blue-600 text-white z-50 shadow-lg">
            <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
                <div className="font-semibold text-lg">{title}</div>
                <ul className="flex items-center gap-6 text-sm">
                    <li><a className="hover:text-blue-200 transition-colors" href="/calendarView/calendar.html">Home</a></li>
                    <li><a className="hover:text-blue-200 transition-colors" href="/addFriendForm/addForm.html">Add Friend</a></li>
                    <li><a className="hover:text-blue-200 transition-colors" href="/">All Friends</a></li>
                    <li><a className="hover:text-blue-200 transition-colors" href="/">This Week</a></li>
                    <li><a className="hover:text-blue-200 transition-colors" href="/api/groups/">Relationship Groups</a></li>
                    <li><a className="hover:text-blue-200 transition-colors" href="/stats">Stats</a></li>
                </ul>
            </div>
        </nav>
    );
};

export default NavBar;
