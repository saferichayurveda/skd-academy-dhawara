# Supabase Parent Portal setup

This folder replaces the Cloudflare D1/R2 dependency for the parent progress portal.

## Required Supabase project setup

1. Create a Supabase project in the Supabase dashboard.
2. In SQL Editor, run supabase/migrations/202611230001_parent_portal.sql.
3. In Project Settings / API, copy the Project URL and anon/publishable key. Never put the service-role key in browser code or GitHub.
4. Set these Edge Function secrets:
   - SUPABASE_URL: Project URL
   - SUPABASE_SERVICE_ROLE_KEY: service-role key (secret; never share in chat)
   - ADMIN_PASSWORD: a new strong admin password, at least 16 characters
   - PORTAL_TOKEN_SECRET: random secret at least 32 characters
   - SITE_ORIGIN: exact browser origin serving this website, e.g. https://saferichayurveda.github.io
5. Replace YOUR_PROJECT_REF in supabase-config.js with the Project Ref.
6. Deploy functions:
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy parent-portal-admin --no-verify-jwt
   supabase functions deploy parent-portal --no-verify-jwt
7. Import current student_profiles data from the existing school database before generating PINs. Export only the student profile fields from the old database as CSV, then import them into public.student_profiles. Do not import old PIN hashes; generate fresh PINs after import.
8. Keep the existing Cloudflare project/database untouched until the new Supabase portal is tested and data is verified.

## Security

- The tables have RLS enabled and intentionally have no public policies.
- All data access goes through Edge Functions using the service-role key server-side.
- Admin access uses ADMIN_PASSWORD and a short-lived signed token.
- Parent PINs are salted and PBKDF2-hashed; five failed attempts trigger a 15-minute lockout.
- PDF files are stored in a private Storage bucket and served through 60-second signed URLs.
- Never commit .env, service-role keys, admin passwords, or token secrets.
