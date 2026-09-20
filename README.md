# Engels-app — V1.2.1

Adaptive English practice for Dutch beginners.

## Run locally

```bash
npm start
```

Open `http://localhost:3000`.

## Deploy to Vercel

This project is Vercel-ready: the frontend is static and `/api/health.js` is a serverless health endpoint. No build step or npm dependencies are required. Import the GitHub repository into Vercel and deploy with the project root set to the repository root.

## Learning logic

- EMA mastery (alpha .35)
- Weak/due items are prioritized
- Correct answers expand review intervals up to 45 days
- Incorrect answers return after 8 hours
- Topic diversity is limited during mixed sessions
- Typed questions accept explicit `accepted` answers
- Open questions are written so the intended answer is unambiguous; the app does not mark semantically different but grammatical answers as wrong unless the question gives enough context to distinguish them.

Progress is currently stored in browser localStorage. Server-side persistence can be added later with a hosted datastore such as Upstash.