// frontend/src/services/auth.ts

// Reuse the single source of truth from services/api.ts
import { getToken as coreGetToken } from './api';

export const isLoggedIn = () => !!coreGetToken();

export const requireAuth = () => {
  if (!coreGetToken()) throw new Error('Not authenticated');
};

// Re-export the token helpers under the legacy names
export {
  setToken as setAuthToken,
  getToken as getAuthToken,
  clearToken as clearAuthToken,
} from './api';