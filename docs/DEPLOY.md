# Deploying fineprint.tedxscu.com

The site is a Next.js app hosted on **Vercel**, built from the GitHub repo **`1Dabbid/TEDxSantaClaraUniversity27`**. Every push to the production branch (including every **Save** in the online admin) rebuilds and publishes the site automatically.

Steps marked **(verify on first deploy)** depend on Vercel, GitHub or DNS-provider screens that change over time; the names may differ slightly.

## 0. Before you start: name the production branch `main`

The repo's default branch is currently the working branch the site was built on (its name is shown at the top of the repo's GitHub page). Vercel uses the default branch as production, and the online admin (Keystatic) saves to the default branch too, so make it a plain `main` first:

1. GitHub > the repo > **Settings > General > Default branch** > the pencil/rename button > rename to `main` **(verify on first deploy)**. Renaming keeps all history and redirects old links.
2. Everyone with a local copy then runs `git fetch origin && git branch -m <old-branch-name> main && git branch -u origin/main main` (or simply clones again).

## a. Import the repo into Vercel

1. Sign in at **vercel.com** with the GitHub account that owns or can access the repo.
2. **Add New… > Project > Import Git Repository**. If the repo is not listed, click **Adjust GitHub App Permissions** and give Vercel access to `TEDxSantaClaraUniversity27`.
3. Settings on the import screen:
   - **Framework Preset**: Next.js (detected automatically).
   - **Root Directory**: `./` (leave as is). Build command, output directory and install command: leave the defaults (`npm ci` runs because `package-lock.json` exists; the build is `next build`).
   - **Environment Variables**: none are needed for the public site. (The Keystatic ones come in step d.)
4. Click **Deploy**. The first build takes one to two minutes and gives you a `*.vercel.app` URL.
5. **Node.js version**: Project > **Settings > Build and Deployment > Node.js Version** > **22.x** **(verify on first deploy)**. The repo pins the same version everywhere: `.nvmrc` says 22, CI uses it, and `package.json` asks for `22.x` (on Vercel that line wins over this setting, so the two must agree).
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

