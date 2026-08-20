// Central source of truth for backend API base paths — the React-side twin
// of nginx/static/shared/config.js. Every path is same-origin: nginx
// reverse-proxies each prefix to the actual service (nginx/nginx.conf), so
// these must stay relative, not host-qualified. Change a prefix here only.
export const API_BASE = {
  FRIEND: '/api/friend',
  GROUPS: '/api/groups',
  CONNECTIONS: '/api/connections',
  FILES: '/api/fileRepository',
  AI: '/api/ai',
  BACKUP: '/backup',
  // meeting module's MeetingController is mounted bare at /meetings (no /api
  // prefix — it doesn't go through PathPrefixConfig like friend/groups/connections
  // do). NOTE: as of this writing nginx/nginx.conf has no location block proxying
  // /meetings/ to the monolith yet — that route still needs to be added before this
  // is reachable through the real gateway; flagged for whoever lands the backend.
  MEETINGS: '/meetings',
} as const;
