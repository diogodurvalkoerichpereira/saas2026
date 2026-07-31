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

export async function uploadAttachment(path, file) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.token}`,
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
      'x-file-type': file.type || 'application/octet-stream'
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar o arquivo.');
  return payload;
}

export async function uploadCertificate(path, file, password) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.token}`,
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
      'x-cert-password': encodeURIComponent(password)
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar o certificado.');
  return payload;
}

export async function downloadAttachment(path, fileName) {
  const response = await fetch(path, { headers: { authorization: `Bearer ${session.token}` } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Não foi possível baixar o arquivo.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
