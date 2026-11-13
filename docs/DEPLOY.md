# Deploying fineprint.tedxscu.com

The site is a Next.js app hosted on **Vercel**, built from the GitHub repo **`1Dabbid/TEDxSantaClaraUniversity27`**. Every push to the production branch (including every **Save** in the online admin) rebuilds and publishes the site automatically.

Steps marked **(verify on first deploy)** depend on Vercel, GitHub or DNS-provider screens that change over time; the names may differ slightly.

## 0. Before you start: name the production branch `main`

The repo's default branch is currently `claude/keen-tesla-m8scyh`. Vercel uses the default branch as production, and the online admin (Keystatic) saves to the default branch too, so make it a plain `main` first:

1. GitHub > the repo > **Settings > General > Default branch** > the pencil/rename button > rename to `main` **(verify on first deploy)**. Renaming keeps all history and redirects old links.
2. Everyone with a local copy then runs `git fetch origin && git branch -m claude/keen-tesla-m8scyh main && git branch -u origin/main main` (or simply clones again).

## a. Import the repo into Vercel

1. Sign in at **vercel.com** with the GitHub account that owns or can access the repo.
2. **Add New… > Project > Import Git Repository**. If the repo is not listed, click **Adjust GitHub App Permissions** and give Vercel access to `TEDxSantaClaraUniversity27`.
3. Settings on the import screen:
   - **Framework Preset**: Next.js (detected automatically).
   - **Root Directory**: `./` (leave as is). Build command, output directory and install command: leave the defaults (`npm ci` runs because `package-lock.json` exists; the build is `next build`).
   - **Environment Variables**: none are needed for the public site. (The Keystatic ones come in step d.)
