const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  try {
    const companyResult = await pool.query(
      "INSERT INTO companies (name, description, website) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id",
      ['k6-load-test-company', 'Local load test company', 'https://example.com']
    );

    let companyId;
    if (companyResult.rows[0]) {
      companyId = companyResult.rows[0].id;
    } else {
      const existing = await pool.query("SELECT id FROM companies WHERE name = $1 ORDER BY created_at DESC LIMIT 1", ['k6-load-test-company']);
      companyId = existing.rows[0].id;
    }

    const userResult = await pool.query(
      "INSERT INTO users (email, name, role, company_id, google_sub) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET company_id = EXCLUDED.company_id, role = 'user' RETURNING id, email, role, company_id, token_version",
      ['k6-user@local.test', 'K6 Load Tester', 'user', companyId, 'k6-local-user']
    );

    const user = userResult.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, companyId: user.company_id, token_version: user.token_version || 0, aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });

    console.log('AUTH_TOKEN=' + token);
    console.log('COMPANY_ID=' + companyId);
    console.log('USER_EMAIL=' + user.email);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
