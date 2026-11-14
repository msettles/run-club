# Attendance import formats

A club's history comes in as up to **three CSV files**: **Profiles** (one row per person), **Run history** (one row per run) and **Check-ins** (one row per person per run). Download an example of each, and check a file without importing it, from **Admin > Runners & Claims > "Import formats"**. The examples are also in [examples/](examples/).

**Totals are never imported.** Runs, miles, walks, first-run date, streaks, badges and milestones are all recomputed from the check-ins plus each person's `No Check-In Runs` count. A "Total Runs" or "Total Miles" column in a file is ignored. Only the miles on each *check-in* are read.

People **with an email** become members of the club (or are matched to an existing member). A member with no name gets one made from the start of the email (the domain is never used, because names are public); it can be edited later. People **without an email** become *past aliases*: names a runner can claim later. Blank cells are left empty, except the few things the app needs, which get a default (shown below).

Columns a file has that aren't listed are ignored, so this app's own exports and the old-app files can be used as they are. Dates may be `2026-10-07`, `10/7/2026` or Excel's `10/7/26`.

## 1. Profiles (`woodchuckers-import-profiles-example.csv`)

| Column | Required? | If blank |
|---|---|---|
| `Email` (also `User Email`) | Email **or** Name | Past alias (needs a Name) |
| `Name` (also `Display Name`, `Runner Name`) | Email **or** Name | Made from the email |
| `Birthday` | No | Empty |
| `No Check-In Runs` (also `OldCounts`, `Pre-2021 Runs`) | No | 0 |

Shirt size, city, zip and emergency contact aren't imported: members add them themselves after they sign in. A column with one of those names is ignored.

## 2. Run history (`woodchuckers-import-runs-example.csv`)

| Column | Required? | If blank |
|---|---|---|
| `Date` | **Yes** | Row skipped |
| `Time` | No | 18:30 |
| `Title` | No | "Group run" |
| `Code Word` (also `Code Name`) | No | Empty |
| `Special Event` | No | Not a special event |
| `Location`, `Address`, `Route`, `Distance`, `Surface`, `Notes` | No | Club's usual location / empty / unknown / Pavement |
| `Run ID` | No | Made from the date; explicit IDs are needed for separate runs on one date |

Code words validate check-in only. They never identify, merge or classify attendance. The approved historical input already has one run per date; the importer does not repeat its earlier consolidation.

## 3. Check-ins (`woodchuckers-import-checkins-example.csv`)

| Column | Required? | If blank |
|---|---|---|
| `Email` / `Name` | Email **or** Name | |
| `Date` | **Yes** (or a `Run ID`) | Row skipped |
| `Run ID` | No | The run on that date |
| `Code Word` | No | Only used to pick between two runs on the same date |
| `Time` | No | 18:30:00 |
| `Activity` | No | running |
| `With Pet` | No | No |
| `Loops` | No | 1 |
| `Route` | No | Empty |
| `Miles` (also `Actual GPS Miles`) | No | Unknown (adds nothing to mileage) |

A check-in finds its run by `Run ID`, else by `Date`. A date with no run gets a placeholder run. A repeat of the same person at the same run is dropped.

## Importing (Admin > Runners & Claims > Import formats)

Choose any of the three files, press **Review import**, tick the confirmation and press **Import**.

**Importing the same file again changes nothing. Importing an edited file updates what you edited.** Nothing is ever deleted: a row missing from a file leaves its record as it is.

| What the file says | What the club gets | On a later import |
|---|---|---|
| A person **with an email** | A member profile, their check-ins, and totals, badges, streaks and reward proofs worked out from those check-ins | Name, birthday and no-check-in runs are updated when the file gives a different value. A blank cell never erases anything, and a name made from an email never replaces a real one |
| A person **without an email** | Held as an unclaimed past name with their dated sign-ins. **No profile is made** | Updated if it changed. If someone has already claimed the name, their totals follow |
| A run | A run and its check-in event, which nobody can check in to. The ID defaults to `run-<date>`; separate runs on one date require explicit Run IDs | Title, time, place, special event and code word are updated. Runs made in the app are left alone |
| A check-in | A record at that run | Changed rows are updated; a check-in whose run's title or special event changed is replaced. The app's own check-ins are never replaced |

