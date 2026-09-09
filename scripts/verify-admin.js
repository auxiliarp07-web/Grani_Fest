require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query('SELECT id, email, role, created_at FROM users WHERE email = $1', ['brahianosorio2003@gmail.com']);
    console.log(JSON.stringify(r.rows, null, 2));
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
