// Central source of truth for backend API base paths.
// Every path here is same-origin — nginx reverse-proxies each prefix to the
// actual service (see nginx/nginx.conf upstream blocks). If a prefix ever
// changes, change it here only.
window.APP_CONFIG = {
    FRIEND_BASE: '/api/friend',
    GROUPS_BASE: '/api/groups',
    CONNECTIONS_BASE: '/api/connections',
    FILES_BASE: '/api/fileRepository',
    AI_BASE: '/api/ai',
    BACKUP_BASE: '/backup',
};
