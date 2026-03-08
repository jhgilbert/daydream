# Daydream

A Next.js app with magic link email authentication, deployed on Vercel.

## Local development

### Prerequisites

- Node.js 18+
- Yarn
- A PostgreSQL database (or use Vercel Postgres)
- A [Resend](https://resend.com) account (free tier)

### Setup

1. Clone the repo and install dependencies:

   ```sh
   git clone <repo-url>
   cd daydream
   yarn
   ```

2. Create a `.env.local` file:

   ```
   POSTGRES_PRISMA_URL="postgresql://user:password@host:5432/dbname"
   AUTH_SECRET="generate-with-npx-auth-secret"
   AUTH_RESEND_KEY="re_your_resend_api_key"
   ```

   Generate `AUTH_SECRET` by running `npx auth secret`.

3. Run database migrations:

   ```sh
   yarn db:migrate
   ```

4. Start the dev server:

   ```sh
   yarn dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Useful commands

| Command | Description |
|---|---|
| `yarn dev` | Start development server |
| `yarn build` | Production build |
| `yarn db:migrate` | Run Prisma migrations |
| `yarn db:studio` | Open Prisma Studio (DB GUI) |

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. In the Vercel dashboard, create a **Postgres** database (Storage tab) and link it to the project. This auto-injects `POSTGRES_PRISMA_URL`.
4. Add these environment variables in the Vercel project settings:
   - `AUTH_SECRET` — generate with `npx auth secret`
   - `AUTH_RESEND_KEY` — from the [Resend dashboard](https://resend.com/api-keys)
5. Deploy. Vercel auto-detects Next.js.
6. After the first deploy, run migrations against the production database:

   ```sh
   npx prisma migrate deploy
   ```

   Or add `prisma migrate deploy` to your build command in Vercel settings:
   `prisma migrate deploy && next build`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PRISMA_URL` | Yes | PostgreSQL connection string (auto-injected by Vercel Postgres) |
| `AUTH_SECRET` | Yes | Secret for signing auth tokens |
| `AUTH_RESEND_KEY` | Yes | Resend API key for sending magic link emails |
| `AUTH_RESEND_FROM` | No | Sender email address (defaults to `onboarding@resend.dev`) |
