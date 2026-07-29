const TOKEN_KEY = 'saas2026.token';
const USER_KEY = 'saas2026.user';

export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; }
  },
  set({ token, user }) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
};
