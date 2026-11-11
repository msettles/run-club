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
| `Shirt Size` | No | Not specified |
| `Birthday` | No | Empty |
| `No Check-In Runs` (also `OldCounts`, `Pre-2021 Runs`) | No | 0 |

City, zip and emergency contact aren't imported: members add them themselves after.

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

## Status

The formats, examples and checker are in place. **Importing is not switched on yet**; the older two-file import is unchanged.
