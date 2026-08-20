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
  // No /api prefix: the meeting module has no PathPrefixConfig namespace
  // (see PathPrefixConfig.java), so MeetingController's own
  // @RequestMapping("/meetings") is the real path. nginx/nginx.conf routes
  // /meetings/ straight to the monolith, same as every other prefix here.
  MEETINGS: '/meetings',
} as const;
