# API Reference

The FMS server exposes a JSON HTTP API on the same port as the web UI (default `3000`). All endpoints are flat paths (no deep nesting) due to a Bun.serve routing quirk.

## State Shape

```ts
{
  gameMode: "sumo" | "rvb";
  match: number;
  team1: number;        // Blue team number
  team2: number;        // Red team number
  team1Name: string;    // Blue robot name
  team2Name: string;    // Red robot name
  timerEnd: number | null;   // epoch ms when timer expires
  arrows: "up-down" | "down-up" | null;
  winner: "team1" | "team2" | null;
  ondeck1: number | null;    // Blue on-deck team number
  ondeck2: number | null;    // Red on-deck team number
  autoAddTeams: boolean;     // tournament mode flag
  rvbBlue1: number;          // Blue alliance team 1
  rvbBlue2: number;          // Blue alliance team 2
  rvbRed1: number;           // Red alliance team 1
  rvbRed2: number;           // Red alliance team 2
  rvbServerIp: string;       // scoring server host (default 192.168.137.100; updated by discovery)
}
```

## Endpoints

### `GET /api/state`

Returns the full current state object.

**Response:** `200 OK` - JSON state object

---

### `POST /api/state`

Partially updates the state. Only provided fields are changed. If any Sumo match fields are updated (`match`, `team1`, `team2`, `team1Name`, `team2Name`, `ondeck1`, `ondeck2`, `autoAddTeams`), arrows are randomized and the winner is cleared.

**Request body:** Partial state object

```json
{
  "match": 5,
  "team1": 101,
  "team1Name": "ThunderBot"
}
```

**Response:** `200 OK` - updated full state object

---

### `POST /api/start`

Starts the 2-minute match timer. Clears arrows and winner.

**Response:** `200 OK` - updated state with `timerEnd` set

---

### `POST /api/end`

Ends the match by clearing `timerEnd` and `winner`. No export occurs.

**Response:** `200 OK` - updated state

---

### `POST /api/reset`

Resets only the timer (`timerEnd = null` and `winner = null`). Use this to repeat a match without changing team info.

**Response:** `200 OK` - updated state

---

### `POST /api/winner`

Declares a winner. Stops the timer. Auto-triggers export to the sheet.

**Request body:**

```json
{ "winner": "team1" }
```

Valid values: `"team1"` (Blue) or `"team2"` (Red).

**Response:**
- `200 OK` - updated state
- `400 Bad Request` - invalid winner value

---

### `POST /api/export`

Exports the current match result to the Google Apps Script / Sheet.

For **Sumo**, exports `matchNumber` and `redWin` boolean.

For **RvB**, also fetches live scores and exports:
- `blueScore`, `redScore`
- `blueAutoScore`, `redAutoScore`
- `bluePens`, `redPens`

**Request body (optional):**

```json
{ "winner": "team1" }
```

If omitted, uses `state.winner`.

**Response:**
- `200 OK` - text response from Apps Script (e.g., `"Scores Updated"`)
- `502 Bad Gateway` - Apps Script error or network failure

---

### `GET /api/sheet`

Fetches the latest match row from the Google Apps Script endpoint. Returns both current match and on-deck data.

**Response:**
```json
{
  "match": 5,
  "team1": 101,
  "team2": 102,
  "team1Name": "ThunderBot",
  "team2Name": "LightningBot",
  "team1Members": "Alice, Bob",
  "team2Members": "Carol, Dave",
  "ondeck1": 103,
  "ondeck2": 104,
  "rvbBlue1": 101,
  "rvbBlue2": 103,
  "rvbRed1": 102,
  "rvbRed2": 104,
  "rvbBlue1Name": "ThunderBot",
  "rvbBlue2Name": "StormBot",
  "rvbRed1Name": "LightningBot",
  "rvbRed2Name": "FlashBot",
  "rvbBlue1Members": "Alice, Bob",
  "rvbBlue2Members": "Eve, Frank",
  "rvbRed1Members": "Carol, Dave",
  "rvbRed2Members": "Grace, Heidi"
}
```

- `404` if no data is found
- `502` if the Apps Script request fails

---

### `GET /api/rvb-scores`

Proxies `GET /scores` from the RvB scoring server.

**Response:** JSON score object from the RvB server, or `502` on failure.

If the server can't be reached, this (and `POST /api/rvb-action` and the RvB part of `POST /api/export`) runs scoring server discovery and retries once on the host it finds.

---

### `GET /api/rvb-discovery`

Returns the scoring server discovery status.

**Response:**
```json
{ "status": "found", "host": "192.168.137.100", "checkedAt": 1715000000000, "serverIp": "192.168.137.100" }
```

`status` is `idle`, `searching`, `found` or `not-found`. `host` is the last host found (or `null`), and `serverIp` is the host currently in use.

### `POST /api/rvb-discovery`

Searches for the scoring server now, ignoring the retry cooldown, and returns the same shape as the `GET` once the search finishes.

**Search order:** the current `rvbServerIp`, `192.168.137.100`, `rpi-fms.local`, `localhost`, then every address on `192.168.137.0/24` if this machine has an address there. A host counts only if its `GET /scores` returns a valid score object. After a failed search, automatic searches wait 10 seconds before trying again.

---

### `GET /api/rvb-actions`

Returns the list of allowed RvB action names.

**Response:**
```json
{
  "actions": [
    "start", "pause", "startTeleop", "clear",
    "redScoreUp", "redScoreDown", "blueScoreUp", "blueScoreDown",
    "redAutoUp", "redAutoDown", "blueAutoUp", "blueAutoDown",
    "redPenaltyUp", "redPenaltyDown", "bluePenaltyUp", "bluePenaltyDown"
  ]
}
```

---

### `POST /api/rvb-action`

Proxies a scoring action to the RvB server.

**Request body:**
```json
{
  "action": "redScoreUp",
  "count": 3
}
```

- `action` - must be one of the allowed actions
- `count` - optional, integer 1-100, defaults to 1

**Response:**
- `200 OK` - text response from the RvB server
- `400 Bad Request` - invalid action or count
- `502 Bad Gateway` - RvB server unreachable

---

## Error Handling

All endpoints return JSON on success. Errors may return plain text or JSON depending on the endpoint. Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request (invalid JSON or invalid field value) |
| `404` | Resource not found (e.g., no sheet data) |
| `502` | Upstream error (Apps Script or RvB server failed) |

## CORS

The server does not explicitly set CORS headers on API routes. If you need to call the API from a different origin, you may need to add CORS headers in `index.ts`.
