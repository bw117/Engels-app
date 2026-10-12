# POLYVO — V1.3.0

Adaptive English practice for Dutch beginners, with optional accounts and cross-device progress sync.

## Run locally

```bash
npm start
```

Open `http://localhost:3000`. This basic server supports local practice with localStorage. To test the serverless account and sync routes locally, install/use the Vercel CLI and run `vercel dev` from the repo root with the environment variables below.

## Vercel deployment

Connect this repository to Vercel with the repository root as the project root. Configure these environment variables in Vercel before enabling accounts:

- `SUPABASE_URL`: the project URL from Supabase Project Settings → API.
- `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`): the project's public/publishable key. The API uses it with the authenticated user's access token and database RLS. Never put a Supabase secret/service-role key in browser code.
- Apply [`supabase/schema.sql`](supabase/schema.sql) to the Supabase project's SQL Editor.

In Supabase Auth settings, enable email/password sign-in, set the site URL to the deployed POLYVO URL, and add that URL to allowed site URLs. Choose whether email confirmation is required. If confirmation is enabled, learners confirm their email and then log in. Vercel deployments do not synchronize centrally until these Supabase steps and variables are configured.

## Central progress and migration

Account sessions are held in HttpOnly, SameSite cookies. Vercel API routes authenticate with Supabase Auth, and Postgres Row Level Security restricts each event to its owning Auth user. The browser never receives the session tokens.

Progress is an append-only event log. Each answer, completed session, profile update, and one-time legacy import has a stable event ID. The database's `(user_id, event_id)` primary key makes retries safe. Offline events stay in that account's local cache and upload after the next successful login. Server events win when the same event ID is encountered on multiple devices; other events merge and replay in timestamp order.

Existing `english-db` localStorage data is migrated as a versioned snapshot when its learner creates an account. The original data remains cached locally. Confirmed sign-up imports that device's progress; logging into an existing account does not attach another learner's guest data. Account caches use separate per-user localStorage keys.

## Learning logic

The existing adaptive rules and Horizon branding are preserved: EMA mastery (alpha .35), weak/due item prioritization, review intervals up to 45 days, incorrect-answer return after 8 hours, topic diversity limits, and explicit accepted answers for typed questions.

## Tests

Run Node tests with `npm test`. The Supabase RLS integration test is `supabase/tests/progress_rls.test.sql`; run it against a configured local Supabase project with the Supabase CLI test workflow. Node tests do not require Supabase credentials.
