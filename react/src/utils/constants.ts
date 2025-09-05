export const API_BASE_URL = 'http://localhost:8090/api'; // Base URL for API calls

export const ROUTES = {
  HOME: '/',
  FRIENDS: '/friends',
  GROUPS: '/groups',
  VALIDATION: '/validation',
  SOCIAL: '/social',
  CREATE_GROUP: '/api/groups/createGroup',
  FILE_UPLOAD: '/fileUpload',
}; 

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