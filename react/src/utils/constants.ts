export const ROUTES = {
  HOME: '/',
  CALENDAR: '/calendar',
  ADD_FRIEND: '/friends/add',
  TALKED: '/friends/:id/talked',
  GROUPS: '/groups',
  CREATE_GROUP: '/groups/create',
  VALIDATION: '/validation',
  // Not yet ported to the SPA — still served by the legacy MPA.
  SOCIAL: '/social',
  FILE_UPLOAD: '/fileUpload',
};

// ROUTES.TALKED is a react-router pattern (:id) — this fills it in for
// building an actual link/navigate target, the first internal per-entity
// route in the SPA.
export const talkedPath = (friendId: number) => `/friends/${friendId}/talked`;

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