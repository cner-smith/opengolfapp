# Vercel preview environment setup

## Create a dev Supabase project
1. Go to supabase.com → New project → name it "oga-dev"
2. Run migrations: supabase db push (linked to dev project)
3. Run seed: paste supabase/seed.sql in SQL editor
4. Note the dev project URL and anon key

## Configure Vercel preview environment
1. Go to vercel.com → opengolfapp project → Settings →
   Environment Variables
2. Add the following for "Preview" environment only
   (not Production):
   VITE_SUPABASE_URL = your oga-dev project URL
   VITE_SUPABASE_ANON_KEY = your oga-dev anon key
   VITE_MAPBOX_TOKEN = same mapbox token is fine
3. Vercel automatically creates a preview URL for every
   PR — it will use these preview env vars

## How it works after setup
- Every PR to dev gets a unique preview URL
  (e.g. opengolfapp-git-feature-xyz-cner-smiths-projects.vercel.app)
- Preview deployments use the oga-dev Supabase project
- Production deployments (main) use the real Supabase project
- You can share preview URLs to get feedback before merging
