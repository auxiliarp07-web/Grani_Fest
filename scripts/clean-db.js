require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Connected to DB, starting cleanup...');

    await pool.query('BEGIN');

    // Remove votes first (FK to users and companies)
    await pool.query('DELETE FROM votes');
    // Remove company requests
    await pool.query('DELETE FROM company_requests');
    // Remove audit logs
    await pool.query('DELETE FROM audit_logs');
    // Unlink users from companies to avoid FK constraint, then remove users and companies
    await pool.query("UPDATE users SET company_id = NULL");
    // Remove users
    await pool.query('DELETE FROM users');
    // Remove companies
    await pool.query('DELETE FROM companies');

    await pool.query('COMMIT');
    console.log('Cleanup completed: votes, company_requests, audit_logs, companies, users deleted.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Cleanup failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
