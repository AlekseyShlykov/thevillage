# Analytics (Google Apps Script) — Setup

The game sends analytics to a Google Apps Script Web App. Two sheets are used:

- **Events** — every event (site open, game start, each season change, game over, demo end, email submitted)
- **Players** — one row per session (aggregated: max winters, max buildings, outcome, email submitted)

## 1. Create a Google Sheet

1. Create a new Google Sheet.
2. Rename the first sheet to **Events**.
3. Add a second sheet: **Players**.

## 2. Events sheet — headers (row 1)

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| session_id | ts | event_type | season | year | play_time_seconds | winters_survived | buildings_count | outcome | email_submitted |

## 3. Players sheet — headers (row 1)

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| session_id | first_ts | last_ts | game_started | total_play_time_seconds | max_winters_survived | max_buildings | outcome | email_submitted |

## 4. Add the script

1. In the sheet: **Extensions** → **Apps Script**.
2. Delete any sample code and paste the script below.
3. Save (Ctrl+S). Name the project e.g. "Game Analytics".

## 5. Deploy as Web App

1. Click **Deploy** → **New deployment**.
2. Type: **Web app**.
3. Description: e.g. "Analytics endpoint".
4. **Execute as**: Me.
5. **Who has access**: Anyone (so the game can POST from the browser).
6. Click **Deploy**, authorize if asked, then copy the **Web app URL** (ends with `/exec`).

## 6. Configure the game

In `public/data/game-balance.json`, set your URL:

```json
"analytics": {
  "analyticsUrl": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
}
```

Replace the placeholder with the Web app URL from step 5.

---

## Google Apps Script code

```javascript
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No body' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var eventsSheet = ss.getSheetByName('Events');
    var playersSheet = ss.getSheetByName('Players');
    if (!eventsSheet || !playersSheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sheets Events/Players not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Append to Events
    eventsSheet.appendRow([
      payload.session_id || '',
      payload.ts || '',
      payload.event_type || '',
      payload.season || '',
      payload.year !== undefined ? payload.year : '',
      payload.play_time_seconds !== undefined ? payload.play_time_seconds : '',
      payload.winters_survived !== undefined ? payload.winters_survived : '',
      payload.buildings_count !== undefined ? payload.buildings_count : '',
      payload.outcome || '',
      payload.event_type === 'email_submitted' ? true : (payload.email_submitted === true)
    ]);

    // Update or append Players
    var sid = payload.session_id;
    if (!sid) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var pData = playersSheet.getDataRange().getValues();
    var header = pData[0];
    var sidCol = header.indexOf('session_id');
    if (sidCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var rowIndex = -1;
    for (var i = 1; i < pData.length; i++) {
      if (pData[i][sidCol] === sid) {
        rowIndex = i;
        break;
      }
    }

    var ts = payload.ts || '';
    var playTime = payload.play_time_seconds !== undefined ? payload.play_time_seconds : 0;
    var winters = payload.winters_survived !== undefined ? payload.winters_survived : 0;
    var buildings = payload.buildings_count !== undefined ? payload.buildings_count : 0;
    var outcome = payload.outcome || '';
    var emailSubmitted = payload.event_type === 'email_submitted' || payload.email_submitted === true;

    if (rowIndex === -1) {
      playersSheet.appendRow([
        sid,
        ts,
        ts,
        payload.event_type === 'game_started',
        playTime,
        winters,
        buildings,
        outcome,
        emailSubmitted
      ]);
    } else {
      var row = pData[rowIndex];
      var lastTs = ts || row[2];
      var totalPlay = Math.max(Number(row[4]) || 0, playTime);
      var maxWinters = Math.max(Number(row[5]) || 0, winters);
      var maxBuildings = Math.max(Number(row[6]) || 0, buildings);
      var out = row[7] || outcome;
      if (outcome === 'game_over' || outcome === 'demo_end') out = outcome;
      var email = row[8] === true || emailSubmitted;
      playersSheet.getRange(rowIndex + 1, 2, rowIndex + 1, 9).setValues([[lastTs, lastTs, row[3], totalPlay, maxWinters, maxBuildings, out, email]]);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## Event types

| event_type     | When |
|----------------|------|
| site_open      | Page loaded, before intro |
| game_started   | User clicked "Start game" |
| season_change  | Every season change (spring/summer/autumn/winter) |
| game_over      | All villagers died |
| demo_end       | Reached spring of year 9 |
| email_submitted| User submitted email on Game Over or Demo End screen |

**Outcome** on Events: `playing` (during play), `game_over`, or `demo_end`.  
**Outcome** on Players: last known outcome for that session (so "simply left" = last row had `playing` and no later game_over/demo_end).

---

## Troubleshooting: events not appearing

1. **CORS** — The game sends POST with `Content-Type: text/plain` so the browser does not send a preflight OPTIONS request (Google Apps Script only handles GET/POST). If you changed the client to use `application/json`, change it back to `text/plain`.

2. **Deploy as "Anyone"** — In Apps Script: **Deploy** → **Manage deployments** → ensure "Who has access" is **Anyone** (so the game on GitHub Pages can call the URL).

3. **Correct URL in production** — On GitHub Pages the game loads `game-balance.json` from the repo. Ensure the pushed `public/data/game-balance.json` contains the real `analytics.analyticsUrl` (no placeholder). Hard-refresh the site (Ctrl+Shift+R) to avoid cache.

4. **Browser console** — Open DevTools (F12) → Network. Play the game (open site, start game, wait for a season change). Check for a POST to `script.google.com`: if it’s red or blocked, note the error (CORS, 403, etc.).

5. **Script errors** — In Apps Script, **Executions** (left menu) shows recent runs. If POSTs arrive but rows don’t appear, check for errors there.