Totals, badges, milestones and streaks are **never read as authoritative totals from a file**. The import updates attendance and affected claimed-name contributions, then recomputes the affected members’ derived totals and rewards. Subsequent check-ins update them from attendance as well.

### Special events on past names

A run's **Special Event** tag and **Code Word** import with the run. When a held name is claimed, each of its sign-ins on a tagged run counts toward that special event (its badge goes up). A blank tag earns no special-event credit. Code words, titles and calendar dates do not supply a classification.

### Gear

Imports and ordinary recomputes do not issue historical gear. **Claiming past names** can create owed gear alerts, including delivery retried after an interrupted claim:

1. Claiming a single name owes nothing: the old app already handed out its gear.
2. When a runner has claimed two or more names, the one with the most runs is treated as their main name, with everything up to its count already given.
3. The other names are added to it, biggest first. The same run under multiple names counts once. Separate runs on the same date remain separate. Runs with no sign-in date are counted.
4. Every run-count milestone the count crosses while adding them is owed, as an **unfulfilled** gear alert. An alert is never made twice.

Only run-count milestones apply (old sign-ins have no mileage). Runner totals also count shared runs once across all claimed names and app check-ins. Undated credits remain additive because overlap cannot be established.

Claims save a private `claimGearPending` flag with the history reservation. It is cleared only after every owed alert has been saved or found to exist. Reloading/reward refresh, retrying the claim, or the admin recompute retries pending delivery. Each alert is created transactionally; a retry never overwrites an existing fulfilled handout. Ordinary imported history without pending claim work does not generate a gear backlog.

### Claiming multiple names: shared attendance

Claiming Pat Runner and Pat L Runner credits one run when both names attended the same run. New imports retain the canonical run ID in held attendance. Older records without an ID use the date, resolving to the unique known run on that date. Ambiguous dates require an explicit Run ID; separate explicit IDs are preserved. Claiming does not merge entire weeks: approved date consolidation belongs in the historical source files.

Claims reserve the name before reading its private attendance, then finish the deduplicated credit and publish standings. If interrupted, retrying the claim or the next reward refresh resumes it without adding credits again. Check-in and additional claims wait until a pending claim finishes. Attendance matching keys stay in private history and profiles, not the public name pool or standings.

**For a new deployment or separately approved historical replacement:** deploy the app and Firestore rules together, import the approved complete historical files, then run **Recompute rewards for everyone** as an admin. This prepares private matching data and reconciles already-claimed names, public standings, badges and reward proofs. It is safe to repeat. Check that every member finishes successfully before launch; names lacking prepared history cannot be newly claimed. Original attendance, undated credits and fulfilled gear records are retained. This operation does not perform the go-live reset or delete old run documents.

**Woodland status, November 13:** this migration/import/recompute has already completed, with five successful account reconciliations and owner acceptance. Do not delete/re-import the launch database just to follow these general instructions. See [go-live-readiness-review.md](go-live-readiness-review.md).

### First Run Date

Shown as month/year, and on Standings as "Running since mm/yyyy".

- A member with runs that have **no check-in record** reads **Before mm/yyyy**. That month is when the club's check-in records begin (the first recorded run, club-wide): from then on everyone should have checked in, so any earlier run has no record.
- Everyone else reads **mm/yyyy** of their oldest check-in (including dated sign-ins from claimed names).

It is worked out when an import or **Recompute rewards** runs, so a claim made later shows its effect after the next recompute.

### Recompute rewards

**Recompute rewards for everyone** rebuilds every member's totals, badges, streaks and reward proofs from their check-ins. Use it after you add, change or delete a badge or special event, so members are current without waiting for them to sign in. It is safe to repeat.

It also retries saved, unfinished claim-merchandise delivery. Admins can run this while Club maintenance is paused. During a historical replacement, keep the pause enabled until there are zero failed members and all count/route/access checks pass.

### Known limits

- Check-ins are credited by miles only (one loop). Loops in a file are not kept.
- Imported runs carry no RSVP list.
- Separate runs on one date require explicit Run IDs in both run and check-in files. Code-word changes do not affect attendance identity.
