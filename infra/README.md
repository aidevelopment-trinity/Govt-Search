# Infrastructure

This directory is reserved for deployment notes and future infrastructure definitions.

The current product is a Next.js government contract search app. The intended
production shape is:

- GitHub private repository under the project account.
- Vercel project under the project account/team.
- Supabase project under the project account for saved searches, sources, users,
  and opportunity tracking.
- Environment variables stored in Vercel, not in git.
