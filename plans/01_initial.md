# Daydream — Initial Setup Plan

## Goal

A Next.js TypeScript app deployed on Vercel (hobby plan). Starting with magic link email sign-in, a success page, and a logout button — but the app is expected to grow significantly over time, so architectural choices should support that.

## Tech choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | Requested; first-class Vercel support |
| Auth | NextAuth.js v5 (Auth.js) | Built-in Email (magic link) provider, minimal config |
| Email delivery | Resend | Free tier (100 emails/day), simple API, works well with Auth.js |
| Database (session/token storage) | Vercel Postgres (Neon) | Free on hobby plan, zero-config on Vercel, needed by Auth.js for verification tokens |
| ORM / adapter | Prisma + `@auth/prisma-adapter` | Mature migration system, Prisma Studio for inspecting data, scales well to many tables |
| Package manager | Yarn | User preference |

### Why these and not alternatives?

- **Resend over SendGrid/Mailgun**: Resend has the simplest setup (one API key, no domain verification required for testing with your own email) and a generous free tier.
- **Vercel Postgres over PlanetScale/Supabase**: It's built into the Vercel dashboard, so there's nothing extra to sign up for on the hobby plan.
- **Prisma over Drizzle**: Prisma has a proper migration workflow (`prisma migrate dev` / `prisma migrate deploy`) that tracks migration history — essential when the schema grows to many tables. Prisma Studio gives you a GUI to inspect data. The trade-off is slightly larger bundle / slower cold starts, but that matters less as the app grows.

## Steps

### 1. Scaffold the Next.js project

- Initialize git repo (`git init`) and create `.gitignore` covering:
  - `node_modules/`
  - `.next/`
  - `.env*.local`
  - `.env` (Prisma creates this; secrets should not be committed)
  - `.vercel/`
- Re-initialize with `create-next-app` (TypeScript, App Router, `src/` directory, no Tailwind — keep styles minimal). Use `--use-yarn` flag. Note: `create-next-app` generates its own `.gitignore` — merge with ours if needed.
- Resulting structure:

```
src/
  app/
    layout.tsx
    page.tsx
    globals.css
```

### 2. Install dependencies

```
yarn add next-auth@beta @auth/prisma-adapter @prisma/client resend
yarn add -D prisma
```

### 3. Set up the database schema

- Run `npx prisma init` to create `prisma/schema.prisma` and `.env`.
- Define the Auth.js models (User, Account, Session, VerificationToken) in the Prisma schema.
- Point the datasource at `POSTGRES_PRISMA_URL` (provided by Vercel Postgres).
- Run `npx prisma migrate dev` to create the initial migration and generate the client.
- Add scripts to `package.json`: `"db:migrate": "prisma migrate dev"`, `"db:studio": "prisma studio"`, `"postinstall": "prisma generate"`.

### 4. Configure Auth.js

- Create `src/auth.ts` — configure the Email provider (Resend) and the Prisma adapter.
- Create `src/app/api/auth/[...nextauth]/route.ts` — the catch-all API route.
- Environment variables needed:

| Variable | Source |
|---|---|
| `AUTH_SECRET` | `npx auth secret` (auto-generated) |
| `AUTH_RESEND_KEY` | Resend dashboard |
| `POSTGRES_URL` | Vercel dashboard (auto-injected when you link the DB) |

### 5. Build the UI (3 files, minimal CSS)

#### `src/app/page.tsx` (home / sign-in)

- If not signed in: show an email input + "Send magic link" button (uses Auth.js `signIn("resend")`).
- If signed in: show "You're signed in as {email}" + a logout button (`signOut()`).

#### `src/app/globals.css`

- Near-empty — just a reset or nothing at all. The app can be ugly.

#### `src/app/layout.tsx`

- Wrap children in the Auth.js `SessionProvider`.

That's it for UI. No separate success page is needed — Auth.js redirects back to `/` after verification, where the signed-in state is shown. One page, two states.

### 6. Create project documentation

#### `README.md`

- Brief project description.
- **Local development** section: how to clone, install (`yarn`), set up `.env.local`, run migrations (`yarn db:migrate`), and start the dev server (`yarn dev`).
- **Deployment** section: step-by-step instructions for deploying to Vercel (create Vercel Postgres, set env vars, connect repo, deploy). Include the `prisma migrate deploy` step.
- **Environment variables** reference table.

#### `CLAUDE.md`

- Project conventions: yarn as package manager, Next.js App Router with `src/` directory, TypeScript.
- Key commands: `yarn dev`, `yarn build`, `yarn db:migrate`, `yarn db:studio`.
- Auth setup: Auth.js v5 with Resend email provider, Prisma adapter.
- Database: Vercel Postgres via Prisma. Schema lives in `prisma/schema.prisma`.
- File structure overview.

### 7. Deploy to Vercel

1. Push repo to GitHub.
2. Import project in the Vercel dashboard.
3. Create a Vercel Postgres database in the dashboard and link it to the project (this injects `POSTGRES_URL`).
4. Add `AUTH_SECRET` and `AUTH_RESEND_KEY` as environment variables in the Vercel project settings.
5. Run `npx prisma migrate deploy` against the production DB (or add it as a build step).
6. Deploy. Vercel auto-detects Next.js — no special config needed.

### 8. Verify

- Visit the deployed URL.
- Enter your email, receive the magic link, click it, confirm the signed-in state, click logout.

## File inventory (final)

```
prisma/
  schema.prisma        — Prisma schema (Auth.js models + future models)
  migrations/          — Migration history (committed to git)
src/
  lib/
    prisma.ts          — Prisma client singleton
  app/
    api/auth/[...nextauth]/
      route.ts         — Auth.js API route
    layout.tsx         — Root layout + SessionProvider
    page.tsx           — Sign-in form / signed-in view / logout button
    globals.css        — Minimal or empty
  auth.ts              — Auth.js config (Email provider, Prisma adapter)
.env.local             — Local env vars (not committed)
.gitignore             — Ignores node_modules, .next, .env*, .vercel, etc.
README.md              — Setup, local dev, and deployment instructions
CLAUDE.md              — Project conventions and key commands for Claude
```

## Open questions / decisions for you

1. **Do you already have a Resend account?** If not, sign up at resend.com — free tier is fine.
2. **Custom domain?** Not needed for hobby plan — Vercel gives you a `.vercel.app` subdomain automatically.
