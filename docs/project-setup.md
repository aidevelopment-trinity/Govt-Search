# Project Setup

## Account Rule

Only use accounts connected to `aidevelopment@trinitytd.com`.

Do not push, link, deploy, or create cloud resources from another GitHub, Vercel,
or Supabase account.

## Services To Set Up

1. GitHub private repo for the code.
2. Vercel project connected to that GitHub repo.
3. Supabase project for saved searches, tracked opportunities, and source health.
4. SAM.gov API key stored in Vercel environment variables.

## GitHub

- Create the repo while signed into the correct GitHub account.
- Add this local repo as the remote only after the account/repo is confirmed.
- Push only the contract-finder files, not unrelated output or old project files.

## Vercel

- Connect Vercel to the correct GitHub repo.
- Set the app root to `apps/web`.
- Build command: `npm run build`.
- Install command: `npm install`.
- Add environment variables from `.env.example`.
- To password-protect the site, set:
  - `APP_BASIC_AUTH_USERNAME`
  - `APP_BASIC_AUTH_PASSWORD`

## Supabase

- Create one Supabase project under the correct account.
- Store the project URL and keys in Vercel, not in git.
- Run the SQL in `docs/supabase-schema.sql` from the Supabase SQL Editor.
- Add these Vercel environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Redeploy the Vercel project after adding the variables.

The app uses Supabase for:

- Saved searches.
- Tracked opportunities.
- Saved proposal status and notes.
- Source health checks from each search run.

## First Push Checklist

- GitHub account is confirmed.
- Vercel account/team is confirmed.
- Supabase account/project is confirmed.
- `.env.local` files are not staged.
- Old project folders like `outputs`, `apps/api`, `akem-growth`, and
  `akem-insights` are not staged.
