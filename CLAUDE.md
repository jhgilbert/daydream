# Daydream — Project Guide

## Package manager

Use **yarn** for all commands. Do not use npm.

## Tech stack

- **Framework**: Next.js (App Router) with TypeScript
- **Directory structure**: `src/` directory convention
- **Auth**: Auth.js v5 (next-auth@beta) with Resend email provider (magic link)
- **Database**: PostgreSQL (Vercel Postgres / Neon) via Prisma ORM
- **Deployment**: Vercel (hobby plan)

## Key commands

- `yarn dev` — start dev server
- `yarn build` — production build (runs prisma generate first)
- `yarn db:migrate` — run Prisma migrations (`prisma migrate dev`)
- `yarn db:studio` — open Prisma Studio GUI

## Project structure

```
prisma.config.ts           — Prisma CLI config (migration URL)
prisma/schema.prisma       — Database schema (all models defined here)
src/
  auth.ts                  — Auth.js configuration
  lib/prisma.ts            — Prisma client singleton (uses @prisma/adapter-pg)
  app/
    api/auth/[...nextauth]/route.ts — Auth API route
    layout.tsx             — Root layout
    page.tsx               — Home page (sign-in / signed-in view)
    globals.css            — Global styles
```

## Database

- Uses **Prisma 7**. The datasource URL is NOT in `schema.prisma` — it's in `prisma.config.ts` (for CLI) and `src/lib/prisma.ts` (for runtime via `@prisma/adapter-pg`).
- After changing the schema, run `yarn db:migrate` to create a migration.
- The Prisma client is re-generated on `yarn build` and `yarn install` (postinstall hook).

## Environment variables

Required in `.env.local` for local dev:
- `POSTGRES_PRISMA_URL` — PostgreSQL connection string
- `AUTH_SECRET` — auth token signing secret
- `AUTH_RESEND_KEY` — Resend API key
