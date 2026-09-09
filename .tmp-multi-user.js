const dotenv = require('dotenv');
dotenv.config();
const fs = require('fs');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  const companyName = 'k6-multi-user-company-' + Date.now();
  const companyResult = await pool.query(
    'INSERT INTO companies (name, description, website) VALUES ($1, $2, $3) RETURNING id',
    [companyName, 'Multi-user concurrent load test', 'https://example.com']
  );
  const companyId = companyResult.rows[0].id;

  const tokens = [];
  for (let i = 0; i < 200; i++) {
    const email = `k6user${Date.now()}${i}@local.test`;
    const userResult = await pool.query(
      `INSERT INTO users (email, name, role, company_id, google_sub)
       VALUES ($1, $2, 'user', $3, $4)
       RETURNING id, email, role, company_id, token_version`,
      [email, `K6 User ${i}`, companyId, `k6-local-user-${Date.now()}-${i}`]
    );
    const user = userResult.rows[0];
    const token = jwt.sign(
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
    tokens.push(token);
  }

  fs.writeFileSync('.k6-tokens.json', JSON.stringify({ companyId, tokens }, null, 2));
  console.log('COMPANY_ID=' + companyId);
  console.log('TOKENS=' + tokens.length);
  await pool.end();
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
