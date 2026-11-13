# Bulk route import

Organizers and administrators can open **Routes → Import routes** to upload a CSV and multiple GPX files together. For the current catalog, select `data/woodchucker_maps_updated.csv`, then all 54 files inside `data/gpx_downloads`. Files are read locally; they do not need to be hosted on a website.

The CSV needs these headers (one row per GPX):

```csv
Run name,Collection name,Date created,Loop,GPX path,Garmin Link,RunGo Link,Strava Link
```

Run name and collection name are preserved separately. Creation dates accept M/D/YY or YYYY-MM-DD and are saved as midnight UTC. Loop accepts `loop`, `yes`, `true`, `1`, `no`, `false`, `0`, or blank; blank means false. GPX paths match selected filenames, so `gpx_downloads/COURSE_123.gpx` matches a selected `COURSE_123.gpx`. Garmin course links are required; RunGo and Strava links can be blank. All provided links must use HTTPS and the appropriate service hostname.

**Preview import** reads every GPX and validates the CSV before any routes are saved. Distance, elevation and difficulty are computed from the GPX using the same parser as Route Studio. Surface defaults to Pavement. All preview errors must be fixed before importing.

Direction generation is enabled by default and processes one route at a time using the existing route engine and shared street-data cache. It may take several minutes. You can disable direction generation to import the route maps and links first, then generate directions individually in Route Studio. Review generated directions in the editor before relying on them.

Saving uses the normal staff permissions and document-size checks. Each imported route has a stable ID derived from its Garmin course ID. A Firestore transaction creates the route only if that ID does not already exist. Repeating an import skips those routes, including after a lost response or page reload. This does not deduplicate older manually created routes with different IDs. The importer never replaces existing routes or modifies runs, attendance, rewards or history.

**Stop after current route** keeps routes already saved. Resume/retry skips completed rows and retries failures. Closing and reopening with the same files is also safe. A partially completed import is not rolled back.

The updated Firestore rules must be deployed alongside the app because imported routes include the optional `collectionName` field. This feature does not import data or deploy anything automatically.
