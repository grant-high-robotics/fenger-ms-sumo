# Architecture

This document explains how the Fenger Management System works under the hood.

## System Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Admin UI  │◄────►│  Bun Server │◄────►│  OBS Overlay│
│  (browser)  │      │  (index.ts) │      │  (browser)  │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ Google   │  │ Google   │  │  RvB     │
       │ Apps     │  │ Sheets   │  │ Scoring  │
       │ Script   │  │          │  │ Server   │
       └──────────┘  └──────────┘  └──────────┘
```

The entire application is a single Bun process serving two HTML UIs and a JSON API. There is no database - all state lives in memory.

## Server (`index.ts`)

`index.ts` creates a `Bun.serve()` instance with flat route definitions. Each route handler:

1. Validates input (if any)
2. Calls a pure function from `handlers.ts` to compute the next state
3. Mutates the in-memory `state` object with `Object.assign`
4. Returns JSON (or plain text for exports)

The server also handles external communication:
- **Apps Script:** `fetchAppsScript()` and `fetchSheetRow()` read match data. `POST /api/export` writes results back.
- **RvB Server:** `fetchRvbScores()` and `postRvbAction()` proxy scoring operations.

## State Handlers (`handlers.ts`)

All state transitions are pure functions:

| Function | Purpose |
|----------|---------|
| `applyStateUpdate` | Merges a partial update into the current state, optionally sets arrows |
| `applyStart` | Sets `timerEnd` to `now + MATCH_DURATION_MS`, clears arrows and winner |
| `applyEnd` | Clears `timerEnd` |
| `applyReset` | Clears `timerEnd` and `winner` |
| `applyWinner` | Sets `winner` and clears `timerEnd` |
| `mapSheetData` | Converts Apps Script response into the internal row format |
| `normalizeRvbServerIp` | Sanitizes the RvB server IP input |
| `isRvbScoresResponse` | Checks that a `/scores` reply really came from the scoring server |
| `rvbCandidateHosts` | Builds the ordered list of hosts that scoring server discovery probes |

This purity makes the logic trivial to unit test. See `handlers.test.ts`.

## In-Memory State

```ts
const state: State = {
  gameMode: "sumo",
  match: 1,
  team1: 1,
  team2: 2,
  team1Name: "Blue",
  team2Name: "Red",
  timerEnd: null,
  arrows: null,
  winner: null,
  ondeck1: null,
  ondeck2: null,
  autoAddTeams: true,
  rvbBlue1: 1,
  rvbBlue2: 2,
  rvbRed1: 3,
  rvbRed2: 4,
  rvbServerIp: "192.168.137.100",
};
```

Because there is no database, restarting the server resets all state to defaults. This is acceptable for a live event tool where state is ephemeral.

## Admin Panel (`admin.html`)

The admin panel is a single HTML file with embedded CSS and JavaScript. It:

- Loads the current state on page load (`load()`)
- Polls RvB scores every second when in RvB mode
- Updates the timer display locally using `setInterval`
- Calls the JSON API for all mutations (save, start, winner, etc.)

Key UI behaviors:
- **Mode switch** toggles between Sumo and RvB panels.
- **Match start** disables editing and shows winner buttons.
- **Winner pick** stops the timer and triggers export.
- **Sheet load** fetches data and auto-saves it to the server state.

## OBS Overlay (`overlay.html`)

The overlay is a transparent HTML page designed to be composited over video. It:

- Polls `/api/state` every second (`setInterval(poll, 1000)`)
- Switches between Sumo and RvB layouts based on `gameMode`
- For Sumo: shows/hides timer, arrows, on-deck labels, and winner banner
- For RvB: polls `/api/rvb-scores` and updates score cards

### Overlay Visibility Rules

**Sumo mode:**
- Timer is hidden until `timerEnd` is set
- Arrows appear only when `arrows` is non-null
- On-deck labels appear only when `ondeck1`/`ondeck2` are non-null
- Winner banner hides **all** other match elements when `winner` is set

**RvB mode:**
- Sumo root is hidden entirely
- RvB root is shown with alliance cards and header
- Scores update live from the external server

## Google Apps Script Integration

The Apps Script (`apps-script.gs`) acts as a bridge between FMS and Google Sheets.

### Authentication

A shared secret token (`fengermanagementsystem`) is hardcoded in both `index.ts` and `apps-script.gs`. All requests include this token.

### Reading Data (`doGet`)

1. Authenticates the request
2. Optionally triggers `setTeams(false)` if `autoAddTeams=true`
3. Reads the last row from the "All Matches" sheet
4. Reads rows 2 and 3 from "P8 Sumo Next Plays" for on-deck teams
5. Returns JSON with match and on-deck data

### Writing Data (`doPost`)

1. Authenticates the request
2. Finds the row matching `matchNumber`
3. For **RvB**: writes winner, scores, auto scores, and penalties
4. For **Sumo**: writes `TRUE` to `Blue Sumo Win` or `Red Sumo Win` column
5. Returns `"Scores Updated"` or `"Match Not Found"`

## RvB Scoring Server Proxy

FMS does not implement RvB scoring logic itself. Instead, it proxies commands to an external server on port `8080`.

### Why Proxy?

- Decouples the overlay/admin from the scoring server's network location
- Allows the overlay to show RvB data through a single origin (avoids CORS issues)
- Centralizes configuration (IP is stored in FMS state)

### Finding the Scoring Server

The Windows laptop shares its connection over Ethernet (Internet Connection Sharing), which puts it at `192.168.137.1`. The Pi has a static `192.168.137.100` on that link and advertises `rpi-fms.local`. So `192.168.137.100` is the default `rvbServerIp`.

If a request to the scoring server fails to connect or times out (2s), `discoverRvbServer()` probes candidates from `rvbCandidateHosts()` in parallel. It tries the saved host, `192.168.137.100`, `rpi-fms.local` and `localhost` first, then the rest of `192.168.137.0/24` when the laptop has an address there. A host counts only if its `/scores` reply passes `isRvbScoresResponse()`, and the earliest match in that order wins. The result replaces `rvbServerIp`, and the failed request is retried once on it. HTTP error responses don't trigger discovery, because they mean the server is reachable. Only one search runs at a time, and after a failed search automatic searches pause for 10 seconds. Discovery also runs once at startup.

The admin panel shows the connection status under the server field and has a **Find** button (`POST /api/rvb-discovery`). It only sends `rvbServerIp` when the operator has edited the field, so a host found by discovery isn't overwritten by the next RvB action.

### Flow

```
Admin UI ──► FMS /api/rvb-action ──► RvB Server POST /action
Admin UI ──► FMS /api/rvb-scores ──► RvB Server GET /scores
Overlay ───► FMS /api/rvb-scores ──► RvB Server GET /scores
```

## Timer Mechanism

There is no server-side timer loop. The timer works like this:

1. `POST /api/start` sets `timerEnd = Date.now() + MATCH_DURATION_MS`
2. Admin and overlay calculate remaining time locally: `Math.ceil((timerEnd - Date.now()) / 1000)`
3. `POST /api/winner` or `POST /api/end` sets `timerEnd = null`

This avoids server-side state management complexity and keeps the system resilient to clock skew (as long as server and clients are roughly in sync).

## Data Flow Examples

### Starting a Sumo Match

```
Admin clicks "Start Match"
  └──► POST /api/start
         └──► applyStart(state, Date.now())
                └──► state.timerEnd = now + 120000
  └──► Response: { ..., timerEnd: 1715000000000, ... }
Overlay polls GET /api/state
  └──► Sees timerEnd, starts local countdown
Admin UI sees timerEnd, disables editing, shows winner buttons
```

### Declaring a Winner

```
Admin clicks "Blue Wins"
  └──► POST /api/winner { winner: "team1" }
         └──► applyWinner(state, "team1")
                └──► state.winner = "team1", timerEnd = null
  └──► Auto-export: POST /api/export
         └──► POST to Apps Script
                └──► Sheet updated
Overlay polls GET /api/state
  └──► Sees winner, hides all match elements, shows winner banner
```

### Loading from Sheet

```
Admin clicks "Load from Sheet"
  └──► GET /api/sheet
         └──► fetchAppsScript()
                └──► GET Apps Script URL
         └──► mapSheetData(response)
  └──► Response: { match, team1, team2, team1Name, team2Name, ondeck1, ondeck2, ... }
Admin UI auto-saves: POST /api/state with loaded data
  └──► Arrows randomized, winner cleared
```
