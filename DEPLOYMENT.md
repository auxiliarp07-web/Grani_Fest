# Deployment guide for production

## Recommended architecture

- Frontend: Vercel
- Database: Neon Postgres
- API: separate Express service (recommended) or Vercel serverless if refactored later

## 1) Database setup on Neon

1. Create a new Postgres project in Neon.
2. Copy the connection string to `DATABASE_URL`.
3. Apply migrations before launch.
4. Create the admin user using the admin creation script or a direct SQL insert.

## 2) Environment variables

Use the values in `.env.example` as your production template.

Required production variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RECAPTCHA_SECRET_KEY`

Validate them before deploy:

```bash
node scripts/validate-production-env.mjs
```

## 3) Deploy frontend to Vercel

1. Import the repo into Vercel.
2. Set the project environment variables from `.env.example`.
3. Ensure the build succeeds with `next build`.
4. Set the production domain in Google OAuth and reCAPTCHA allowlists.

## 4) Deploy API separately

Recommended for stability:

- Keep the API in a Node runtime outside the frontend, such as Render, Railway, Fly.io, or another managed Node host.
- Configure the API URL in `NEXT_PUBLIC_API_URL`.
- Allow the API domain in `ALLOWED_ORIGINS`.

## 5) Post-launch checks

- `GET /api/health` returns 200
- `GET /api/results/public` returns data
- login works with Google
- `/api/auth/me` returns the current user with a valid token
- one vote per user is enforced
- admin dashboard loads correctly

## 6) Production hardening

- Use a real secret for `JWT_SECRET`
- Keep `RECAPTCHA_BYPASS=false` in production
- Keep audit logs limited or archived to avoid uncontrolled DB growth
- Monitor DB storage and API latency
- Increase Neon plan if storage/compute needs grow

## 7) Rollback plan

- Keep the last known good deployment tagged
- Keep data backups in Neon
- If a deploy fails, revert the frontend or API to the previous deployment immediately
