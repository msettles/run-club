# Plan: one build-time club setup

Status: planned, not started. Written November 10, 2026.

## Goal

Run Club is the platform; Woodland Woodchuckers is the first club. Today the club's name, venue, colours, icons, time zone, owner email and Firebase project are written directly into about 85 files. This plan gathers them into one **club setup** that is read when the app is built, so a new club can **fork the repository, edit the setup and theme, and follow [new-club-setup.md](new-club-setup.md)**.

Decisions already made by the owner:

- **Build time, not runtime.** One fork, one build and one Firebase project per club. No shared multi-club database, no club ID on Firestore documents, no rules rewrite.
- **Fork model.** A club's setup lives in its own fork. The platform repository keeps Woodland Woodchuckers as the working example.
- **Platform branding stays.** The browser tab icon and the footer's "Built with Run Club" credit are the platform's and are not part of a club's setup. The installed app name, install icons and theme are the club's.

Done means: the Woodland build looks and behaves exactly as it does now; a search for `woodland`, `woodchuck`, `Blue Note`, `America/Los_Angeles` and the owner email finds matches only inside `club/`; and every check in the README's command list passes.

## The club setup

A `club/` folder at the repository root. A fork edits this folder and nothing else.

```
club/
  club.ts          the definition (below)
  catalog.ts       milestones, badges, special events (moved from src/data/catalog.ts)
  sampleData.ts    local-mode sample runs, routes and runners (moved from src/data/)
  public/          the club's own images: install icons, apple-touch-icon, logos
  BRANDING.md      the club's brand notes (moved from the root)
```

`club.ts` exports one typed object. The type lives in `src/club/types.ts` (platform code), so a fork gets type errors for anything missing.

| Field | Woodland value today | Used for |
|---|---|---|
| `name` | Woodland Woodchuckers | Hero, navbar, page title, push default title, calendar entries |
| `fullName` | Woodland Woodchuckers Run Club | Install manifest name, footer, GPX creator |
| `shortName` | Woodchuckers | Install manifest short name, navbar on small screens, "Install Woodchuckers" |
| `memberNoun` | Woodchucker | "Create Your Woodchucker Profile", "Active Woodchucker" |
| `tagline`, `description` | "Pounding trails & pavement!" … | Navbar, meta description, manifest description |
| `storagePrefix` | `woodchuckers` | Browser storage keys, push inbox database, downloaded file names |
| `memberKeySalt` | `woodchuckers` | Leaderboard key hash. Also in `firestore.rules`. **Never change for an existing club** |
| `timeZone` | America/Los_Angeles | Check-in windows, run dates, build time stamp |
| `schedule` | Wednesday, 6:00 PM | "Wednesday Night Runs", next-run date, new-run defaults |
| `venue` | Blue Note Brewing Co., 750 Dead Cat Alley, Woodland, CA; 38.6781, -121.7712; 🍺 | Map centre, start/finish pins, directions wording, new-run defaults, default city |
| `wording` | "All runs start and finish at…", "Meet on patio @…", perk text | The dozen venue sentences across run cards, check-in and milestones |
| `theme.primary`, `theme.accent` | Teal `#1a607c` scale, gold `#de9c1e` scale | Tailwind palette, manifest theme colour, map lines, confetti |
| `theme.neutrals` | cream `#faf2ee`, ink `#0d1113`, deep `#13495d` | Gradients and brand swatches |
| `assets` | `Woodchucker2026.png`, `Woodchucker2.jpg`, `woodchuck.svg`, `pwa-*.png`, `apple-touch-icon.png` | Navbar mascot, install icons, notification icon, Logos & Brand screen |
| `ownerEmails` | the club Gmail account | Always-admin account in the app **and** in `firestore.rules` |
| `firebase.projectId`, `firebase.hostingSite`, `siteUrl` | `woodland-woodchuckers`, `https://woodland-woodchuckers.web.app` | `.firebaserc`, `firebase.json`, calendar UIDs, sign-in email sender text, console links |

Firebase web keys stay in `.env` (git-ignored), as now.

## How each part of the build reads it

