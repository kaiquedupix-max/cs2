export const TERMS_VERSION='2026-11-10.1';
export async function initTerms(pool){await pool.query(`ALTER TABLE checkout_payments ADD COLUMN IF NOT EXISTS terms_version TEXT,ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;ALTER TABLE cf_bot_users ADD COLUMN IF NOT EXISTS terms_version TEXT,ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;`);}
