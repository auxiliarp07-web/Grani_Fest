require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: false,
});

const COMPANY_NAME = 'Concurrency Stress Check';
const USER_COUNT = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCompany() {
  const existing = await pool.query('SELECT id FROM companies WHERE name = $1', [COMPANY_NAME]);
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await pool.query(
    'INSERT INTO companies (name, description, website) VALUES ($1, $2, $3) RETURNING id',
    [COMPANY_NAME, 'Stress validation company', 'https://example.com']
  );
  return created.rows[0].id;
}

async function createUsers(companyId) {
  const users = [];
  for (let i = 0; i < USER_COUNT; i += 1) {
    const email = `stress_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 10)}@example.com`;
    const row = await pool.query(
      `INSERT INTO users (email, name, role, company_id, token_version)
       VALUES ($1, $2, 'user', $3, 0)
       ON CONFLICT (email) DO UPDATE SET company_id = EXCLUDED.company_id
       RETURNING *`,
      [email, `stress-user-${i}`, companyId]
    );
    users.push(row.rows[0]);
  }
  return users;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      token_version: user.token_version || 0,
      aud: 'grani-fest',
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function sendVote(token, companyId) {
  const response = await fetch('http://localhost:4000/api/vote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ companyId, recaptchaToken: 'test-token' }),
  });

  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  return { status: response.status, ok: response.ok, data };
}

async function main() {
  const companyId = await ensureCompany();
  const users = await createUsers(companyId);
  const tokens = users.map(signToken);

  const start = Date.now();
  const results = await Promise.all(
    tokens.map((token) => sendVote(token, companyId))
  );
  const duration = Date.now() - start;

  const accepted = results.filter((r) => r.status === 200).length;
  const duplicates = results.filter((r) => r.status === 409).length;
  const failures = results.filter((r) => r.status >= 400 && r.status !== 409).length;

  const voteCount = await pool.query('SELECT COUNT(*)::int AS total FROM votes WHERE company_id = $1', [companyId]);
  const uniqueUsers = await pool.query('SELECT COUNT(DISTINCT user_id)::int AS total FROM votes WHERE company_id = $1', [companyId]);

  console.log(JSON.stringify({
    companyId,
    usersCreated: users.length,
    durationMs: duration,
    accepted,
    duplicates,
    failures,
    votesInserted: voteCount.rows[0].total,
    uniqueVoters: uniqueUsers.rows[0].total,
    sample: results.slice(0, 5),
  }, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error('Concurrency check failed:', err);
  process.exit(1);
});
