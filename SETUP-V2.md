# V2 setup (do these in order, ~15 minutes)

## 1. Database  (Supabase → SQL Editor)
Paste the whole of `supabase/migrations/v2_migration.sql` and run it. It is safe to re-run.
It adds: invite-code joining rules, edit/delete permissions, replies tables, custom questions, video columns.

> It replaces the `join_relationship` function and **replaces all RLS policies on `daily_questions`** (needed so one couple's custom questions can't leak to other couples). Everything else is additive.

## 2. Cloudflare R2 bucket
1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket** → name it `our-little-world-media`.
   (Cloudflare asks for a payment method to enable R2, but the free tier of 10 GB is not charged.)
2. Leave the bucket **private**. The app never exposes it publicly; files are served through signed links.

## 3. Wire the app to it
1. Open `wrangler.toml` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` (same two values as in `.env.local`; the anon key is public by design).
2. Create a signing secret: run `openssl rand -base64 32`, then add it in
   **Cloudflare → Workers & Pages → your project → Settings → Variables and Secrets → Add → type "Secret"**,
   name `MEDIA_SIGNING_SECRET`.
3. Run `npm install`, commit and push. Cloudflare Pages auto-detects the `functions/` folder and the R2 binding in `wrangler.toml`.
   If the dashboard shows the R2 binding as missing, add it under Settings → Bindings → R2 bucket, variable name `MEDIA`.

## 4. Test locally (optional)
```
cp .dev.vars.example .dev.vars
npm run dev:full        # open http://localhost:8788  (NOT 5173; 8788 includes the /api functions)
```
Uploads in local mode go to a local simulated R2 bucket, not your real one.

## 5. Old photos
Photos uploaded in V1 still display (they're read from Supabase Storage as a fallback). New uploads go to R2.
When you're happy, you can empty the old `relationship_media` bucket, or ask me for a copy script to move the old ones to R2.
