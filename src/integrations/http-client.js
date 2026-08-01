async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const response = await fetch(url, {
    method,
    headers: { accept: 'application/json', 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error('Falha na integração externa.'), { status: 502, providerStatus: response.status });
  return payload;
}

// Alguns provedores de WhatsApp só aceitam application/x-www-form-urlencoded (menuia, wm).
// A resposta deles nem sempre é JSON, então devolvemos texto quando não der para parsear.
async function requestForm(url, fields, { headers = {}, timeoutMs = 15000 } = {}) {
  const body = new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value ?? '')]));
  const response = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) throw Object.assign(new Error('Falha na integração externa.'), { status: 502, providerStatus: response.status });
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

module.exports = { requestJson, requestForm };