The canonical address is used for canonical links, Open Graph and share previews (`metadataBase`), `robots.txt`, `sitemap.xml` and the structured data. It is the environment variable **`SITE_URL`** when set at build time (Vercel > Project > **Settings > Environment Variables** > `SITE_URL` = `https://<subdomain>.tedxscu.com`, Production, then redeploy), otherwise the default `DEFAULT_SITE_URL = 'https://fineprint.tedxscu.com'` in `src/lib/site.ts`. Write a plain `https://` origin with no path or trailing slash; anything else falls back to the default. If the domain ever changes, set or change `SITE_URL` (and update the Keystatic GitHub App's callback URL, step d, "After either route").

### Search engines and preview URLs

Only the production deployment may be indexed. The rule (`isIndexable()` in `src/lib/site.ts`, read at build time): when Vercel's `VERCEL_ENV` is set to anything other than `production` (preview and development deployments), `robots.txt` disallows everything and every page carries `<meta name="robots" content="noindex, nofollow">`. Production deployments, and builds outside Vercel (no `VERCEL_ENV`, e.g. `npm run build && npm run start` locally or in CI), are indexable. Nothing needs to be set: Vercel provides `VERCEL_ENV` itself. If the site is ever hosted somewhere other than Vercel, set `VERCEL_ENV=preview` on that host's non-production builds.

The production deployment is also reachable at its `*.vercel.app` address, which would duplicate the site. Redirect it: Project > **Settings > Domains** > the `*.vercel.app` domain > **Edit** > **Redirect to** `fineprint.tedxscu.com` (308, permanent) **(verify on first deploy)**. The canonical links already point at the custom domain, so this only keeps the duplicate out of sight.

## d. Turn on the online admin (Keystatic GitHub mode)

Without this, `/keystatic` only works on someone's computer with `npm run dev`. With it, editors sign in with GitHub on the live site and every save is a commit.

How the code decides (`src/lib/admin.ts`, `keystatic.config.ts`, `next.config.ts`):

- **`npm run dev`**: the admin always works. Without the variables it edits the files on that computer (local mode).
- **Any deployment or production build** (`npm run build`, every Vercel production and preview deployment): the admin exists **only when all four variables below are set**. Storage is then GitHub (`1Dabbid/TEDxSantaClaraUniversity27`) and editors must sign in with GitHub. With any variable missing, the admin is **switched off**: `/keystatic` and `/api/keystatic/*` answer **404**. (Keystatic's local mode has no sign-in of its own; on a deployed site it would let anyone read and change files, so it never runs outside `npm run dev`.)
- The decision is made **at build time**: `NEXT_PUBLIC_*` values are baked into the build, and GitHub storage is chosen when the build sees all four. After adding or changing a variable on Vercel you must **redeploy** (route 1, step 10); an existing deployment keeps answering 404.

| Variable | What it is |
| --- | --- |
| `KEYSTATIC_GITHUB_CLIENT_ID` | the GitHub App's client ID |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | the GitHub App's client secret (secret!) |
| `KEYSTATIC_SECRET` | a random string of at least 32 characters, encrypts the sign-in cookie (secret!) |
| `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | the GitHub App's URL name (from `github.com/apps/<slug>`) |

The four values come from a **GitHub App**: a small entry in the repo owner's GitHub account that lets the admin sign editors in and save their changes. It is created **once**, by the **repo owner (`1Dabbid`)**, signed in to GitHub as that account. There are two ways to do it. **Route 1 needs only a web browser** and is the one to use. Route 2 is the automatic setup for someone who already works on the code.

### Route 1 (recommended): in the browser, no terminal

You will fill in one form on github.com, copy three values, make up one password, and paste all four into Vercel. Allow about 15 minutes. Keep a blank note open to paste the values into as you go, and delete the note when you are done. The names of GitHub's and Vercel's buttons change now and then **(verify on first deploy)**.

**Part 1: create the GitHub App**

1. Sign in to github.com as the repo owner. Click your picture (top right) > **Settings**. At the bottom of the left-hand menu click **Developer settings**, then **GitHub Apps**, then **New GitHub App**.
2. Fill in the form. Leave everything not listed here as it is:
   - **GitHub App name**: `TEDxSantaClaraUniversity Keystatic` (any name works; GitHub tells you if it is taken, then add a word).
   - **Homepage URL**: `https://fineprint.tedxscu.com/keystatic`
   - **Callback URL**: `https://fineprint.tedxscu.com/api/keystatic/github/oauth/callback` (exactly this; sign-in fails with a "redirect_uri" error if it differs by one character).
   - **Expire user authorization tokens**: leave it **ticked**. The admin needs it; sign-in fails without it.
   - **Request user authorization (OAuth) during installation**: tick it.
   - **Webhook** > **Active**: **untick** it (the admin uses no webhook, and GitHub otherwise demands a webhook address).
   - **Permissions** > **Repository permissions**: set **Contents** to **Read and write** and **Pull requests** to **Read-only**. **Metadata** is set to **Read-only** by GitHub itself. Nothing else.
   - **Where can this GitHub App be installed?**: **Only on this account**.
3. Click **Create GitHub App**. GitHub shows the new app's settings page.

**Part 2: copy the three values from GitHub**

4. On that page, copy the **Client ID** (it looks like `Iv23li…`) into your note. This is `KEYSTATIC_GITHUB_CLIENT_ID`.
5. Click **Generate a new client secret**. GitHub shows a long code **once**: copy it into your note straight away. This is `KEYSTATIC_GITHUB_CLIENT_SECRET`. (Missed it? Generate another and delete the first.)
6. Find **Public link** near the top of the same page: `https://github.com/apps/<something>`. The part after `/apps/` (for example `tedxsantaclarauniversity-keystatic`) is `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Copy just that part.

**Part 3: let the app reach this repository, and nothing else**

7. In the app's left-hand menu click **Install App**, then **Install** next to your account. Choose **Only select repositories**, pick `TEDxSantaClaraUniversity27`, and click **Install**. (If GitHub then sends you to a page on fineprint.tedxscu.com that shows an error or a 404, that is expected at this point: the site does not have the values yet. Close the tab.)

**Part 4: make up the fourth value**

8. `KEYSTATIC_SECRET` is a password you invent: **at least 32 characters**, random letters and digits, used nowhere else. The easiest way is the password generator of a password manager (Apple Passwords, 1Password, Bitwarden…) set to 40 characters, letters and digits only. Put it in your note. With fewer than 32 characters the admin refuses to start.

**Part 5: paste the four values into Vercel and rebuild**

9. On vercel.com open the project > **Settings** > **Environment Variables**. Add the four, one at a time: the name in **Key** (copy it from the table above), the value from your note in **Value**, and under **Environments** tick **Production only** (untick Preview and Development). Save each.
10. **Redeploy**, or nothing changes: **Deployments** > the latest production deployment > **…** > **Redeploy**. The four values are read when the site is built, so the site that is already online does not see them and keeps answering 404 on `/keystatic`.
11. When the deployment is ready, open `https://fineprint.tedxscu.com/keystatic`. It shows **Log in with GitHub**. Sign in, open **The event > FAQ**, and check that the questions are there. Then delete your note.

If it does not work: a **404** on `/keystatic` means one of the four values is missing, misspelled, not set for Production, or the site was not redeployed after adding them. A GitHub error mentioning **redirect_uri** means the Callback URL in step 2 is not exactly right (edit it in the app's settings; no redeploy needed). **"Repo not found"** after signing in means step 7 was skipped or another repository was picked.

### Route 2: Keystatic's automatic setup, on a computer with the code

Keystatic can create the same GitHub App for you and write the four values into a file. It only runs in development mode (`npm run dev`) on a computer, so it needs three tools. Skip this route if route 1 worked.

**One-time tools**

- **Node.js 22**: download the **22 (LTS)** installer from nodejs.org and run it with the default choices. (Another version may fail to build.)
- **GitHub Desktop**: from desktop.github.com. Sign in as the repo owner, then **File > Clone repository…** > `1Dabbid/TEDxSantaClaraUniversity27` > **Clone**. This puts the project in a folder on your computer and also installs Git.
- **A terminal opened in that folder**: in GitHub Desktop, **Repository > Open in Terminal** (Mac) or **Repository > Open in Command Prompt** (Windows) **(verify on first deploy)**. A terminal is a window where you type a command and press Enter. Every command below is typed there.

**Steps**

1. Install the project's parts: type `npm ci` and press Enter. Wait until the prompt comes back (a minute or two).
2. Create a file named `.env` in the project folder containing one line, `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending`. From the terminal: on a Mac, `printf 'NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending\n' > .env`; on Windows (Command Prompt), `echo NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending> .env`. (A placeholder: under `npm run dev` the app slug alone switches the admin into GitHub mode so the setup page appears. A production build ignores a slug without the other three.)
3. Run `npm run dev` and open **http://localhost:3000/keystatic/setup** in your browser. You should see **Keystatic Setup** ("Keystatic doesn't have the required config."). Leave the terminal window open; closing it stops the site on your computer.
4. **Deployed App URL**: `https://fineprint.tedxscu.com`. **GitHub organization (if any)**: leave blank (the repo belongs to a personal account). Click **Create GitHub App**.
5. GitHub opens a pre-filled "Create GitHub App" page (permissions: repository contents read & write, metadata read, pull requests read; callback URLs for localhost, 127.0.0.1 and the deployed URL). The suggested name is your account name followed by "Keystatic" (e.g. "1Dabbid Keystatic"); keep it or rename it (e.g. "TEDxSantaClaraUniversity Keystatic") and confirm. **The app is created public** (anyone could install it on their own repositories): switch it to private right after setup, see the first item of the security checklist below.
6. GitHub sends you back to localhost. Keystatic **appends the four variables to `.env`** and shows "You've installed Keystatic!". Click **Install GitHub App**, choose **Only select repositories** > `TEDxSantaClaraUniversity27` > **Install**.
7. Open `.env` in a text editor (in GitHub Desktop: **Repository > Show in Finder / Show in Explorer**; the file may be hidden: on a Mac press Cmd+Shift+. in the folder, on Windows turn on **View > Show > Hidden items**). **Delete the `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=pending` line** at the top (the generated block below has the real slug) and save. In the terminal press Ctrl+C to stop the site, run `npm run dev` again, open `http://localhost:3000/keystatic` and check that **Log in with GitHub** works.
8. In Vercel: Project > **Settings > Environment Variables**, add the four variables with the values from `.env`, for the **Production** environment only.
9. **Redeploy** (Deployments > the latest production deployment > **…** > **Redeploy**): `NEXT_PUBLIC_` variables and the storage mode are baked in at build time, so an existing build does not see them and keeps answering 404 on `/keystatic`. Afterwards `https://fineprint.tedxscu.com/keystatic` shows **Log in with GitHub**.
10. Never commit `.env` (it is in `.gitignore`, so GitHub Desktop does not offer it).

### After either route

- **Production only.** Leave the four variables off **Preview** (and Development). Preview deployments then have no admin at all (`/keystatic` is a 404 there), which is intended: preview URLs are not in the GitHub App's callback list, so sign-in would fail anyway, and the client secret stays out of every branch build. Keep Vercel **Deployment Protection** (Project > **Settings > Deployment Protection** > Vercel Authentication, at least for Preview deployments) switched on so unreleased previews are not public **(verify on first deploy)**.
- **If the domain ever changes**, add the new `https://<domain>/api/keystatic/github/oauth/callback` under the app's **Callback URL** at github.com > Settings > Developer settings > GitHub Apps.
- **If a secret leaks**: in the GitHub App's settings generate a new client secret and delete the old one, invent a new `KEYSTATIC_SECRET`, update both on Vercel and redeploy. Editors simply sign in again.

**Who can edit**: anyone with a GitHub account who has **Write** access to the repo. The owner invites them: GitHub > repo > **Settings > Collaborators > Add people** > role Write. They then sign in at `https://fineprint.tedxscu.com/keystatic`. Each save appears in the repo history under their name. Remove access the same way at the end of the year. If someone sees "Repo not found", they either lack access or the GitHub App is not installed on the repo; if they can open the admin but saving asks them to "fork the repo", they can read the repo but lack write access.

Saves go to the repo's **default branch** (`main`), which Vercel deploys: live in about a minute or two.

### Security checklist

Go through this once after step d, and again whenever the team changes hands.

- [ ] **GitHub App is private** (route 1 creates it private; the automatic setup of route 2 creates it public): github.com > Settings > Developer settings > GitHub Apps > the Keystatic app > **Advanced** > **Make private**, so it reads "Only on this account" under *Where can this GitHub App be installed?* **(verify on first deploy)**.
- [ ] **Installed only on this repository**: github.com > Settings > Applications > Installed GitHub Apps > the app > **Configure** > *Only select repositories* > `TEDxSantaClaraUniversity27` and nothing else.
- [ ] **No localhost callback URLs on the production app**: in the app's settings, remove the `http://localhost:3000/...` and `http://127.0.0.1/...` callback URLs the automatic setup (route 2) added, leaving only `https://fineprint.tedxscu.com/api/keystatic/github/oauth/callback`. (For local GitHub-mode testing, create a separate development app instead.)
- [ ] **Protect the default branch**: repo > Settings > Branches (or Rules > Rulesets) > a rule for `main` that blocks force pushes and deletion. Keystatic saves are ordinary commits by collaborators, so do not require pull requests unless editors are expected to open them.
- [ ] **Only collaborators with Write access can edit content**: the admin can only commit as the signed-in GitHub user, so the repo's collaborator list *is* the editor list. Review it (repo > Settings > Collaborators) at the start and end of each year.
- [ ] **`KEYSTATIC_SECRET` is at least 32 random characters** (a password manager's generator, or `openssl rand -hex 32`), never a word or a reused password. Rotate it, together with the GitHub App's client secret, if either may have leaked (step d, "After either route").
- [ ] **The four Keystatic variables are set for Production only**, Deployment Protection is on for previews, and `/keystatic` on a preview URL answers 404.
- [ ] **Never set `ANALYZE=1` on Vercel**: it publishes browser source maps of the whole site. It is only for local bundle analysis.
- [ ] Know the residual risk: the signed-in editor's GitHub access token is kept in a cookie that the admin's own JavaScript must read (`keystatic-gh-access-token`, a Keystatic design decision), so script running on this origin could read it. The site therefore allows no third-party scripts, uploads under `/images`, `/brand`, `/stills` and `/icons` are served with a sandboxed, script-free Content-Security-Policy, and speaker and team photos must be JPG, PNG, WebP or AVIF (checked by file contents at build time; anything else is left out of the page with a content warning). Sponsor logos may be SVG; they are only shown through `<img>`, which never runs script.

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
- **A broken build never goes live**: if a build fails, Vercel keeps serving the previous deployment. The failed build's log is under Deployments; a content problem is reported as "Content error in content/<file>.yaml" with the field and the allowed values (docs/EDITING.md, "If the site fails to build after an edit").
- **Content warnings**: most editor mistakes (a link without `https://`, a photo that is not a JPG/PNG/WebP/AVIF, a photo over 2 MB, an invalid page address, an impossible date) do not fail the build: the value is repaired or left out and the build log lists a "Content warning". `npm run check:content` prints them all locally; CI runs it as a non-blocking step (and blocks only on errors that would stop the build).

## g. Known notices in the build log (no action needed)

- **`npm warn deprecated eslint@9…`** during install: the code checker's current major version is no longer maintained upstream. It only checks code on developers' machines and in CI and is not part of the site. Upgrade it when `eslint-config-next` supports the next major.
- **`npm audit` reports 2 moderate issues** (`minimatch`, through `@keystatic/core`): they concern the admin's build tooling, not the public pages. Upgrade `@keystatic/core` when a release drops that dependency. **Never run `npm audit fix --force`**: its only "fix" is a years-old Keystatic that breaks the admin.
