-- Migration: add token_version to users for per-user token revocation
BEGIN;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

COMMIT;
