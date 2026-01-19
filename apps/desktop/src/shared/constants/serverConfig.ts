export const MAIN_SERVER_URL = import.meta.env.VITE_MAIN_SERVER_URL || 'http://localhost:8000';
export const MAIN_SERVER_ENDPOINT = `${MAIN_SERVER_URL}/api/v1`;

export const AUTH_ENDPOINTS = {
  LOGIN: `${MAIN_SERVER_ENDPOINT}/auth/login`,
  SIGNUP: `${MAIN_SERVER_ENDPOINT}/auth/signup`,
  REFRESH: `${MAIN_SERVER_ENDPOINT}/auth/refresh`,
  VERIFY_EMAIL: `${MAIN_SERVER_ENDPOINT}/auth/verify-email`,
};
