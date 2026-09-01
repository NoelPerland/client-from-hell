# Client From Hell

A visually punchy Next.js game for the Proposales technical interview case. The player survives a chaotic hospitality/event sales process by turning difficult client requests into proposal decisions that balance budget fit, speed, trust, client mood, proposal quality, and scope control.

## Interview Story

I wanted to explore how an interactive proposal workflow could become a game. Instead of building another AI proposal generator, I built a simulation where a difficult client changes constraints and you must adapt the proposal while balancing satisfaction, budget, and value. The final result can be sent through a server-side Proposales adapter as a winning proposal handoff.

## MVP Scope

- Arcade title screen with Easy, Normal, and Hell difficulty modes.
- Four to six Groups, Meetings & Events scenarios depending on difficulty.
- Deterministic scoring and rank system.
- Visible proposal health meters and client reactions.
- Final winning proposal handoff through an API route.
- On-demand AI negotiation debrief generated from the verified completed run.
- Mock Proposales mode when credentials are unavailable.
- Vercel-ready Next.js + TypeScript project.
- Optional player accounts, verified score saving, score history, and a public leaderboard.

## Pixel Art

Character and urban pixel art comes from Kenney's [RPG Urban Pack](https://kenney.nl/assets/rpg-urban-pack). UI textures come from Kenney's [Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack). Both packs are released under Creative Commons Zero (CC0), permitting personal and commercial use without required attribution. Source license text is included at `public/art/kenney/LICENSE.txt`.

Difficulty stays deterministic and demo-safe: Easy runs four rounds, Normal runs five, and Hell runs all six. Every mode uses the same normalized outcome scale: Great `100`, Okay `50`, Bad `0`.

## Audio and Feedback

- Looping CC0 chiptune music starts after the first user interaction, respecting browser autoplay rules.
- CC0 confirmation, error, and selection effects provide immediate game feedback.
- Great choices receive a green check, Okay choices receive an amber dash, and Bad choices receive a red cross. Detailed stat deltas remain independent tradeoffs.
- Music mute, master volume, and dark/light theme controls remain available in the menu and during gameplay.

Audio provenance and licenses are documented in `public/audio/SOURCES.md`.

## Game Feel

- Client emotion states react to each decision and the current mood score.
- Every choice previews its strongest positive and negative deterministic stat change.
- Decisions show a focused Right/Okay/Wrong reaction followed by the score change.
- Stat deltas, meter changes, and rank promotions or drops animate without changing scoring.
- Hell mode derives visual pressure from progress and client mood, escalating from ambient red light to subtle shake and glitch effects.

## Architecture

- `src/components/client-from-hell-game.tsx`: interactive game loop and final proposal handoff.
- `src/lib/game`: scenario data, scoring, validation, ranks, and state transitions.
- `src/lib/proposales`: server-only Proposales adapter with mock and live clients.
- `src/app/api/proposales/final-winning-proposal/route.ts`: validates incoming payloads and keeps secrets server-side.
- `src/server/proposal-guard.ts`: persists one draft per game run and enforces three new drafts per IP per hour across Vercel instances.
- `src/app/api/ai/debrief/route.ts`: validates completed runs, calls open-weight GPT-OSS 20B through Groq's free tier, and validates structured coaching output.
- `src/server/app.ts`: Express 5 API with same-origin checks, security headers, body limits, and centralized errors.
- `src/pages/api/v1/[[...path]].ts`: exposes Express as one Node.js Vercel Function inside the Next deployment.
- `src/server/models`: Mongoose user and immutable score records with leaderboard indexes.
- `src/components/community-hub.tsx`: login, signup, profile CRUD, score history, verified score saving, and leaderboard UI.

The browser never submits a trusted score. It sends the run ID, difficulty, and selected choices; the server validates the full run and recalculates score/rank using the shared deterministic game engine. The run ID is unique per player, making save retries idempotent.

Proposales draft creation uses the same stable game run ID as a MongoDB idempotency key. Completed retries return the original draft, concurrent retries are rejected, and a persistent IP rate bucket prevents public visitors from creating more than three new drafts per hour. Client IPs are SHA-256 hashed before storage.

Accounts use bcrypt password hashes and a short-lived signed JWT in an HTTP-only, SameSite cookie. Protected requests resolve the player from MongoDB, profile changes propagate to existing leaderboard rows, and account deletion removes the player's scores.

## Environment Variables

Mode is explicit. Keep previews/local development on `mock`; use `live` with server-side credentials for production.

