export function isLoggedIn() { return !!sessionStorage.getItem('accessToken'); }
export function requireAuth() { if (!isLoggedIn()) throw new Error('Not authenticated'); }
export function getToken() { return sessionStorage.getItem('accessToken'); }
