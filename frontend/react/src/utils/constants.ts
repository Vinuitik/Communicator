export const ROUTES = {
  HOME: '/',
  FRIENDS: '/friends',
  CALENDAR: '/calendar',
  ADD_FRIEND: '/friends/add',
  TALKED: '/friends/:id/talked',
  FRIEND_KNOWLEDGE: '/friends/:id/knowledge',
  FRIEND_SOCIAL: '/friends/:id/social',
  GROUPS: '/groups',
  CREATE_GROUP: '/groups/create',
  GROUP_DETAILS: '/groups/:id',
  CONNECTIONS: '/connections',
  CREATE_CONNECTION: '/connections/create',
  CONNECTION_DETAILS: '/connections/:friend1Id/:friend2Id',
  SETTINGS: '/settings',
  GET_APP: '/get-app',
  INSIGHTS: '/insights',
  REVIEW: '/review',
  FILE_UPLOAD: '/friends/:id/fileUpload',
  PROFILE: '/friends/:id/profile',
};

// ROUTES.TALKED/FRIEND_KNOWLEDGE/FRIEND_SOCIAL/FILE_UPLOAD stay registered in
// App.tsx (redirecting old per-friend links into the Profile hub — see
// RedirectToProfile) but nothing builds links to them anymore, so their old
// path-builder functions were removed along with the standalone pages.

export const groupDetailsPath = (groupId: number) => `/groups/${groupId}`;

// Friend order doesn't matter server-side (ConnectionService normalizes to
// min/max) but the URL needs a canonical form to avoid two links to the
// "same" connection — always build it with the smaller id first.
export const connectionDetailsPath = (friend1Id: number, friend2Id: number) =>
  `/connections/${Math.min(friend1Id, friend2Id)}/${Math.max(friend1Id, friend2Id)}`;

// Fills in ROUTES.PROFILE's :id. Legacy reached
// this at /profile/{friendId} (WebController.profile, Thymeleaf-rendered,
// live via /api/friend/profile/{id} — see PathPrefixConfig) — repointed to
// the SPA's own route for consistency with every other per-entity page.
export const profilePath = (friendId: number) => `/friends/${friendId}/profile`;

export const TIMEOUTS = {
  API_REQUEST: 5000, // 5 seconds
}; 

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error, please try again later.',
  NOT_FOUND: 'Requested resource not found.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
}; 

export const SUCCESS_MESSAGES = {
  DATA_LOADED: 'Data loaded successfully.',
  ACTION_COMPLETED: 'Action completed successfully.',
}; 

export const DEFAULTS = {
  PAGE_SIZE: 10,
};

// Contact-expectation role options -> desiredRetention preset (RoleProperties).
// Mirrors RoleProperties' starter presets in application.yml
// (fsrs.role.desired-retention). Shared by AddFriendForm and QuickLogModal.
export const ROLE_OPTIONS = [
  { value: 'Partner', label: 'Partner' },
  { value: 'Close', label: 'Close friend' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Family', label: 'Family' },
];