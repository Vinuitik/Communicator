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
  // MeetingController (meeting module) is mapped at "/meetings", not
  // "/api/meetings" — nginx strips the /api/meetings/ prefix down to
  // /meetings/ on the way to the monolith, same pattern as /api/chrono/.
  MEETINGS: '/api/meetings',
} as const;
