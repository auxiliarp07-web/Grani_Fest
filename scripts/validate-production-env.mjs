import fs from 'fs';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
  'RECAPTCHA_SECRET_KEY',
  'ALLOWED_ORIGINS'
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length) {
  console.error('Missing required production variables:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log('Production environment looks valid.');
console.log('Required variables found:', required.length);