4. Click **Deploy**. The first build takes one to two minutes and gives you a `*.vercel.app` URL.
5. **Node.js version**: Project > **Settings > Build and Deployment > Node.js Version** > **22.x** (the repo's `.nvmrc` says 22; `package.json` asks for `>=22`) **(verify on first deploy)**.
6. **Production branch**: Project > **Settings > Git > Production Branch** should say `main`. Any other branch or pull request gets its own preview URL and never touches the live site.

## b. Add the domain `fineprint.tedxscu.com`

1. Project > **Settings > Domains > Add Domain** > `fineprint.tedxscu.com` > assign it to Production.
2. Vercel shows the DNS record to create, normally a **CNAME** for `fineprint` pointing to `cname.vercel-dns.com` (newer projects may show a project-specific target such as `xxxx.vercel-dns-0xx.com`; **use exactly what Vercel displays**) **(verify on first deploy)**.
3. At whoever hosts DNS for **tedxscu.com** (the club site's registrar or website builder: ask the previous webmaster if unsure), add:

   | Type | Name / Host | Value / Target | TTL |
   | --- | --- | --- | --- |
   | CNAME | `fineprint` | the target Vercel showed (e.g. `cname.vercel-dns.com`) | default / automatic |

   Do not touch the existing records for `tedxscu.com` or `www`: the club site keeps working.
4. Back in Vercel the domain turns **Valid Configuration** within minutes (DNS can take up to a few hours). Vercel issues the HTTPS certificate automatically.

## c. The canonical URL

There is **no environment variable** for it: the code does not read `NEXT_PUBLIC_SITE_URL` or similar. The canonical address is the constant `SITE_URL = 'https://fineprint.tedxscu.com'` in `src/lib/site.ts`, used for canonical links, Open Graph and share previews (`metadataBase`), `robots.txt`, `sitemap.xml` and the structured data. If the domain ever changes, edit that one line (and update the Keystatic GitHub App's callback URL, step d.8).

### Search engines and preview URLs

Only the production deployment may be indexed. The rule (`isIndexable()` in `src/lib/site.ts`, read at build time): when Vercel's `VERCEL_ENV` is set to anything other than `production` (preview and development deployments), `robots.txt` disallows everything and every page carries `<meta name="robots" content="noindex, nofollow">`. Production deployments, and builds outside Vercel (no `VERCEL_ENV`, e.g. `npm run build && npm run start` locally or in CI), are indexable. Nothing needs to be set: Vercel provides `VERCEL_ENV` itself. If the site is ever hosted somewhere other than Vercel, set `VERCEL_ENV=preview` on that host's non-production builds.

The production deployment is also reachable at its `*.vercel.app` address, which would duplicate the site. Redirect it: Project > **Settings > Domains** > the `*.vercel.app` domain > **Edit** > **Redirect to** `fineprint.tedxscu.com` (308, permanent) **(verify on first deploy)**. The canonical links already point at the custom domain, so this only keeps the duplicate out of sight.

## d. Turn on the online admin (Keystatic GitHub mode)

Without this, `/keystatic` only works on someone's computer with `npm run dev`. With it, editors sign in with GitHub on the live site and every save is a commit.

How the code decides: `keystatic.config.ts` switches storage from local files to GitHub (`1Dabbid/TEDxSantaClaraUniversity27`) when `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` is set. The other three variables are read by Keystatic's API route.

| Variable | What it is |
| --- | --- |
| `KEYSTATIC_GITHUB_CLIENT_ID` | the GitHub App's client ID |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | the GitHub App's client secret (secret!) |
| `KEYSTATIC_SECRET` | a random string of at least 32 characters, encrypts the sign-in cookie (secret!) |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | the GitHub App's URL name (from `github.com/apps/<slug>`) |

The GitHub App is created once, by the **repo owner (`1Dabbid`)**, through Keystatic's setup flow on a local computer. The flow only works in development mode (`npm run dev`); a production build refuses to start the API without the variables.

1. Clone the repo, run `npm ci`.
2. Create a file named `.env` in the project folder containing one line: `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending`. (A placeholder: it only switches the admin into GitHub mode so the setup page appears.)
3. Run `npm run dev` and open **http://localhost:3000/keystatic/setup**. You should see **Keystatic Setup** ("Keystatic doesn't have the required config.").
4. **Deployed App URL**: `https://fineprint.tedxscu.com`. **GitHub organization**: leave blank (the repo belongs to a personal account). Click **Create GitHub App**.
5. GitHub opens a pre-filled "Create GitHub App" page (permissions: repository contents read & write, metadata read, pull requests read; callback URLs for localhost, 127.0.0.1 and the deployed URL). Keep the suggested name or rename it (e.g. "TEDxSantaClaraUniversity Keystatic") and confirm.
6. GitHub sends you back to localhost. Keystatic **appends the four variables to `.env`** and shows "You've installed Keystatic!". Click **Install GitHub App**, choose **Only select repositories** > `TEDxSantaClaraUniversity27` > **Install**.
7. Open `.env`, **delete the `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending` line** at the top (the generated block below has the real slug). Restart `npm run dev`, open `http://localhost:3000/keystatic` and check that **Log in with GitHub** works.
8. In Vercel: Project > **Settings > Environment Variables**, add the four variables with the values from `.env`, for the **Production** environment only. (Preview URLs are not in the GitHub App's callback list, so sign-in would fail there anyway.) If the domain ever changes, add the new `https://<domain>/api/keystatic/github/oauth/callback` under the app's **Callback URL** at github.com > Settings > Developer settings > GitHub Apps.
9. **Redeploy** (Deployments > the latest production deployment > **…** > **Redeploy**): `NEXT_PUBLIC_` variables are baked in at build time, so an existing build does not see them.
10. Never commit `.env` (it is in `.gitignore`). If a secret leaks: GitHub App settings > generate a new client secret, and replace `KEYSTATIC_SECRET` with a new random string; update Vercel and redeploy.

**Who can edit**: anyone with a GitHub account who has **Write** access to the repo. The owner invites them: GitHub > repo > **Settings > Collaborators > Add people** > role Write. They then sign in at `https://fineprint.tedxscu.com/keystatic`. Each save appears in the repo history under their name. Remove access the same way at the end of the year. If someone sees "Repo not found", they either lack write access or the GitHub App is not installed on the repo.

Saves go to the repo's **default branch** (`main`), which Vercel deploys: live in about a minute or two.

## e. Post-deploy checklist

- [ ] `https://fineprint.tedxscu.com` loads over HTTPS; `http://` and the `*.vercel.app` URL redirect to it (see "Search engines and preview URLs").
- [ ] **Real iPhone, Safari**: home page scrolls smoothly, the menu opens and closes, the 3D scene appears after a moment (or the static design shows on Low Power Mode / Reduce Motion), no sideways scrolling, Tickets button works.
- [ ] **Firefox** (desktop): same checks.
- [ ] **A mid-range laptop** (not your fastest machine): scrolling stays smooth with the scene on; add `?quality=low` and `?quality=static` to compare.
- [ ] **Reduce motion** turned on in the OS: no animation, everything readable.
- [ ] **Lighthouse** (Chrome DevTools > Lighthouse, mobile, on the live URL): Performance, Accessibility, Best Practices, SEO all green; note the scores for next year.
- [ ] **Share preview**: paste the URL into iMessage/WhatsApp/Slack/LinkedIn (LinkedIn Post Inspector, or opengraph.xyz) and check the image, title and description.
- [ ] `https://fineprint.tedxscu.com/robots.txt` and `/sitemap.xml` load (robots.txt must allow `/` on production; a preview URL's robots.txt says `Disallow: /`); search for the site in Google Search Console once it is set up (optional).
- [ ] `/keystatic`: sign in, change a harmless FAQ answer, save, and see it live within a couple of minutes; change it back.
- [ ] The footer shows "This independent TEDx event is operated under license from TED."

## f. Rolling back

- **A bad code or content deploy**: Vercel > Project > **Deployments** > pick the last good production deployment > **…** > **Promote to Production** (Instant Rollback). The live site switches back within seconds. While rolled back, Vercel may stop promoting new pushes automatically until you promote a new deployment again; check the banner on the project page **(verify on first deploy)**.
- **Then fix the cause**: for a content mistake, edit it again in `/keystatic`, or on GitHub open the commit (repo > **Commits**) and use **Revert** (via a pull request) to undo it. For code, revert the commit and push.
- **A broken build never goes live**: if a build fails, Vercel keeps serving the previous deployment. The failed build's log is under Deployments.
