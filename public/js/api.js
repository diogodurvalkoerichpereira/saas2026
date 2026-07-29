import { session } from './session.js';

export async function api(path, { method = 'GET', body, headers = {}, authenticated = true } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(authenticated && session.token ? { authorization: `Bearer ${session.token}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401 && authenticated) window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'Não foi possível concluir a operação.');
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
