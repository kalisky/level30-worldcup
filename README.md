# World Cup Bets

A friend-group betting app for the 2026 FIFA World Cup. Private rooms, virtual chips, no real money.

## What it does

- **Score-prediction bets** on every group stage match. Each prediction creates two implicit bets — direction (HOME/DRAW/AWAY) and exact score — with the stake split 50/50. Match winner and total-goals odds are synced from Polymarket, then exact-score odds are derived locally via a Poisson model.
- **Custom bets** proposed live during games. Any friend writes a betting line ("Will France score in the first half?"), Gemini generates odds, others wager on sides.
- **Automatic match settlement** — the server looks up official final scores (Gemini + Google Search) once a match should have finished and pays out every room's bets. Nobody settles matches by hand. Custom bets stay trust-based: any room member marks the winner (with AI suggestions).
- **Leaderboard** in chips. Whoever has the most chips at tournament end wins bragging rights.

## Prereqs

- Node 20.9 or newer
- A free **Neon** Postgres database — sign up at [neon.tech](https://neon.tech)
- A **Google Gemini** API key — get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (used for custom bets + AI settlement suggestions)
- A **Firebase** project with **Google sign-in** enabled
- A Firebase Admin service account key for server-side token verification

## Local setup

```bash
git clone <this repo>
cd world-cup
npm install

# Copy env template and fill in your secrets:
cp .env.example .env.local
#   DATABASE_URL=postgresql://...   (from Neon)
#   GEMINI_API_KEY=...              (for custom bets + AI suggestions)
#   ODDS_SYNC_SHARED_SECRET=...     (for POST /api/internal/odds/sync)
#   ODDS_SYNC_MIN_INTERVAL_HOURS=4
#   NEXT_PUBLIC_FIREBASE_...        (from Firebase web app settings)
#   FIREBASE_PROJECT_ID=...
#   FIREBASE_CLIENT_EMAIL=...
#   FIREBASE_PRIVATE_KEY=...

# Push the schema to your Neon database (first time only):
npm run db:push

# Seed the 72 group-stage fixtures with placeholder team names:
npm run seed

# Sync direction + exact-score odds for every future scheduled match:
npm run odds:generate

# Start the dev server:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, create a room, and share the room code or invite URL.

## Tournament-day workflow

1. **Before group stage starts**: room creator makes a room, shares the invite link or room code, and everyone joins with Google sign-in.
2. **Before group stage starts**: any room member goes to `/r/<code>/admin` and renames the placeholder team names to the actual qualified teams. Saving names clears the odds source metadata for that match; click "Sync odds" to refresh them from Polymarket and regenerate the Poisson exact-score grid.
3. **Before each kickoff**: friends visit the match page and place their score prediction (locks at kickoff).
4. **During the match**: anyone can propose a custom bet from the match page. Claude scores it and others can wager until the lock time.
5. **At the final whistle**: nothing to do — the server auto-settles. About 105 minutes after kickoff it starts checking for the official result (AI + web search, re-checked every ~10 minutes until confirmed) and pays out all bets in every room. The check runs piggybacked on live-poll traffic plus a daily Vercel Cron backstop (`/api/internal/settle/sync`).
6. **Custom bets**: anyone goes to `/r/<code>/admin` → "Suggest with AI" for any open custom bet, confirm, "Mark winner".

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it on Vercel.
3. Add the env vars from `.env.example` in Project Settings.
4. Deploy. That's it — no other config.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build (compile + typecheck) |
| `npm run db:push` | Sync the Drizzle schema to your DB (no migration files needed) |
| `npm run db:generate` | Generate a new SQL migration file from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle's web UI for browsing the DB |
| `npm run seed` | Insert 72 group-stage fixtures (idempotent) |
| `npm run odds:generate` | Force-sync match odds from Polymarket and regenerate Poisson exact-score odds |
| `npm test` | Run the odds-sync unit tests |

## Architecture

- **Next.js 16** App Router with TypeScript and Tailwind v4
- **Postgres** via [Drizzle ORM](https://orm.drizzle.team)
- **Polymarket** World Cup match winner and total-goals markets as the source for match odds
- **Poisson fitting** to derive exact-score odds from those Polymarket market inputs
- **Gemini** (`gemini-2.5-flash`) via `@google/genai` for custom-bet odds + AI-suggested settlements (with Google Search grounding)
- **Firebase Auth** with Google login on the client, plus an app-managed server session cookie
- **Room memberships** stored in Postgres so invite links and room codes are enough to join
- **Real-time** — clients poll for fresh server-rendered data every 5 seconds

Key folders:

```
app/             — Next.js routes
  r/[code]/      — Authenticated room pages (dashboard, match, admin)
  room/new/      — Create-room form
components/      — UI components (BetForm, Leaderboard, CustomBetCard, ...)
lib/
  db/            — Drizzle schema, queries, connection
  ai/odds.ts     — Gemini calls for custom-bet odds
  ai/suggest.ts  — Gemini + Google Search grounding for settlement suggestions
  odds-sync/     — Poisson fitting, sync service, and tests
  polymarket/    — Polymarket World Cup market parsing helpers
  actions/       — Server actions (createRoom, placeMatchBet, settleMatch, ...)
  fixtures.ts    — WC2026 group structure + match schedule constants
scripts/         — One-off scripts (seed-fixtures, generate-odds)
```

## Out of scope (v1)

- Live score auto-tracking minute-by-minute (admin enters final score; AI can suggest it)
- Knockout bracket auto-seeding (admin adds R16+ matches manually after groups conclude)
- Push notifications / native mobile app
- Real money / payments
- More than one tournament

## License

Personal use only. No license granted.