| Consumer | Today | After |
|---|---|---|
| App code (`src/`) | Literal strings | `import { club } from '@club'` (alias to `club/club.ts` in Vite, Vitest and `tsconfig.json`) |
| `vite.config.ts` | Literal manifest, colours, time zone | Imports `club/club.ts`; sets `publicDir` to `club/public` |
| `index.html` | Literal title, description, theme colour | Placeholders filled by a small Vite plugin |
| `tailwind.config.js` | `woodland`, `bluenote`, `woodchuck`, `emerald` palettes | `club` and `accent` palettes built from `theme` |
| `public/push-sw.js` | Literal title and database name | Emitted by the Vite plugin from a template, at the same `/push-sw.js` URL |
| `firestore.rules` | Literal owner email and key salt | `npm run club:sync` rewrites two marked lines from `club.ts`, the same way `sync:reward-rules` already rewrites badge defaults. A test fails if the file is out of date |
| `.firebaserc`, `firebase.json` | Literal project and site | Rewritten by `npm run club:sync` |
| Platform images (`runclub.png`, `runclub-icon.png`) | In `public/` | Moved to `src/platform/` and imported, so they are not in the club's folder |

The rules file stays a plain checked-in file, so the deploy command does not change and no per-request lookup is added (some paths are already close to the 1,000-expression limit).

## Phases

Each phase is its own branch and PR, leaves the Woodland app unchanged on screen, and must pass every check. Phases 1 to 3 change no stored data.

1. **Definition and plumbing.** Add `club/club.ts`, the type, the `@club` alias and the Vite plugin. Move the manifest, `index.html`, push service worker, time zone, owner email, site URL and the `club:sync` script onto it. Add the rules-in-sync test. Small diff, highest value: after this a fork can change name, icons, owner and Firebase project in one file.
2. **Wording and venue.** Replace the name and venue strings in components, the route engine (`formatter.ts`, `engine.ts`), map pins, calendar export and admin defaults. About 60 files. The browser tests do not assert on club wording, so compare before/after screenshots of each tab as well.
3. **Catalog and sample data.** Move `catalog.ts`, `initialData.ts`, `operaRoutes.ts` and `the123Route.ts` into `club/`. Keep the lazy-loading boundaries (`npm run check:bundle`). `sync:reward-rules` reads the new path.
4. **Theme.** Build the Tailwind palette from `theme`; rename the `woodland-*`, `bluenote-*`, `woodchuck-*` and remapped `emerald-*` classes to `club-*` and `accent-*` (several hundred mechanical replacements); replace inline hex colours. Verify with before/after screenshots of every tab.
5. **Assets and brand screen.** Move club images to `club/public/`, platform images to `src/platform/`, and make the Logos & Brand screen read swatches and downloads from the setup. Move `BRANDING.md` into `club/`.
6. **Fork guide and proof.** Rewrite [new-club-setup.md](new-club-setup.md) to the short "edit `club/`" form. Prove it with a throwaway second club (different name, colours, time zone, weekday) built locally in local mode, and add a CI job that builds it so platform code cannot quietly regain a hard-coded Woodland value.

## Risks and rules for the work

- **Stored-data identifiers.** `storagePrefix` and `memberKeySalt` are baked into runners' browsers and into every leaderboard document ID. They move into the setup with their current values and are documented as permanent for a live club.
- **Rules size.** Only literals are substituted in `firestore.rules`; no new functions or reads.
- **Push service worker.** Keep the `/push-sw.js` URL and `/push/` scope so existing device sign-ups survive.
- **Installed apps.** The manifest output for Woodland must be byte-for-byte the same name, short name, colours and icon paths, so installed copies are not disturbed.
- **Time zone tests.** `vitest.config.ts` pins `TZ`; tests should read the club's zone rather than a literal.
- **Out of scope.** Runtime multi-club hosting, a club-admin setup screen, and the social preview work in [social-sharing-enhancement.md](social-sharing-enhancement.md) (which should read its title, description and image from this setup once both exist).
- **Not part of this plan:** creating Firebase projects, or changing the live hosting site. Each needs the owner's explicit go-ahead. The [go-live policy](go-live-policy.md) is unaffected; nothing here touches stored data.

## Open questions for the owner

1. Should forks pull platform updates from the platform repository (keeping `club/` as the only difference makes that a clean merge), and who publishes those updates?
2. The repository has no `LICENSE` file although the README says MIT. Forking by other clubs needs one.
