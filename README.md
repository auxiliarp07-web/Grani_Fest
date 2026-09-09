# Grani Fest

Aplicación web tipo Grani Fest con votación segura, autenticación Google, roles, API Express y paneles para usuarios, marcas y administrador.

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Google Cloud OAuth 2.0

## Instalación

1. Copia `.env.example` a `.env`.
2. Ajusta las variables de entorno.
3. Instala dependencias: `npm install`
4. Inicia la API y la app: `npm run dev`

## Endpoints principales

- `POST /api/auth/login`
- `POST /api/vote`
- `GET /api/results/public`
- `GET /api/results/company/:id`
- `GET /api/admin/companies`
- `POST /api/admin/companies`
- `PUT /api/admin/companies/:id`
- `DELETE /api/admin/companies/:id`
- `GET /api/admin/audit`

## Despliegue
**Deploying frontend to Vercel (recommended)**

- Ensure the frontend builds locally: `npm run build` (Next.js).
- In Vercel project settings add environment variables:
	- `DATABASE_URL` (only if you host API on Vercel functions; otherwise keep it for local scripts)
	- `NEXT_PUBLIC_API_URL` set to your API URL (e.g. `https://api.granifest.example`)
	- `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_ORIGINS`

- If you host only the frontend on Vercel and the API elsewhere (recommended):
	- Deploy the API to a persistent host (Render, Railway, Fly, or a container) because serverless DB connections can exhaust Postgres when using pooled `pg.Pool`.
	- Point `NEXT_PUBLIC_API_URL` to that API.

**Applying DB migrations (production)**

- Use the `migrations/` SQL files and the helper script to apply migrations against your production database before switching traffic. Locally you can run:

```bash
# Install deps if needed
npm install

# Apply migrations against DATABASE_URL
DATABASE_URL="postgres://..." node scripts/apply-migrations.mjs
```

**Notes**

- We included `migrations/001_add_token_version.sql` which adds the `token_version` column required for token revocation.
- Keep secrets in Vercel Project Settings, never commit them to the repo.
- Configure OAuth redirect URIs in Google Console to include your Vercel domain.


- Frontend en Vercel.
- API en Vercel Serverless o un servicio Node/Express.
- PostgreSQL en Supabase o Railway.

## Seguridad

- JWT con roles.
- Rate limiting.
- reCAPTCHA.
- Auditoría de voto y logs.
- Control de acceso por rol.
