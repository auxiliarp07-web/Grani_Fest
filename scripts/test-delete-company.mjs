import 'dotenv/config';
import jwt from 'jsonwebtoken';

const id = 'e8a473e7-5e78-4c80-8626-878f6900e5a6';
const token = jwt.sign({ sub: 'e9c7a98b-8313-4582-a2ae-35d22fc880f3', email: 'brahianosorio2003@gmail.com', role: 'admin', aud: 'grani-fest' }, process.env.JWT_SECRET, { expiresIn: '12h' });

(async () => {
  try {
    const res = await fetch(`http://localhost:4000/api/admin/companies/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log('BODY', text);
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
