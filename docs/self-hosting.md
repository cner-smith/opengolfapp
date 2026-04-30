# Self-hosting OGA

This guide takes you from a fresh fork to a deployed web app with your own data.

Estimated time: 30–45 minutes the first time.

## What you'll need

- A [GitHub](https://github.com) account (for the fork).
- A [Supabase](https://supabase.com) account — the free tier is plenty.
- A [Vercel](https://vercel.com) account — also free tier.
- A [Mapbox](https://mapbox.com) account if you want the live round map (web is fine without it; mobile needs it).
- Node 20+ and `pnpm` 10+ locally.

## 1. Fork the repo

Go to [github.com/cner-smith/opengolfapp](https://github.com/cner-smith/opengolfapp) and click **Fork**. Clone your fork locally:

```bash
git clone https://github.com/<your-handle>/opengolfapp.git
cd opengolfapp
pnpm install
```

## 2. Create your Supabase project

In the [Supabase dashboard](https://supabase.com/dashboard) → **New project**. Name it whatever you want. Pick a region close to you. Save the database password somewhere safe.

Once it's provisioned, grab two values from **Project Settings → API**:

- `Project URL` → this is your `SUPABASE_URL`.
- `anon public` key → this is your `SUPABASE_ANON_KEY`.

You'll also need the **service_role** key for the seed script. Treat it like a database password — never commit it, never put it in client-side env vars.

## 3. Run the migrations

The schema lives in `supabase/migrations/0001_initial_schema.sql`. Either:

**Option A — Supabase CLI (recommended):**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B — SQL editor:**

Open `supabase/migrations/0001_initial_schema.sql`, paste the whole file into the Supabase SQL editor, run it.

Then load the seed data (3 demo courses + 24 drills):

```bash
psql "<your-supabase-connection-string>" < supabase/seed.sql
```

…or paste `supabase/seed.sql` into the SQL editor and run.

## 4. (Optional) Load demo data

If you want a populated dashboard before adding real rounds:

```bash
export SUPABASE_URL=https://<your-project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
pnpm seed:demo
```

Sign in to your deployed app as `demo@oga.app` / `ogademo123`.

## 5. Deploy the web app

The repo has a `vercel.json` configured for the monorepo, so the easiest path is the README's deploy button or:

```bash
npm i -g vercel
vercel deploy
```

Vercel will detect the config and run `pnpm install` + `pnpm --filter web build`.

Set these environment variables in **Vercel → Project → Settings → Environment Variables**:

| Name                     | Value                                             |
| ------------------------ | ------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Your Supabase project URL                         |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key                            |
| `VITE_MAPBOX_TOKEN`      | Mapbox public token (optional, web-side cosmetic) |

Redeploy after setting them so the new env values are baked into the bundle.

## 6. Mapbox token (for the live round map)

Free tier covers up to 50,000 map loads per month, which is plenty for personal use.

Go to [Mapbox account → Tokens](https://account.mapbox.com/access-tokens/), copy your default public token (`pk.eyJ...`), and paste it as the `VITE_MAPBOX_TOKEN` (web) and `EXPO_PUBLIC_MAPBOX_TOKEN` (mobile) env vars.

## 7. (Optional) Mobile build with EAS

Mobile uses Expo's CNG flow (no committed `android/` directory; EAS regenerates each build).

```bash
cd apps/mobile
npm install --legacy-peer-deps
npx eas-cli login
npx eas-cli build --platform android --profile development
```

You'll need an [Expo account](https://expo.dev) — also free for development builds. Set the EAS-side env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_TOKEN`) in the Expo dashboard so the build pulls them in.

## Troubleshooting

**"profile is null after onboarding"** — check that the `handle_new_user` trigger from the migration ran. Without it the profile row never gets created on signup.

**"unauthorized" on every query** — the Supabase client isn't attaching the auth token. Make sure you set `VITE_SUPABASE_ANON_KEY` (web) or `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile), not the service role key.

**Mobile EAS build fails on `gradle-plugin`** — see [DECISIONS.md](../DECISIONS.md) for the npm-vs-pnpm story; the short version is `apps/mobile` uses npm separately from the pnpm workspace.

## Pulling updates from upstream

When the upstream repo ships a new release, pull and rebuild:

```bash
git remote add upstream https://github.com/cner-smith/opengolfapp.git
git fetch upstream
git merge upstream/main
pnpm install
# If the migration count changed, run:
npx supabase db push
```

Vercel redeploys automatically when you push to your fork.
