const crypto = require('node:crypto');

const sessions = new Map();
const attempts = new Map();
const lifetime = 8 * 60 * 60 * 1000;
const cookieName = 'orionexa_admin';

function token(req) {
  const cookies = (req.headers.cookie || '').split(';');
  return cookies.map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

function authenticated(req) {
  return (sessions.get(token(req)) || 0) > Date.now();
}

function sameOrigin(req, res, next) {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ success: false, message: 'Origine non autorisée.' });
  }
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.get('host')) {
        return res.status(403).json({ success: false, message: 'Origine non autorisée.' });
      }
    } catch {
      return res.status(403).json({ success: false, message: 'Origine invalide.' });
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!authenticated(req)) {
    return res.status(401).json({ success: false, message: 'Connexion administrateur requise.' });
  }
  sameOrigin(req, res, next);
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https',
    path: '/'
  };
}

function registerAdminAuth(app) {
  app.get('/api/admin/session', (req, res) => {
    res.json({ success: authenticated(req) });
  });
  app.post('/api/admin/login', sameOrigin, (req, res) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return res.status(503).json({ success: false, message: 'Mot de passe administrateur non configuré.' });
    }
    const now = Date.now();
    for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (entry.count >= 5) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    }
    const { username, password } = req.body || {};
    const hash = value => crypto.createHash('sha256').update(value).digest();
    if (username !== 'admin' || typeof password !== 'string' ||
        !crypto.timingSafeEqual(hash(password), hash(expected))) {
      entry.count += 1;
      attempts.set(key, entry);
      return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
    }
    attempts.delete(key);
    sessions.delete(token(req));
    const session = crypto.randomBytes(32).toString('hex');
    sessions.set(session, now + lifetime);
    res.cookie(cookieName, session, { ...cookieOptions(req), maxAge: lifetime });
    res.json({ success: true });
  });
  app.post('/api/admin/logout', sameOrigin, (req, res) => {
    sessions.delete(token(req));
    res.clearCookie(cookieName, cookieOptions(req));
    res.json({ success: true });
  });
}

module.exports = { registerAdminAuth, requireAdmin };
