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

// O usuário pode abrir esta tela? Precisa das DUAS coisas: permissão do perfil e recurso do plano
// da empresa — o mesmo par que o backend exige (permit + feature). Serve para não oferecer atalho
// para uma tela que vai recusar. `permissions` aceita lista (basta uma) e `feature` é opcional.
export function canAccess(permissions, feature) {
  const user = session.user;
  if (!user) return false;
  const required = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []);
  const granted = new Set(user.permissions || []);
  const temPermissao = user.role === 'Administrador' || !required.length || required.some((key) => granted.has(key));
  if (!temPermissao) return false;
  if (!feature) return true;
  return new Set(user.resources || []).has(feature);
}
