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
  SETTINGS: '/settings',
  ANALYTICS: '/analytics',
  VALIDATION: '/validation',
  FILE_UPLOAD: '/friends/:id/fileUpload',
  PROFILE: '/friends/:id/profile',
};

// ROUTES.TALKED is a react-router pattern (:id) — this fills it in for
// building an actual link/navigate target, the first internal per-entity
// route in the SPA.
export const talkedPath = (friendId: number) => `/friends/${friendId}/talked`;

// Same pattern as talkedPath — fills in ROUTES.FRIEND_KNOWLEDGE's :id.
export const friendKnowledgePath = (friendId: number) => `/friends/${friendId}/knowledge`;

// Same pattern as talkedPath — fills in ROUTES.FRIEND_SOCIAL's :id. Legacy
// reached this page via `/social?friendId=X` (a query param, not a path
// segment) — repointed to a path param for consistency with every other
// per-entity route in this SPA (talkedPath, friendKnowledgePath,
// groupDetailsPath all use one).
export const friendSocialPath = (friendId: number) => `/friends/${friendId}/social`;

// Same pattern as talkedPath — fills in ROUTES.GROUP_DETAILS' :id.
export const groupDetailsPath = (groupId: number) => `/groups/${groupId}`;

// Same pattern as talkedPath — fills in ROUTES.FILE_UPLOAD's :id. Legacy
// reached this at /fileUpload/{friendId} (the path's last segment, parsed
// manually in UploadController.js) — repointed to a named :id param for
// consistency with every other per-entity route in this SPA.
export const fileUploadPath = (friendId: number) => `/friends/${friendId}/fileUpload`;

// Same pattern as talkedPath — fills in ROUTES.PROFILE's :id. Legacy reached
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