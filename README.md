# Gov Contract Finder

A simple government contract search platform for leadership, management,
training, coaching, and workforce development opportunities.

The app searches connected public procurement sources from one place, returns
matching opportunities, and helps a human reviewer understand what is needed to
apply. It does not automatically submit bids.

## Current Scope

- Federal opportunity search through SAM.gov when `SAM_API_KEY` is configured.
- Texas-first source wiring for state, city, county, school district, and special
  district procurement portals.
- Combined search UI for one concept across connected sources.
- Result details with due dates, budget notes when available, source links,
  document links, and an application checklist.

## Repository Layout

- `apps/web` - Next.js contract search app.
- `gov-contracts` - source lists, target accounts, saved searches, and tracker
  templates.
- `docs/texas-source-wiring-plan.md` - Texas source connection notes.
- `infra` - deployment notes.

## Local Development

```bash
cd apps/web
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Required Services

- GitHub: private repo under the dedicated project account.
- Vercel: hosts the Next.js app under the dedicated project account/team.
- Supabase: stores saved searches, source health, users, and opportunities under
  the dedicated project account.
- SAM.gov API key: stored only in `.env.local` locally and Vercel environment
  variables in production.

## Account Safety Rule

Do not push, link, or deploy this project unless GitHub, Vercel, and Supabase are
confirmed to be under the dedicated project account: `aidevelopment@trinitytd.com`.
