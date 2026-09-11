require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const RESULT_CACHE_TTL_MS = 5000;
const publicResultsCache = { value: null, expiresAt: 0 };
const auditQueue = [];
let auditWorkerRunning = false;

function invalidatePublicResultsCache() {
  publicResultsCache.expiresAt = 0;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const rateLimitBase = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
};

const apiLimiter = rateLimit({
  ...rateLimitBase,
  max: process.env.NODE_ENV === 'production' ? 2000 : 25000,
  skipSuccessfulRequests: false
});

const publicResultsLimiter = rateLimit({
  ...rateLimitBase,
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
  skipSuccessfulRequests: false
});

const voteLimiter = rateLimit({
  ...rateLimitBase,
  max: process.env.NODE_ENV === 'production' ? 120 : 3000,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
  skipSuccessfulRequests: false
});

app.use(helmet());
// Restrict CORS to an allowlist. In dev DEFAULT_ALLOW will include localhost.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests (curl, server-to-server) when origin is undefined
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.use('/api/results/public', publicResultsLimiter);
app.use('/api/vote', voteLimiter);
app.use('/api', apiLimiter);

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      token_version: user.token_version || 0,
      aud: 'grani-fest'
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(requiredRole = null) {
  return async function (req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: missing token' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.sub]);

      if (!user.rows[0]) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = user.rows[0];

      // token_version enforcement: tokens include token_version; if mismatched, reject
      if (typeof decoded.token_version !== 'undefined' && Number(decoded.token_version) !== Number(req.user.token_version || 0)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      if (requiredRole && req.user.role !== requiredRole) {
        return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function sendServerError(res, publicMessage, err) {
  console.error('SERVER ERROR:', publicMessage, err && err.stack ? err.stack : err);
  return res.status(500).json({ error: publicMessage });
}

async function verifyRecaptcha(token) {
  if (process.env.NODE_ENV !== 'production' && ['true', '1', 'yes'].includes(String(process.env.RECAPTCHA_BYPASS || '').toLowerCase())) {
    return true;
  }

  if (!token) return false;

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      })
    });

    const data = await response.json();
    return Boolean(data.success);
  } catch (error) {
    return false;
  }
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      website VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      google_sub VARCHAR(255),
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      company_id UUID REFERENCES companies(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      company_id UUID NOT NULL REFERENCES companies(id),
      ip_address VARCHAR(255),
      recaptcha_score NUMERIC(4,3) DEFAULT 0,
      hash_value VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      actor_email VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      company_name VARCHAR(255) NOT NULL,
      contact_name VARCHAR(255),
      email VARCHAR(255) NOT NULL,
      website VARCHAR(255),
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP,
      reviewed_by UUID REFERENCES users(id)
    );
  `);

  // Ensure token_version column exists for per-user token revocation
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0`);
}

function enqueueAudit(entry) {
  auditQueue.push(entry);
  if (auditWorkerRunning) return;

  auditWorkerRunning = true;
  setImmediate(async () => {
    try {
      while (auditQueue.length) {
        const item = auditQueue.shift();
        await pool.query(
          'INSERT INTO audit_logs(actor_id, actor_email, action, details) VALUES ($1, $2, $3, $4)',
          [item.actorId || null, item.actorEmail || null, item.action, JSON.stringify(item.details || {})]
        );
      }
    } catch (error) {
      console.error('Audit queue error:', error && error.stack ? error.stack : error);
    } finally {
      auditWorkerRunning = false;
      if (auditQueue.length) {
        setImmediate(() => enqueueAudit({ action: 'audit_retry' }));
      }
    }
  });
}

async function logAudit({ actorId, actorEmail, action, details }) {
  enqueueAudit({ actorId, actorEmail, action, details });
  return true;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Grani Fest API online' });
});

app.post(
  '/api/auth/login',
  [body('credential').exists().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).json({ error: 'Google authentication failed' });
      }

      let user = await pool.query('SELECT * FROM users WHERE email = $1', [payload.email]);

      if (!user.rows[0]) {
        user = await pool.query(
          `INSERT INTO users (email, name, avatar_url, google_sub, role)
           VALUES ($1, $2, $3, $4, 'user')
           RETURNING *`,
          [payload.email, payload.name || 'Google User', payload.picture || null, payload.sub]
        );
      } else {
        user = await pool.query(
          `UPDATE users
           SET name = $1, avatar_url = $2, google_sub = $3, updated_at = NOW()
           WHERE email = $4
           RETURNING *`,
          [payload.name || 'Google User', payload.picture || null, payload.sub, payload.email]
        );
      }

      const currentUser = user.rows[0];
      const token = signToken(currentUser);

      await logAudit({
        actorEmail: currentUser.email,
        action: 'user_login',
        details: { role: currentUser.role }
      });

      return res.json({
        token,
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          companyId: currentUser.company_id
        }
      });
    } catch (error) {
      console.error('Google login error:', error && error.stack ? error.stack : error);
      return res.status(401).json({ error: 'Invalid Google login' });
    }
  }
);

