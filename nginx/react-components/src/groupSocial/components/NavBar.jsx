import React from 'react';

const NavBar = ({ title = 'Friends Tracker' }) => {
    return (
        <nav className="fixed top-0 left-0 right-0 h-14 bg-brand text-white z-50 shadow-sm">
            <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
                <div className="font-semibold">{title}</div>
                <ul className="flex items-center gap-6 text-sm">
                    <li><a className="hover:underline" href="/calendarView/calendar.html">Home</a></li>
                    <li><a className="hover:underline" href="/addFriendForm/addForm.html">Add Friend</a></li>
                    <li><a className="hover:underline" href="/">All Friends</a></li>
                    <li><a className="hover:underline" href="/">This Week</a></li>
                    <li><a className="hover:underline" href="/api/groups/">Relationship Groups</a></li>
                    <li><a className="hover:underline" href="/stats">Stats</a></li>
                </ul>
            </div>
        </nav>
    );
};

export default NavBar;
