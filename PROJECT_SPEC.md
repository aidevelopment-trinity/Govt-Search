# Gov Contract Finder

Version: 0.1

## Mission

Help a leadership and management training business find government and
government-adjacent contract opportunities without manually checking dozens of
procurement portals.

## Product Rules

- Search and summarize opportunities; do not auto-submit applications.
- Keep a human reviewer in the loop for every bid decision and submission.
- Show the source portal and source posting for every result.
- Do not invent budget, deadline, eligibility, or submission details.
- Treat account isolation as mandatory for GitHub, Vercel, and Supabase.

## Technical Stack

- Frontend and API routes: Next.js, TypeScript, React, Tailwind.
- Hosting: Vercel.
- Database: Supabase Postgres.
- Source data: SAM.gov API plus public procurement portals.
- Repository: private GitHub repo under the dedicated project account.

## Next Build Steps

- Finish Texas source connectors and health checks.
- Add Supabase tables for saved searches, sources, source health, and tracked
  opportunities.
- Add scheduled source checks with rate limits and clear error reporting.
- Add user accounts before storing private notes or application drafts.