app.get('/api/auth/me', requireAuth(), async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.company_id } });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch user' });
  }
});

app.post(
  '/api/vote',
  requireAuth('user'),
  [body('companyId').exists().isUUID(), body('recaptchaToken').exists().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const isValidCaptcha = await verifyRecaptcha(req.body.recaptchaToken);
      if (!isValidCaptcha) {
        return res.status(400).json({ error: 'reCAPTCHA validation failed' });
      }

      const companyExists = await pool.query('SELECT * FROM companies WHERE id = $1', [req.body.companyId]);
      if (!companyExists.rows[0]) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const hash = crypto.createHash('sha256')
        .update(`${req.user.id}:${req.body.companyId}:${Date.now()}`)
        .digest('hex');

      const insertResult = await pool.query(
        `INSERT INTO votes (user_id, company_id, ip_address, recaptcha_score, hash_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [req.user.id, req.body.companyId, getClientIp(req), 1, hash]
      );

      if (!insertResult.rows[0]) {
        return res.status(409).json({ error: 'User already voted' });
      }

      invalidatePublicResultsCache();
      enqueueAudit({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'vote_cast',
        details: { companyId: req.body.companyId, hash }
      });

      return res.json({ success: true, message: 'Vote recorded', hash });
    } catch (error) {
      return sendServerError(res, 'Voting failed', error);
    }
  }
);

app.get('/api/results/public', async (req, res) => {
  try {
    const now = Date.now();
    if (publicResultsCache.value && now < publicResultsCache.expiresAt) {
      return res.json({ results: publicResultsCache.value });
    }

    const results = await pool.query(`
      SELECT c.id, c.name, c.description, c.website, COUNT(v.id) AS votes
      FROM companies c
      LEFT JOIN votes v ON v.company_id = c.id
      GROUP BY c.id, c.name, c.description, c.website
      ORDER BY votes DESC
    `);

    publicResultsCache.value = results.rows;
    publicResultsCache.expiresAt = now + RESULT_CACHE_TTL_MS;

    return res.json({ results: results.rows });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch results', error);
  }
});

app.get('/api/results/company/:id', requireAuth('brand'), async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);

    if (!company.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (req.user.company_id !== companyId) {
      return res.status(403).json({ error: 'Brand can only access its own company stats' });
    }

    const stats = await pool.query(`
      SELECT COUNT(*) AS total_votes,
             MIN(v.created_at) AS first_vote,
             MAX(v.created_at) AS last_vote
      FROM votes v
      WHERE v.company_id = $1
    `, [companyId]);

    return res.json({ company: company.rows[0], stats: stats.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch company stats', error);
  }
});

app.get('/api/admin/users', requireAuth('admin'), async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return res.json({ users: users.rows });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch users' });
  }
});

app.patch('/api/admin/users/:id/role', requireAuth('admin'), async (req, res) => {
  const { role, companyId } = req.body;
  const allowedRoles = ['user', 'brand', 'admin'];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const user = await pool.query(
      `UPDATE users
       SET role = $1, company_id = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [role, companyId || null, req.params.id]
    );

    if (!user.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'role_updated',
      details: { targetUserId: user.rows[0].id, role: user.rows[0].role, companyId: user.rows[0].company_id }
    });

    return res.json({ user: user.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to update user role', error);
  }
});

app.get('/api/admin/companies', requireAuth('admin'), async (req, res) => {
  try {
    const companies = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
    return res.json({ companies: companies.rows });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to fetch companies' });
  }
});

app.post('/api/admin/companies', requireAuth('admin'), async (req, res) => {
  const { name, description, website } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const company = await pool.query(
      `INSERT INTO companies (name, description, website) VALUES ($1, $2, $3) RETURNING *`,
      [name, description || '', website || '']
    );

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'company_created',
      details: { companyId: company.rows[0].id, name }
    });

    return res.status(201).json({ company: company.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to create company', error);
  }
});

