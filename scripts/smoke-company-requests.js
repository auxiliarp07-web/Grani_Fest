require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

  const userRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'user' ORDER BY created_at ASC LIMIT 1");
  const adminRes = await pool.query("SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1");

  if (!userRes.rows[0] || !adminRes.rows[0]) {
    console.log('Missing seed data for user/admin');
    process.exit(1);
  }

  const user = userRes.rows[0];
  const admin = adminRes.rows[0];

  const userToken = jwt.sign({ sub: user.id, email: user.email, role: user.role, aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  const adminToken = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role, aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });

  const createRes = await fetch('http://localhost:4000/api/company-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      companyName: 'Nova Verve',
      contactName: 'Ana Test',
      email: 'ana@test.com',
      website: 'https://novaverve.test',
      description: 'Empresa de prueba'
    })
  });

  const createData = await createRes.json();
  console.log('CREATE', createRes.status, JSON.stringify(createData));

  const listRes = await fetch('http://localhost:4000/api/admin/company-requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  const listData = await listRes.json();
  console.log('LIST', listRes.status, JSON.stringify(listData));

  const requestId = listData.requests && listData.requests[0] && listData.requests[0].id;
  if (!requestId) {
    console.log('No requests available for approval');
    process.exit(1);
  }

  const patchRes = await fetch(`http://localhost:4000/api/admin/company-requests/${requestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve', adminNotes: 'Approved by smoke test' })
  });

  const patchData = await patchRes.json();
  console.log('PATCH', patchRes.status, JSON.stringify(patchData));

  await pool.end();
})();
