# Deploying to Vercel — exact steps, zero code edits

Everything is pre-configured: the Postgres database schema, automatic table
creation during deploy, and automatic department seeding on first login.
You never edit a config file. Total time: ~20 minutes, one time only.

What happens automatically on Vercel (you do nothing):
- Build detects the Neon Postgres URL and switches the database schema itself
  (`scripts/vercel-build.sh` — no manual `.prisma` edit, ever).
- All tables are created in Neon on the first deploy (and patched
  automatically on later deploys).
- On your first visit, the app seeds your 9 departments + sub-departments
  (no logs, no rivals — genuinely empty and yours).

---

## Step 0 — Get the code onto your computer

Pick whichever is easiest:

- **File tree:** in the workspace file panel, select `time-tracker-deploy.zip`
  (or `time-tracker-deploy.tar`) and hit the **Download** button.
- **Download button (top right of the workspace):** exports the whole current
  project as a tar — equally fine, it contains the same deploy-ready files.
- If what you downloaded is the zip: extract it (right-click → Extract All on
  Windows). You get a `time-tracker` folder — go to Step 1.
- If you got the full-project tar: extract it, then delete the `node_modules`
  and `.next` folders if present (too big to upload), and delete `.env` if it
  exists. The rest is exactly what you need — go to Step 1.

Mac only: press **Cmd + Shift + .** in the folder so hidden files
(`.gitignore`, `.env.example`) become visible for the upload later.

## Step 1 — Put the code on GitHub (browser only, no installs)

1. Go to **github.com** → sign up / log in.
2. Click **+** (top right) → **New repository** → name it `time-tracker` →
   select **Private** → **Create repository**.
3. On the new empty repo page, click the link **"uploading an existing file"**.
4. Open your extracted `time-tracker` folder, select **everything inside it**
   and drag it into the browser upload area.
   - GitHub accepts ~100 files per drag — the project is 158, so drag in two
     batches: first the **`src`** folder → **Commit changes** → then drag all
     the remaining files/folders → **Commit changes** again.
5. Done. No terminal needed.

Have git installed and prefer it? Equivalent:
`git init && git add -A && git commit -m "deploy" && git remote add origin <repo url> && git push -u origin main`

## Step 2 — Create the free database (Neon)

1. Go to **neon.tech** → sign in with GitHub → **Create project**
   (region closest to you, PostgreSQL 16+).
2. Neon shows a **Connection string** — copy it. It looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
   (use the **pooled** string).

## Step 3 — Deploy on Vercel

1. Go to **vercel.com** → sign up **with GitHub**.
2. **Add New… → Project** → **Import** your `time-tracker` repo
   (Framework preset auto-detects Next.js — leave build settings untouched).
3. Open **Environment Variables** and add exactly three:

   | Variable       | Value                                          |
   |----------------|------------------------------------------------|
   | `DATABASE_URL` | your Neon connection string (Step 2)           |
   | `APP_PASSWORD` | the login password (`password` — change freely)|
   | `AUTH_SECRET`  | any long random string (32+ chars)             |

   Generate a good `AUTH_SECRET`:
   - Mac/Linux terminal: `head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'`
   - Or any password manager's "generate password" set to 40+ characters.
4. Click **Deploy**. First build takes ~2–3 minutes — during it the app
   creates every table in Neon automatically.

## Step 4 — Log in and use it anywhere

1. Open `https://your-project.vercel.app` → enter `APP_PASSWORD`.
2. Your 9 departments appear instantly (tables were created at deploy);
   logs start empty — it's genuinely yours from day one.
3. Works from any browser on earth: phone, tablet, laptop. One login per
   device (session lasts 30 days).
4. Optional: Vercel → **Settings → Domains** to attach a custom domain.

## Your data & backups

- All data lives in **Neon** — every device sees the same live data, and
  Neon runs automatic backups (restore window depends on plan; free works).
- Belt-and-suspenders: **Settings → Export** in the app gives a full JSON
  snapshot anytime — save one weekly to your cloud drive.
- If you ever change the schema: export first; the next deploy auto-patches
  the tables.

## Everyday flow after deploy

Edit locally (or ask z.ai to edit) → push to GitHub → Vercel redeploys
automatically in ~1 minute. Env changes (like a new password) need a
**Redeploy** from Vercel → Deployments.

---

## Alternative A — no GitHub: Vercel CLI from your computer

Requires Node.js installed (nodejs.org), then from the project folder:

```bash
npm install -g vercel
vercel login                      # opens browser, confirm the code
vercel                            # accept the defaults
vercel env add DATABASE_URL       # paste Neon string when asked
vercel env add APP_PASSWORD       # paste your password
vercel env add AUTH_SECRET        # paste the random string
vercel --prod
```

## Alternative B — Turso (libSQL) instead of Neon

Possible, but more manual: Turso URLs don't start with `postgres`, so you'd
have to point the Postgres case in `scripts/vercel-build.sh` at a libsql
schema and set `provider = "libsql"` + a `DATABASE_AUTH_TOKEN` env var.
Unless you specifically want libSQL, stay on Neon — it's free and already
wired up end-to-end.

## Troubleshooting

- **Build fails with "Can't reach database server"** → `DATABASE_URL` is
  mistyped; it must be the full pooled `postgresql://…neon.tech/…` string.
- **"Wrong password" but you're sure** → the `APP_PASSWORD` value in
  Vercel → Settings → Environment Variables is what counts; edit it there
  and **Redeploy**.
- **Logged out unexpectedly** → sessions last 30 days; changing `AUTH_SECRET`
  invalidates every session on every device.
- **Forgot which files changed after asking z.ai for edits** → just
  re-download the zip and repeat Step 1 (drag everything, commit) — Vercel
  rebuilds whatever changed.
