require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const email = 'brahianosorio2003@gmail.com';
    const name = 'Admin Brahian';
    const role = 'admin';

    const res = await pool.query(
      `INSERT INTO users (email, name, role) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name
       RETURNING *`,
      [email, name, role]
    );

    console.log('OK', JSON.stringify(res.rows[0]));
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
