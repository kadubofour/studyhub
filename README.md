# Studyhub

A study hub for students: planner and timetable, notes with math, flashcards with spaced repetition, lecture recording with transcripts, Scan and Upload, an AI tutor that works from your own material, study plans, topics, games and progress. Next.js 16, React 19, Supabase, Vercel.

> This Next.js has breaking changes from older versions. Read the guides in `node_modules/next/dist/docs/` before changing routes or pages.

## Run it
```bash
npm install
npx supabase start            # local database (needs Docker); prints the keys for .env.local
cp .env.example .env.local    # fill in what `supabase status` prints
npx supabase migration up
npm run dev
```

## Check it
| Command | What it does |
|---|---|
| `npm test` | Unit tests |
| `npm run test:db` | Database tests (needs the local database) |
| `npm run e2e` | Browser tests on desktop and phone sizes, with stand-ins for OpenAI, YouTube and Paystack |
| `npm run lint` | Lint |
| `npm run check:env` | Lists which settings are set and what each missing one turns off (add `--dev` for local work) |

## Launch
Follow [`docs/launch-checklist.md`](docs/launch-checklist.md). Design notes and plans for each feature are in `docs/superpowers/`.
