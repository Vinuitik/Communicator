import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../atoms/Logo';
import { ROUTES } from '../../../utils/constants';
import { onUpdateAvailable, checkForUpdate, reloadApp } from '../../../pwa/registerSW';
import { useToast } from '../../molecules/Toast';

// Redesign IA (see design_handoff_friends_tracker/README.md): 5 destinations
// + one persistent action. "+ Add friend" is reachable from anywhere, not a
// nav destination — Settings is a gear icon-button on the right, not a text
// link. "Create group" is no longer a nav item — it's a button on the
// Groups page itself (Stage 4).
const NAV_ITEMS: { label: string; to: string; match: (pathname: string) => boolean }[] = [
  { label: 'Week', to: ROUTES.HOME, match: (p) => p === ROUTES.HOME },
  {
    label: 'Friends',
    to: ROUTES.FRIENDS,
    match: (p) => (p === ROUTES.FRIENDS || p.startsWith('/friends/')) && !p.startsWith(ROUTES.ADD_FRIEND),
  },
  { label: 'Groups', to: ROUTES.GROUPS, match: (p) => p.startsWith('/groups') },
  { label: 'Connections', to: ROUTES.CONNECTIONS, match: (p) => p.startsWith('/connections') },
  { label: 'Review', to: ROUTES.REVIEW, match: (p) => p.startsWith(ROUTES.REVIEW) },
  { label: 'Insights', to: ROUTES.INSIGHTS, match: (p) => p.startsWith(ROUTES.INSIGHTS) },
];

const SearchIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3" />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16m0 5v-5h5" />
  </svg>
);

const NavigationBar: React.FC = () => {
  const { pathname } = useLocation();
  const { showToast } = useToast();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // A new service-worker version has taken over the page — surface a
  // persistent refresh affordance (not just a toast, which auto-dismisses)
  // since the user may not be looking at the screen when it fires.
  useEffect(() => onUpdateAvailable(() => {
    setUpdateAvailable(true);
    showToast('Update available — tap refresh to get the latest version.');
  }), [showToast]);

  // Nudge the browser to re-check for a new service-worker version whenever
  // the tab regains focus, instead of waiting on its own multi-hour interval.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <nav className="flex-none flex items-center gap-5 px-6 h-[60px] bg-surface border-b border-hairline">
      <Link to={ROUTES.HOME} className="mr-1">
        <Logo />
      </Link>

      <div className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`px-3.5 py-2 rounded-input text-sm transition-colors ${
                active
                  ? 'font-bold bg-accent/16 text-text-emphasis'
                  : 'font-semibold text-text-muted hover:text-text-emphasis'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Visual-only for now — nav search + Friends filter chips are UI-only
            in the design handoff (backlog item 10, no backend search endpoint). */}
        <div className="hidden md:flex items-center gap-2 bg-input border border-white/10 rounded-input px-3 py-2 w-[190px] text-text-faint text-xs">
          <SearchIcon />
          Search friends…
        </div>
        <Link
          to={ROUTES.ADD_FRIEND}
          className="flex items-center gap-1.5 bg-accent-gradient text-white font-bold text-sm px-3.5 py-2 rounded-input shadow-button-sm hover:brightness-110 transition-all"
        >
          <PlusIcon /> Add friend
        </Link>
        {updateAvailable && (
          <button
            type="button"
            title="Update available — click to refresh"
            onClick={reloadApp}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-input border border-accent/40 bg-accent/16 text-accent-light hover:brightness-110 transition-all animate-pulse"
          >
            <RefreshIcon />
          </button>
        )}
        <Link
          to={ROUTES.GET_APP}
          title="Get the app"
          className="w-[38px] h-[38px] flex items-center justify-center rounded-input border border-white/10 bg-input text-text-muted hover:text-text-emphasis transition-colors"
        >
          <DownloadIcon />
        </Link>
        <Link
          to={ROUTES.SETTINGS}
          title="Settings"
          className="w-[38px] h-[38px] flex items-center justify-center rounded-input border border-white/10 bg-input text-text-muted hover:text-text-emphasis transition-colors text-base"
        >
          ⚙
        </Link>
      </div>
    </nav>
  );
};

export default NavigationBar;
