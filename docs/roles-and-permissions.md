# Roles and permissions

Who can see and do what in the app: **Guest**, **Runner**, **Organizer** and **Admin**.

**The source of truth is `firestore.rules`.** The app also hides controls a role can't use, but hiding is only a convenience: the rules are what actually stop a request. Where the screens and the rules disagree, this document says so (see [Gaps between the rules and the screens](#gaps-between-the-rules-and-the-screens)).

Related code: `src/utils/roles.ts` (client role checks), `firestore.rules` (helpers `isAdmin()`, `isStaff()`, `isUserEmailOwner()`), `tests/firestore.rules.test.mjs` (rule tests). Retention and deletion policy lives in [go-live-policy.md](go-live-policy.md).

## The four roles

| Role | Who they are | How the app knows |
|---|---|---|
| **Guest** | Anyone not signed in, or signed in but not yet finished sign-up. | No verified signed-in account / no profile yet. `GUEST_USER` on the client. |
| **Runner** | A signed-in club member. The default role. | `role: 'member'` on their `users/{email}` profile (also the fallback when a profile has no role). |
| **Organizer** | A run host: sets up runs, routes and code words. | `role: 'organizer'` on their profile. |
| **Admin** | Club administrators. | `role: 'admin'` on their profile, **or** the owner email (see below). |

"Staff" in the rules (`isStaff()`) means **Organizer or Admin**. Every Admin is also staff.

Signed-in access always requires a **verified email**: the rules check `email_verified` on the sign-in token for everything private.

### How roles are assigned

- **Owner account.** `woodlandwoodchuckers@gmail.com` is always an Admin and cannot be demoted. It is listed in **two places that must match**: `ADMIN_EMAILS` in `src/utils/roles.ts` and `isBootstrapAdminEmail()` in `firestore.rules`. (A new club changes both; see [new-club-setup.md](new-club-setup.md).)
- **Everyone else** starts as a Runner. Sign-up can only create a `member` profile; the owner email is the one exception and may create itself as `admin`.
- **Promotion and demotion** is done by an Admin from **Admin → Members**, which sets `role` to Runner, Organizer or Admin. Nobody can change **their own** role, and the owner row is locked in the UI.
- Firebase custom claims (`admin`, `organizer`) are also honored by the rules, but the app doesn't set them today. The profile `role` is the working mechanism.

## Summary table

✅ allowed · ➖ not allowed · *own* = only their own records.

| Capability | Guest | Runner | Organizer | Admin |
|---|---|---|---|---|
| **Browse** | | | | |
| See the run schedule, routes, route maps, milestone and badge catalog | ✅ | ✅ | ✅ | ✅ |
| Subscribe to the calendar feed (`/calendar.ics`) | ✅ | ✅ | ✅ | ✅ |
| See runs that aren't live yet (no code word saved) | ➖ | ➖ | ✅ | ✅ |
| See RSVP names/counts and checked-in counts on run cards | ➖ | ✅ | ✅ | ✅ |
| See **Standings** (own stats, rank, leaderboard) | ➖ | ✅ | ✅ | ✅ |
| **Running** | | | | |
| Sign up / create a profile | ✅ (becomes Runner) | — | — | — |
| RSVP and un-RSVP (*own*) | ➖ | ✅ | ✅ | ✅ |
| Check in with the code word during the window (*own*) | ➖ | ✅ | ✅ | ✅ |
| Edit own check-in (route, loops, pet) during the window | ➖ | ✅ | ✅ | ✅ |
| Claim old-app (legacy) names as own history | ➖ | ✅ | ✅ | ✅ |
| Edit own profile (name, shirt size, birthday, city, zip, pace, emergency contact) | ➖ | ✅ | ✅ | ✅ |
| Turn phone notifications on/off for own device | ➖ | ✅ | ✅ | ✅ |
| See own check-ins, own gear alerts, own profile | ➖ | ✅ | ✅ | ✅ |
| **Running events** | | | | |
| Create runs; edit upcoming runs | ➖ | ➖ | ✅ | ✅ |
| Set or change a run's code word (until check-in opens) | ➖ | ➖ | ✅ | ✅ |
| Add, edit and delete routes (not routes referenced by runs) | ➖ | ➖ | ✅ | ✅ |
| Delete a run before its check-in opens | ➖ | ➖ | ✅ | ✅ |
| Delete a run whose check-in has opened or that is over | ➖ | ➖ | ➖ | ✅ |
| See who checked in to a run and open their profile (emergency contact, shirt size) | ➖ | ➖ | ✅ | ✅ |
| See milestones reached at a run and mark gear handed out | ➖ | ➖ | ✅ | ✅ |
| Record a check-in on a runner's behalf | ➖ | ➖ | ✅ (rules) | ✅ (rules) |
| **Staff data** | | | | |
| List and search all runner profiles; read the whole check-in log | ➖ | ➖ | ✅ (rules) | ✅ |
| See and fulfill the whole gear queue (all runs) | ➖ | ➖ | ✅ (rules) | ✅ |
| Export roster / check-in CSV | ➖ | ➖ | ➖ (screens) | ✅ |
| **Club administration** | | | | |
| Change anyone's role | ➖ | ➖ | ➖ | ✅ |
| Delete a runner (profile, leaderboard row, check-ins, gear alerts, RSVPs) | ➖ | ➖ | ➖ | ✅ |
| Delete check-ins | ➖ | ➖ | ➖ | ✅ |
| Create and edit badges, special events and milestones (gear tiers) | ➖ | ➖ | ➖ | ✅ |
| Post and delete announcements; send phone notifications | ➖ | ➖ | ➖ | ✅ |
| See how many devices are signed up for notifications | ➖ | ➖ | ➖ | ✅ |
| Change club settings; manage the legacy name index and unclaim names | ➖ | ➖ | ➖ | ✅ |
| Open the Admin dashboard | ➖ | ➖ | ➖ (screens) | ✅ |

