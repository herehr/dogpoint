// Thin re-exports so components can import from './services/auth'
export { setToken as setAuthToken, getToken as getAuthToken, clearToken as clearAuthToken } from './api'

export function isLoggedIn() { return !!(sessionStorage.getItem('dp:authToken') || localStorage.getItem('dp:authToken')) }
export function requireAuth() { if (!isLoggedIn()) throw new Error('Not authenticated') }