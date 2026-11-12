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
| `Run ID` | No | Made from the date (and code word). Only for restoring this app's own export |

The code word lives here, not in the check-ins. It names the run and tells two runs on one day apart.

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

## Importing (Admin > Members > Import formats)

Choose any of the three files, press **Review import**, tick the confirmation and press **Import**.

**Importing the same file again changes nothing. Importing an edited file updates what you edited.** Nothing is ever deleted: a row missing from a file leaves its record as it is.

| What the file says | What the club gets | On a later import |
|---|---|---|
| A person **with an email** | A member profile, their check-ins, and totals, badges, streaks and reward proofs worked out from those check-ins | Name, birthday and no-check-in runs are updated when the file gives a different value. A blank cell never erases anything, and a name made from an email never replaces a real one |
| A person **without an email** | Held as an unclaimed past name with their dated sign-ins. **No profile is made** | Updated if it changed. If someone has already claimed the name, their totals follow |
| A run | A run and its check-in event, which nobody can check in to. The first run on a date is `run-<date>`; a second run that day also uses its code word | Title, time, place, special event and code word are updated. Runs made in the app are left alone |
| A check-in | A record at that run | Changed rows are updated; a check-in whose run's title or special event changed is replaced. The app's own check-ins are never replaced |

Totals, badges, milestones and streaks are **never** read from a file and **never** written by the import. They are computed from the check-ins, at the end of an import and again on every check-in.

### Special events on past names

A run's **Special Event** tag and **Code Word** import with the run. When a held name is claimed, each of its sign-ins on a tagged run counts toward that special event (its badge goes up). Sign-ins on runs with no tag still match the old code-word keywords (Turkey, Halloween, Spooky, Anniversary).

### Gear

Importing and recomputing **never** create gear alerts (so history never sends members a pile of old shirts to hand out). There is one exception, **claiming past names**:

1. Claiming a single name owes nothing: the old app already handed out its gear.
2. When a runner has claimed two or more names, the one with the most runs is treated as their main name, with everything up to its count already given.
3. The other names are added to it, biggest first. A run on a day an earlier name already signed in is not counted again (they signed in twice to one run). Runs with no sign-in date are counted.
4. Every run-count milestone the count crosses while adding them is owed, as an **unfulfilled** gear alert. An alert is never made twice.

Only run-count milestones apply (old sign-ins have no mileage). The runner's run total itself still adds up every claimed name's runs; the day check only decides gear.

### First Run Date

Shown as month/year, and on Standings as "Running since mm/yyyy".

- A member with runs that have **no check-in record** reads **Before mm/yyyy**. That month is when the club's check-in records begin (the first recorded run, club-wide): from then on everyone should have checked in, so any earlier run has no record.
- Everyone else reads **mm/yyyy** of their oldest check-in (including dated sign-ins from claimed names).

It is worked out when an import or **Recompute rewards** runs, so a claim made later shows its effect after the next recompute.

### Recompute rewards

**Recompute rewards for everyone** rebuilds every member's totals, badges, streaks and reward proofs from their check-ins. Use it after you add, change or delete a badge or special event, so members are current without waiting for them to sign in. It is safe to repeat.

### Known limits

- Check-ins are credited by miles only (one loop). Loops in a file are not kept.
- Imported runs carry no RSVP list.
- A second run on one date is told apart by its code word, so keep each run's code word the same between imports.
