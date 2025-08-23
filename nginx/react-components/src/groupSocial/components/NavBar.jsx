import React from 'react';

const NavBar = ({ title = 'Friends Tracker' }) => {
    return (
        <nav className="navbar">
            <div className="navbar-logo">{title}</div>
            <ul className="navbar-links">
                <li><a href="/calendarView/calendar.html">Home</a></li>
                <li><a href="/addFriendForm/addForm.html">Add Friend</a></li>
                <li><a href="/">All Friends</a></li>
                <li><a href="/">This Week</a></li>
                <li><a href="/api/groups/">Relationship Groups</a></li>
                <li><a href="/stats">Stats</a></li>
            </ul>
        </nav>
    );
};

export default NavBar;
