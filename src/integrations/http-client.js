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

module.exports = { requestJson };
