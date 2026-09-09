import 'dotenv/config';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

(async ()=>{
  try{
    // get admin id from env or known
    const adminEmail='brahianosorio2003@gmail.com';
    // find admin id via /api/auth/me using a freshly signed token from DB will require current token_version; instead we will call /api/auth/me after generating token using current token_version from DB
    // But easier: fetch users list as admin using a token signed after reading DB token_version
    // Fetch admin user id from DB by calling /api/admin/users with a temporary token won't work.
    // We'll query DB directly here to get admin id (since script runs locally)
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query('SELECT id, token_version FROM users WHERE email=$1', [adminEmail]);
    if (!r.rows[0]) { console.error('Admin not found'); process.exit(1);}    
    const admin = r.rows[0];

    const token = jwt.sign({ sub: admin.id, email: adminEmail, role: 'admin', aud: 'grani-fest', token_version: admin.token_version || 0 }, process.env.JWT_SECRET, { expiresIn: '12h' });

    console.log('Using token_version', admin.token_version, 'TOKEN', token.slice(0,40)+'...');

    // call revoke endpoint with this token
    const revokeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/admin/users/${admin.id}/revoke`, { method: 'POST', headers: { Authorization: 'Bearer '+token } });
    console.log('Revoke status', revokeRes.status, await revokeRes.text());

    // Now call /api/auth/me with same token - should be rejected (401)
    const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/auth/me`, { headers: { Authorization: 'Bearer '+token } });
    console.log('/api/auth/me status after revoke', meRes.status, await meRes.text());

    // confirm DB token_version incremented
    const r2 = await pool.query('SELECT token_version FROM users WHERE id=$1', [admin.id]);
    console.log('token_version after revoke', r2.rows[0].token_version);
    await pool.end();
  }catch(e){ console.error('ERR', e); process.exit(1);} 
})();
