# Organizer and admin guide

Use your own registered account with the role assigned by an admin. Organizers and admins can also RSVP and check in as runners. Staff actions are grouped under **Organizer tools**, below runner actions on run cards and separately on route cards/maps and in the profile menu.

For member tasks, see the [runner guide](runner-guide.md). For exact permissions, see [roles and permissions](../roles-and-permissions.md).

## Schedule a run

1. On **Runs**, select **Create run**.
2. Enter the title, date, start time, venue/address and description. Confirm the saved route choices, measured distances, allowed loops and any pace groups.
3. Set the code word for attendance. A run without a saved code word is not published to ordinary runners or the calendar feed.
4. Apply special-event tags only when the run qualifies; they determine special-event badge credit. A title or reused code word does not award that credit.
5. Save with **Publish Run**, then review the resulting card and routes.

Use **Organizer tools → Edit** to update an upcoming run. Once check-in opens, the code word and the event's date/window lock. Check the displayed time carefully before that point.

**Share run** shares the public event link. It does not send a phone push or publish a social post.

## Run the table

1. Open **Run Night / Table Mode** from Runs or the profile menu. On mobile, staff also have **Run Night** in the bottom navigation.
2. Confirm the selected run. The page prefers an open event, otherwise the next available one; choose another loaded upcoming run when needed.
3. Check the opening/closing status and the private code word. Announce it to attendees at the event.
4. Watch attendance totals, route/loop headcounts, running/walking totals and participating runners with pets.
5. Use the searchable **Live check-in feed** to find attendees. **Runner details** opens the run roster and profile information, including emergency contacts where provided.

Wait for data to finish loading. If the page reports a sync problem, retry before relying on the counts or assisting someone. Pet totals count runners marked as participating with a pet, not individual animals.

## Assist a runner's check-in

1. Select **Assist check-in** during the normal window.
2. Search registered profiles by name or email and select the correct person.
3. Confirm their saved route, permitted loops, activity and pet choice.
4. Review the credited mileage and submit the final confirmation.
5. Wait for success and confirm the runner appears in the feed.

Visitors must register first. Staff assistance uses the same two-hours-before-start to midnight Pacific window; there is no staff bypass. Maintenance/import locks also pause assistance for admins. If the result is uncertain, retrying safely checks for existing attendance rather than adding another run.

Assistance creates missing attendance. It does not overwrite an existing check-in. The runner can edit their choices during the window; ask an admin about later corrections. The server retains a private audit of who assisted.

## Hand out milestone gear

In Table Mode, **Milestones & gear pickup** includes pending gear for the selected run's attendees, including earlier gear they are still owed. Check the runner's name, milestone, reward and shirt size, then choose **Mark delivered** after handing it over.

Recognition-only milestones have no delivery button. Delivered gear stays in history. The run card's **Check-ins** view also supports per-run attendance, runner details and gear handouts. Admins have the club-wide queue in **Milestones & Gear**.

## Manage routes

Open **Routes** to create a route in Route Studio or use **Import routes** for a CSV/GPX collection. Preview imports and fix errors before saving. See [route import instructions](../route-import.md).

On a library card, use **Organizer tools → Edit route**; a selected map also has **Organizer tools → Edit Route**. Review geometry, measured distance, loop options, directions and external links before attaching a route to a run. Editing an unused route updates it in place. Editing one referenced by a run creates a new route version, preserving the original for existing runs. Referenced routes cannot be deleted. Follow the editor's validation rather than deleting a referenced route to force an update.

## Admin-only work

Open **profile → Organizer tools → Admin Portal**, or the admin navigation entry.

| Area | Common work |
| --- | --- |
| Runners & Claims | Search profiles, manage historical-name assignments, promote/demote other accounts and review imports. |
| Check-In Log | Review/filter the recent 60-day attendance scope and export it. For an older event, use its per-run Check-ins view; older records are retained. |
| Milestones & Gear | Manage milestone definitions and the club-wide pending/delivered gear queue. |
| Badges & Special Events | Manage badge definitions and special-event tags. |
| Push Alerts | Publish in-app announcements and inspect notification device registration. |
| Club maintenance | Pause club changes for planned repairs and explicitly resume them after verification. |

Announcements do not send phone pushes. Those currently use Firebase Console Messaging. Automatic run reminders are not implemented.

Users and check-ins may be deleted only by admins. Organizers can delete runs only before their check-in opens; later run deletion requires an admin and reverses dependent attendance/rewards. Routes in use are protected. Retain records indefinitely unless an authorized person explicitly requests deletion. Deployment and pagination never authorize cleanup. Read the [go-live policy](../go-live-policy.md) before any reset or historical replacement; the approved cutover is already complete.

## Instagram and Facebook status

Run creation offers **Prepare an Instagram / Facebook post after saving**. A published upcoming run also has **Create Instagram / Facebook post** under Organizer tools. The preview prepares one map photo per distinct attached route; two routes produce two photos in one post, with an editable caption.

**Club Meta access and server activation are still pending.** The preview can report an unavailable connection, and the current deployment cannot publish to those accounts. Saving a run is independent of social publication. Once activated, publication will require a separate explicit action after review. See [social publishing setup](../social-publishing.md); never put passwords or access tokens in a run, caption or repository file.
