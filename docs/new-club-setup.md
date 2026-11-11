# Setting up a new club on Run Club

Run Club is the platform; each club runs its own copy. The model is **fork, edit, deploy**: one fork of this repository, one Firebase project and one website per club. Everything used is on Firebase's free Spark plan; no credit card is needed.

> **Where this stands (November 10, 2026).** The club's settings are not yet gathered in one place. Step 3 below lists the files a fork has to edit by hand today. Once [club-extraction-plan.md](club-extraction-plan.md) is done, step 3 becomes "edit the `club/` folder" and the rest of this guide stays the same.

## What you need

- A GitHub account, Node.js 24.12+ (`nvm use` reads `.nvmrc`), and Java 21+ for the rules tests.
- A Google account for the club (a dedicated club Gmail account is best; it becomes the permanent owner/admin).
- Your club's details:
  - Name, short name (about 12 characters, shown under the phone icon) and one-line description.
  - Usual run day and start time, and the club's time zone (for example `America/Chicago`).
  - Home venue: name, address and map coordinates.
  - Two brand colours (a primary and an accent).
  - Images: a square install icon at 512×512, 192×192 and 180×180 (Apple), and a logo for the navbar.
  - Milestones and rewards (for example a shirt at 5 runs).

## 1. Fork and run locally

Run Club is under the [PolyForm Noncommercial License](../LICENSE): free for clubs to use and change, not for commercial use. Keep the `LICENSE` file, with its notice crediting the original repository, in your fork.

Fork the repository on GitHub, then:

```bash
npm install
```

```bash
npm run dev
```

With no `.env` file the app runs in **local mode** with sample data in the browser, which is the easiest way to see your edits.

## 2. Create the club's Firebase project

Signed in to the [Firebase console](https://console.firebase.google.com/) as the club's Google account:

1. **Add project.** The project ID (for example `riverside-runners`) also becomes the free web address `riverside-runners.web.app`. Stay on the Spark plan.
2. **Register a web app** (the `</>` icon) and copy its configuration values.
3. **Authentication → Sign-in method:** enable **Google** and **Email/Password** with **Email link (passwordless sign-in)**.
4. **Firestore Database → Create database** (production mode; the rules come from this repository).
5. **Hosting → Get started** (the site name defaults to the project ID).
6. Optional, for phone notifications: **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**.

Then locally:

```bash
cp .env.example .env
```

Fill in `.env` with the values from steps 2 and 6. `.env` is git-ignored; never commit it.

## 3. Make it your club

Edit these in your fork. (This list is what the extraction plan replaces with one folder.)

| What | Where |
|---|---|
| Firebase project and hosting site | `.firebaserc`, `firebase.json` (`hosting.site`) |
| Owner/admin email (**must match in both**) | `src/utils/roles.ts` (`ADMIN_EMAILS`) and `firestore.rules` (`isBootstrapAdminEmail`) |
| Installed app name, short name, description, theme colours | `vite.config.ts` (`manifest`) |
| Page title, description, theme colour | `index.html` |
| Install icons and logos | `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/apple-touch-icon.png`, `public/favicon.ico`, the mascot images |
| Colours | `tailwind.config.js` (replace the hex values; keep the palette names) |
| Time zone | `src/utils/checkInWindow.ts` (`CLUB_TIME_ZONE`), plus the literal `America/Los_Angeles` in `src/utils/dateUtils.ts`, `src/utils/runChoices.ts`, `src/services/store/checkInModel.ts`, `vite.config.ts`, `vitest.config.ts` |
| Run day | `nextClubRunDate` in `src/utils/checkInWindow.ts` |
| Club name and venue wording | Search `src/` for the current club and venue names: hero and footer in `src/App.tsx`, `Navbar.tsx`, `RunCard.tsx`, `CheckInModal.tsx`, `MilestonesPage.tsx`, the install prompts, `src/utils/mapLayers.ts`, `src/utils/calendar.ts`, `src/utils/routeEngine/` |
| Venue map position | `RouteStudioModal.tsx`, `MapViewer.tsx` |
| Starter milestones, badges and special events | `src/data/catalog.ts` is only the **starter pack**. The first time an admin opens the app, it is saved to Firestore (marked by `settings/catalog`); after that they are the club's own data, edited or deleted under **Admin > Milestones & Gear** and **Admin > Badges** (nothing is built in), and **Add back starter** restores deleted ones. Change the starter pack for a new club, then run `npm run sync:reward-rules` (it keeps the rules' pre-seed fallback in step) |
| Local-mode sample data | `src/data/initialData.ts` and the sample route files |
| Push notification default title | `public/push-sw.js` |
| Site address | `src/utils/calendar.ts`, `AuthModal.tsx`, `admin/NotificationsTab.tsx` |
| Brand notes and Logos & Brand screen | `BRANDING.md`, `src/components/BrandAssetsModal.tsx` |

Leave these alone:

- `public/runclub-icon.png`, `public/runclub.png` and the footer's "Built with Run Club" credit and its link to the platform repository: that is the platform's branding.
- The `woodchuckers` prefix in browser storage keys and in the leaderboard key (`src/utils/memberKey.ts` and `firestore.rules`). It is invisible to runners. A brand-new club may change it before its first sign-up, in both places together; never after.

Several tests assert on the current club's wording and owner email (`tests/firestore.rules.test.mjs`, the store integration tests, a few unit tests). Update them alongside your edits.

## 4. Check

```bash
npm run typecheck && npm run lint && npm test
```

```bash
npm run test:rules && npm run test:integration
```

```bash
npm run build && npm run check:bundle
```

```bash
npm run test:browser
```

(Run `npx playwright install chromium webkit` once before the browser tests.)

## 5. Deploy

Sign the Firebase CLI in as the club's Google account, then always deploy the rules and the site together:

```bash
npx firebase login
```

```bash
npm run build && npx firebase deploy --only firestore:rules,hosting --project YOUR_PROJECT_ID
```

## 6. First sign-in

1. Open `https://YOUR_PROJECT_ID.web.app` and sign in as the owner email. That account is an admin immediately and cannot be demoted.
2. If you use a custom domain, add it under **Hosting** and under **Authentication → Settings → Authorized domains**.
3. In **Admin Dashboard → Runners & Claims**, promote your organizers once they have signed up.
4. Create your routes and first run. A run is live once its code word is saved.
5. On a phone, install the app from the banner and check the name and icon are yours.
6. Phone notifications are sent from **Firebase console → Messaging**; see the README's push section.

## 7. Backups (optional, and not free)

**FYI: a new club has no database backups.** Firestore's scheduled backups and point-in-time recovery need the Blaze plan and **bill for storage**. For a club-sized database that is cents a month, but it is not zero, so they are off until you choose to turn them on. If losing data would hurt, turn them on and set a small budget alert; [backup-and-restore.md](backup-and-restore.md) has the steps, the restore commands, and what to check first. The free alternative for moving or keeping your own copy of records is the CSV formats in [import-format.md](import-format.md).

## Keeping up with the platform

Add the platform repository as a second remote and merge its `main` into your fork when you want updates. Until the extraction plan is finished your club edits are spread across platform files, so expect merge conflicts; afterwards the only differences are in `club/` and merges are clean.
