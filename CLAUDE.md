# Daydream — Project Guide

Daydream is a single-page productivity app; all of its features live on the main page.

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
    theme.css              — Design tokens (CSS custom properties)
    globals.css            — Global resets & base styles (imports theme.css)
    page.module.css        — Home page component styles
```

## Database

- Uses **Prisma 7**. The datasource URL is NOT in `schema.prisma` — it's in `prisma.config.ts` (for CLI) and `src/lib/prisma.ts` (for runtime via `@prisma/adapter-pg`).
- After changing the schema, run `yarn db:migrate` to create a migration.
- The Prisma client is re-generated on `yarn build` and `yarn install` (postinstall hook).

## Styling

- **CSS modules**: Every component gets its own `*.module.css` file — never use inline styles or global class selectors for component styling.
- **Design tokens**: All colors, fonts, spacing, radii, shadows, and transitions come from the CSS custom properties in `src/app/theme.css`. Never hard-code raw color/spacing values in component styles; always reference a `var(--…)` token.
- **Global styles**: Only resets and base element styles belong in `src/app/globals.css`.
- **Adding tokens**: If you need a value that doesn't exist yet (e.g., a new semantic color), add it to `theme.css` first, then use it.

## Data persistence

The user accesses this app from multiple devices. **Do not use `localStorage`** for persisting user data — always use the database via API routes. If you believe `localStorage` is the right choice for something (e.g., ephemeral UI state), check with the user first.

## Environment variables

Required in `.env.local` for local dev:

- `POSTGRES_PRISMA_URL` — PostgreSQL connection string
- `AUTH_SECRET` — auth token signing secret
- `AUTH_RESEND_KEY` — Resend API key
