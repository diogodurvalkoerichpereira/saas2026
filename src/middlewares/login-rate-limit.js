const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map();

function loginRateLimit(req, res, next) {
  const identifier = String(req.body?.email || '').trim().toLowerCase();
  const key = `${req.ip}:${identifier}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAttempt >= WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return next();
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
  }
  entry.count += 1;
  next();
}

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt >= WINDOW_MS) attempts.delete(key);
  }
}, WINDOW_MS);
sweep.unref();

module.exports = { loginRateLimit };