app.put('/api/admin/companies/:id', requireAuth('admin'), async (req, res) => {
  const { name, description, website } = req.body;

  try {
    const company = await pool.query(
      `UPDATE companies SET name = COALESCE($1, name), description = COALESCE($2, description), website = COALESCE($3, website)
       WHERE id = $4 RETURNING *`,
      [name, description, website, req.params.id]
    );

    if (!company.rows[0]) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json({ company: company.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to update company', error);
  }
});

app.delete('/api/admin/companies/:id', requireAuth('admin'), async (req, res) => {
  try {
    // Use a transaction: clear any user references first to avoid FK violations,
    // then delete the company.
    await pool.query('BEGIN');
    await pool.query('UPDATE users SET company_id = NULL WHERE company_id = $1', [req.params.id]);
    const company = await pool.query('DELETE FROM companies WHERE id = $1 RETURNING *', [req.params.id]);
    if (!company.rows[0]) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Company not found' });
    }
    await pool.query('COMMIT');

    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'company_deleted', details: { companyId: req.params.id } });

    return res.json({ deleted: true, company: company.rows[0] });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch (e) {}
    return sendServerError(res, 'Unable to delete company', error);
  }
});

app.get('/api/admin/audit', requireAuth('admin'), async (req, res) => {
  try {
    const rows = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    const data = rows.rows.map((row) => ({
      ...row,
      hash: crypto.createHash('sha256').update(`${row.id}:${row.created_at}:${row.action}`).digest('hex')
    }));

    return res.json({ logs: data });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to export audit data' });
  }
});

app.post('/api/company-requests', requireAuth('user'), async (req, res) => {
  const { companyName, contactName, email, website, description } = req.body;

  if (!companyName || !email) {
    return res.status(400).json({ error: 'companyName and email are required' });
  }

  try {
    const request = await pool.query(
      `INSERT INTO company_requests (user_id, company_name, contact_name, email, website, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, companyName, contactName || req.user.name || '', email, website || '', description || '']
    );

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'company_request_created',
      details: { companyName, email, requestId: request.rows[0].id }
    });

    return res.status(201).json({ request: request.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to create company request', error);
  }
});

app.get('/api/admin/company-requests', requireAuth('admin'), async (req, res) => {
  try {
    const requests = await pool.query(`
      SELECT cr.*, u.name as user_name, u.email as user_email
      FROM company_requests cr
      LEFT JOIN users u ON u.id = cr.user_id
      ORDER BY cr.created_at DESC
    `);

    return res.json({ requests: requests.rows });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch company requests', error);
  }
});

app.patch('/api/admin/company-requests/:id', requireAuth('admin'), async (req, res) => {
  const { action, adminNotes } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  try {
    const request = await pool.query('SELECT * FROM company_requests WHERE id = $1', [req.params.id]);
    if (!request.rows[0]) {
      return res.status(404).json({ error: 'Company request not found' });
    }

    const currentRequest = request.rows[0];
    if (currentRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This request has already been processed' });
    }

    if (action === 'approve') {
      const existingCompany = await pool.query(
        'SELECT * FROM companies WHERE name ILIKE $1',
        [currentRequest.company_name.trim()]
      );

      const companyRow = existingCompany.rows[0] || (await pool.query(
        `INSERT INTO companies (name, description, website)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [currentRequest.company_name, currentRequest.description || '', currentRequest.website || '']
      )).rows[0];

      await pool.query(
        `UPDATE users
         SET role = 'brand', company_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [companyRow.id, currentRequest.user_id]
      );
    }

    const updatedRequest = await pool.query(
      `UPDATE company_requests
       SET status = $1, admin_notes = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [action === 'approve' ? 'approved' : 'rejected', adminNotes || '', req.user.id, req.params.id]
    );

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `company_request_${action}`,
      details: { requestId: currentRequest.id, userId: currentRequest.user_id, companyName: currentRequest.company_name }
    });

    return res.json({ request: updatedRequest.rows[0] });
  } catch (error) {
    return sendServerError(res, 'Unable to process company request', error);
  }
});

// Admin: revoke a user's tokens by bumping token_version
app.post('/api/admin/users/:id/revoke', requireAuth('admin'), async (req, res) => {
  try {
    const result = await pool.query(`UPDATE users SET token_version = COALESCE(token_version,0) + 1, updated_at = NOW() WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });

    await logAudit({ actorId: req.user.id, actorEmail: req.user.email, action: 'token_revoked', details: { targetUserId: req.params.id } });

    return res.json({ ok: true });
  } catch (error) {
    return sendServerError(res, 'Unable to revoke tokens', error);
  }
});

async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Grani Fest API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to boot API:', error);
    process.exit(1);
  }
}

start();
