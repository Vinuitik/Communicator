import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../utils/constants';

// Ported from nginx/static/navigation/navigation.css. Items not yet moved to
// the SPA point at the legacy MPA's absolute path (outside /app/) so they
// still show real data; flip each to an internal <Link> as its page is
// ported. See react/src/PROTO.md.
//
// "Home" intentionally does NOT match the legacy nav, where that label points
// at calendar.html instead of "/" — that repoint predates this file (made
// when HomePage was first ported, before Calendar existed) and is kept as
// the SPA's own convention (root = Home) rather than reproducing the legacy
// mislabeling. Calendar gets its own nav item instead.
const NavigationBar: React.FC = () => {
    return (
        <nav className="bg-brand px-8 py-4 flex flex-col md:flex-row md:justify-between md:items-center shadow-sm">
            <div className="text-white text-2xl font-medium">Friends Tracker</div>
            <ul className="flex flex-col md:flex-row gap-2 md:gap-4 list-none mt-4 md:mt-0">
                <li><Link to={ROUTES.HOME} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Home</Link></li>
                <li><Link to={ROUTES.CALENDAR} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Calendar</Link></li>
                <li><Link to={ROUTES.ADD_FRIEND} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Add Friend</Link></li>
                <li><Link to={ROUTES.GROUPS} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Groups</Link></li>
                <li><Link to={ROUTES.CREATE_GROUP} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Create Group</Link></li>
                <li><a href="/stats" className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Stats</a></li>
                <li><Link to={ROUTES.SETTINGS} className="block text-white no-underline px-3 py-2 rounded hover:bg-white/10 transition-colors">Settings</Link></li>
            </ul>
        </nav>
    );
};

export default NavigationBar;
