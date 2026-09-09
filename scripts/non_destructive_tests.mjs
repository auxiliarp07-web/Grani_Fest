import 'dotenv/config';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureTestUser() {
  const email = 'devtest.user+local@granifest.test';
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (res.rows[0]) return res.rows[0];
  const insert = await pool.query(`INSERT INTO users (email, name, role) VALUES ($1, $2, 'user') RETURNING *`, [email, 'Dev Test']);
  return insert.rows[0];
}

(async () => {
  const results = {};
  try {
    const testUser = await ensureTestUser();
    results.testUser = testUser;

    const adminIdRes = await pool.query("SELECT id FROM users WHERE email=$1", ['brahianosorio2003@gmail.com']);
    const adminId = adminIdRes.rows[0]?.id;
    if (!adminId) throw new Error('Admin user not found in DB');

    const adminToken = jwt.sign({ sub: adminId, email: 'brahianosorio2003@gmail.com', role: 'admin', aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    const userToken = jwt.sign({ sub: testUser.id, email: testUser.email, role: 'user', aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });

    // helper
    const call = async (path, opts = {}) => {
      const url = `${API}${path}`;
      const res = await fetch(url, opts);
      const txt = await res.text();
      let body = txt;
      try { body = JSON.parse(txt); } catch (e) {}
      return { status: res.status, body };
    };

    results.health = await call('/api/health');
    results.adminMe = await call('/api/auth/me', { headers: { Authorization: 'Bearer ' + adminToken } });
    results.adminCompanies = await call('/api/admin/companies', { headers: { Authorization: 'Bearer ' + adminToken } });
    results.adminUsers = await call('/api/admin/users', { headers: { Authorization: 'Bearer ' + adminToken } });
    results.adminAudit = await call('/api/admin/audit', { headers: { Authorization: 'Bearer ' + adminToken } });

    // create a company request as user
    const cr = await call('/api/company-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + userToken },
      body: JSON.stringify({ companyName: 'DevTestCo', contactName: 'Dev', email: testUser.email, website: 'http://dev.local', description: 'Test request' })
    });

    results.createCompanyRequest = cr;
    let createdRequestId = null;
    if (cr.status === 201 && cr.body?.request?.id) createdRequestId = cr.body.request.id;

    // admin can see company requests
    results.adminCompanyRequests = await call('/api/admin/company-requests', { headers: { Authorization: 'Bearer ' + adminToken } });

    // cleanup: delete the company_request row if created
    if (createdRequestId) {
      await pool.query('DELETE FROM company_requests WHERE id = $1', [createdRequestId]);
      results.cleanedRequest = createdRequestId;
    }

    // Optionally remove test user
    await pool.query('DELETE FROM users WHERE id = $1 AND email = $2', [testUser.id, testUser.email]);
    results.cleanedUser = testUser.id;

    console.log('OK', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e.message || e);
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
})();