"(rules)" means the rules allow it but there is no organizer-facing screen for it today; "(screens)" means the screens don't offer it. See the gaps section.

## Role details

### Guest

- Reads, without signing in: the **runs** schedule, **routes**, the public **members** leaderboard rows, **badges**, **special events**, **check-in event info** (times; never the code word), **announcements** and **settings**.
- Cannot read **users**, **check-ins**, **gear alerts** or **code words**; those collections are closed to the public.
- The app hides RSVP and checked-in details and the Standings page from guests. The Check In button prompts them to sign in or join.
- The home hero offers **Join Club** while nothing is open for check-in.

### Runner

- **Check-in rules** (enforced by the rules, not just the screen): the code word must match the run, and the check-in must fall inside the run's window: **2 hours before the start until the end of that day (club time)**. A runner has **one** check-in per run.
- **Stats can't be edited by hand.** Run totals, miles, badges and streaks only change inside the same write as a valid check-in (or an approved legacy claim). Profile edits can't touch them.
- **Profile edits** cover name, shirt size, birthday, city, zip, preferred pace and the optional emergency contact. Role, email, totals and legacy links can't be changed.
- **RSVP:** a runner can add or remove only their **own** entry on a run.
- **Privacy:** only the runner (and staff) can read their profile and check-ins. The public leaderboard row (`members`) holds no email or personal details beyond display name, pace and stats.

### Organizer

Organizers run event night. Beyond a Runner, an Organizer can:

1. **Create, edit and delete runs.** Deleting is only allowed **until the run's check-in opens**; after that only an Admin can delete it, because check-ins, run totals and gear alerts depend on it (enforced by the rules). Editing stays available after check-in opens, but the run's date and check-in window are then locked. A run that is over can only have its RSVP list changed.
2. **Create, edit and delete routes**, except a route that is **in use** by a run (a referenced route is retained and can't be edited or deleted).
3. **Look up who checked in to a run and open their profile.** Each run card shows a **Check-ins** button listing the runners who checked in (with a search box). Tapping a runner shows their **emergency contact** (with a tap-to-call number), shirt size, pace, age and run count. The check-ins load for that run only, however old it is.
4. **See the milestones reached at a run and mark off gear handouts.** The same **Check-ins** window lists the milestone gear earned at that run, with the runner's current shirt size, and a **Mark handed out** button. Runners who reached a milestone are listed first. A runner's **first run** shows as a **First Chuck Run** welcome (🦫) so organizers can recognize new runners; it has no gear, so there is no handout button and it never appears in the gear queue.

Also allowed by the rules for Organizers: setting or changing a run's code word until check-in opens, deleting a run's check-in event before check-in opens, recording a check-in on a runner's behalf (no screen for it yet), and read access to the runner roster, the check-in log, reward proofs and legacy history.

Organizers **cannot**: change roles, delete runners or check-ins, edit badges, special events, announcements or club settings, manage legacy data, or open the Admin dashboard.

### Admin

Admins have full control: everything an Organizer has, plus:

- **Roles:** promote and demote runners, organizers and admins (not themselves, not the owner).
- **Deletion:** delete runners (with their dependent records) and check-ins, and delete runs whose check-in has opened or that have already happened. Retention rules in [go-live-policy.md](go-live-policy.md) still apply: records are kept indefinitely unless an Admin explicitly deletes them, and referenced routes and attendance rollbacks have integrity safeguards.
- **Content:** badges, special events, milestones and club settings. **Milestones** (tiers earned by total runs or total miles, such as the 5-run shirt, with optional gear) and **badges** (attendance, streak, walking and similar achievements) are separate: a milestone is never also a badge. Milestones are added under **Admin → Milestones & Gear**, badges under **Admin → Badges**.
- **Communication:** post and delete announcements and see how many devices are subscribed to phone notifications. Phone pushes themselves are sent from the Firebase console today (see [push-notifications-plan-b.md](push-notifications-plan-b.md)).
- **Legacy data:** manage the old-app name index and unclaim names.
- **Admin dashboard:** Check-In Events & Code Words, Check-In Log, Milestones & Gear, Badges, Members, Notifications, with CSV exports.

## Gaps between the rules and the screens

These are things where the two differ today; worth deciding on deliberately.

1. **The Admin dashboard is Admin-only on screen.** Organizers get the per-run **Check-ins** window (check-in lookup and gear handouts for that run), but not the whole-club gear queue, check-in log or roster, even though the rules would let them read those.
2. **Run deletion.** The rules now let Organizers delete a run only before its check-in opens; Admins can delete any run. The Edit Run window offers "Delete Run" for upcoming runs to Organizers and Admins; deleting past runs is offered to Admins only.
3. **Two role lists to keep in sync.** `ADMIN_EMAILS` (client) and `isBootstrapAdminEmail()` (rules) must list the same owner email.
4. **Names on old records.** Check-ins, RSVPs and gear alerts store the name from when they were written. Staff screens look the current name up by email, and RSVP avatars use the current name where it's loaded, so a renamed runner may still show their old name on RSVP circles for other runners.

## Keeping this document current

When you change `firestore.rules`, `src/utils/roles.ts`, or who sees what in the screens, update the summary table above, and add or adjust a case in `tests/firestore.rules.test.mjs`. Run the rule tests with `npm run test:rules`.