```bash
PROPOSALES_MODE=mock
PROPOSALES_API_KEY=
PROPOSALES_API_BASE_URL=https://api.proposales.com/v3
PROPOSALES_COMPANY_ID=
PROPOSALES_LANGUAGE=en
PROPOSALES_TIMEOUT_MS=15000

MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/client-from-hell
AUTH_JWT_SECRET=replace-with-at-least-32-random-characters
ALLOWED_ORIGINS=http://localhost:3000
GROQ_API_KEY=
AI_DEBRIEF_MODEL=openai/gpt-oss-20b
```

Verified Proposales integration:

- Live creation posts to official `POST /v3/proposals` endpoint.
- Auth uses `Authorization: Bearer <PROPOSALES_API_KEY>`.
- Company context comes from official `GET /v3/companies` endpoint.
- Final game result becomes a Proposales draft with game decisions, score metadata, and estimated package value. Recipient is included only when a real email exists.
- API response is validated as `{ proposal: { uuid, url } }`; browser receives no API key.
- Vendor contract source: [Proposales API documentation](https://docs.proposales.com/api-reference/proposals/create).

Live testing found that Proposales currently returns `500` when a recipient object has no email, despite its documented optional fields. The adapter omits fictional recipients without email, avoiding malformed contacts while preserving a valid editable draft.

## Two-Day Build Plan

Day 1:
- Scaffold the app, build the playable loop, and create a strong visual direction.
- Add deterministic scoring and hospitality-specific scenarios.
- Isolate Proposales behind a server-only adapter with mock fallback.

Day 2:
- Connect real Proposales credentials and adjust the payload shape.
- Add optional Vercel AI SDK route for a dynamic post-game debrief.
- Add focused tests for scoring, validation, and payload mapping.
- Deploy to Vercel and rehearse the interview walkthrough.

## AI Usage

This project is intentionally built as an AI-assisted development exercise. Codex supported architecture, UI iteration, implementation, testing, debugging, and deployment. The live application also uses the Vercel AI SDK with Groq's free API tier and open-weight GPT-OSS 20B to generate an optional negotiation debrief from a server-validated completed run. Production-critical scoring remains typed and deterministic.

The debrief uses schema-constrained output with four short fields: verdict, strength, risk, and next move. The browser submits only predefined scenario and choice IDs; the server validates the complete run and builds the prompt from trusted local scenario data. A timeout, small per-instance rate limit, and deterministic fallback keep the feature demo-safe and usable when free quota is unavailable. No paid AI gateway is configured.

Specialized AI review passes covered frontend UX, authentication, database modeling, Express/Vercel packaging, API security, performance, accessibility, and QA. Recommendations were reviewed rather than accepted blindly; for example, Express was retained because it was an explicit implementation goal, but embedded as one Vercel function instead of deployed as a second service.

## Community API

- `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`, `PATCH /api/v1/auth/profile`, `DELETE /api/v1/auth/account`
- `POST /api/v1/scores`, `GET /api/v1/scores/mine`, `DELETE /api/v1/scores/:id`
- `GET /api/v1/scores/leaderboard?difficulty=normal&limit=20`
- `GET /api/v1/health`

Score records are immutable. Deleting a bad run and replaying is clearer than mutating a completed historical result.

## Run Locally

```bash
npm ci
npm test
npm run dev:full
```

Open `http://localhost:3000`.

`dev:full` starts a disposable local MongoDB for accounts and leaderboards. Its data resets when the process stops. Use `npm run dev` when pointing `MONGODB_URI` at a persistent MongoDB instance.

## Vercel Deployment

Use Vercel's default Next.js settings:

- Node.js runtime: `22.x`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave unset
- Use `PROPOSALES_MODE=mock` for Preview deployments.
- Use `PROPOSALES_MODE=live` plus scoped credentials for Production only after validating the integration against a Proposales sandbox.
- Create separate MongoDB Atlas databases and credentials for Preview and Production.
- Put the Vercel function region near Atlas, require TLS, and use a database-scoped `readWrite` user.
- Add a Vercel Firewall rate-limit rule for `/api/v1/auth/*` before sharing publicly.
- Set `ALLOWED_ORIGINS` to the exact deployed origin. Environment changes require redeployment.

Before handoff:

```bash
npm run check
npm test
```

## Tradeoffs

- JWT logout clears the browser cookie; a database session table would add immediate token revocation across devices.
- The public leaderboard keeps each player's best score per difficulty to prevent spam dominance.
- Live Proposales request fields remain isolated assumptions until checked against the real account/API documentation.
- AI coaching is optional and never controls scoring. Deterministic scoring and fallback keep the interview demo stable.
