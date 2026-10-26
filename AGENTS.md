# AGENTS.md

This file provides guidance to LLM coding agents when working with code in this repository.

## Project

OBS overlay + admin panel for two game modes: Sumo and Red vs Blue (RvB). Run with `bun --hot index.ts`.

Documentation lives in `docs/`:
- `docs/README.md` - overview and quick links
- `docs/SETUP.md` - installation, configuration, OBS setup
- `docs/USAGE.md` - admin panel and overlay user guide
- `docs/API.md` - HTTP API reference
- `docs/DEVELOPMENT.md` - developer guide
- `docs/ARCHITECTURE.md` - technical overview and data flows

If you add new features or change configuration/workflows, update the relevant docs files to keep them current.

- `index.ts` - Bun.serve() API server with in-memory state
- `admin.html` - Control panel at `/` for both modes: Sumo match controls and RvB scoring controls
- `overlay.html` - Transparent OBS Browser Source at `/overlay`, polls `/api/state` every second and switches layout by mode

## Running

```
bun --hot index.ts
```

No build step. Bun bundles HTML files (including any `.tsx`/`.css` imports) automatically at serve time.

## API routes

- `GET /api/state` - full state object
- `POST /api/state` - update match/team fields; also randomizes arrow direction and clears winner
- `POST /api/start` - start 2-minute match timer, clears arrows and winner
- `POST /api/end` - end match, clear timer and winner
- `POST /api/reset` - reset timer only (repeat match, no state changes)
- `POST /api/winner` - set `{ winner: "team1" | "team2" }`, stops timer; auto-triggers export
- `POST /api/export` - POST `{ token, matchNumber, redWin }` to Apps Script to record the result
- `GET /api/sheet` - fetch from Apps Script, returns `{ match, team1, team2, team1Name, team2Name, team1Members, team2Members, ondeck1, ondeck2 }`
- `GET /api/rvb-scores` - proxy to RvB scoring server `GET /scores`
- `GET /api/rvb-discovery` / `POST /api/rvb-discovery` - scoring server discovery status / search now (see `docs/ARCHITECTURE.md`, "Finding the Scoring Server")
- `GET /api/rvb-actions` - returns allowed RvB actions supported by `POST /api/rvb-action`
- `POST /api/rvb-action` - proxy to RvB scoring server `POST /action` with `{ action, count }`

## State shape

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
  autoAddTeams: boolean;     // when true, sends &autoAddTeams=true to Apps Script on sheet load
  rvbBlue1: number;          // Blue alliance team 1 (RvB mode)
  rvbBlue2: number;          // Blue alliance team 2 (RvB mode)
  rvbRed1: number;           // Red alliance team 1 (RvB mode)
  rvbRed2: number;           // Red alliance team 2 (RvB mode)
  rvbServerIp: string;       // scoring server host/IP; backend uses fixed port 8080; default 192.168.137.100, updated by discovery
}
```

## Google Apps Script integration

All sheet data is fetched from a single Google Apps Script endpoint (`APPS_SCRIPT_URL`) with a `token=fengermanagementsystem` query param. The script returns JSON with both match and on-deck data.

Response shape:
```json
{ "matchNumber", "blueTeamNumber", "redTeamNumber", "blueTeamName", "redTeamName", "blueTeamMembers", "redTeamMembers", "blueOnDeck", "redOnDeck" }
```

`fetchAppsScript(autoAddTeams?)` fetches once and returns the parsed response. `fetchSheetRow(autoAddTeams?)` delegates to it and passes the flag as `&autoAddTeams=true` on the GET URL when enabled. The "Load from Sheet" button does a single fetch, auto-saves to the overlay, and also fetches on-deck. No retry logic - the Apps Script serves fresh data directly.

RvB mode does not use Apps Script or spreadsheet data.

## Color mapping

- `team1` = Blue (left side of overlay)
- `team2` = Red (right side of overlay)

## Overlay layout

Team boxes are wrapped in `.team1-wrapper` / `.team2-wrapper` (fixed-positioned flex columns). The on-deck label sits above the team box inside the wrapper and is shown/hidden via the `.visible` class based on `state.ondeck1`/`ondeck2` being non-null. When `state.winner` is set, the match badge, timer, arrows, and both team wrappers are all hidden - only the winner banner is shown.

When `state.gameMode === "rvb"`, Sumo elements are hidden and the overlay shows RvB alliance cards (2 blue teams + 2 red teams) and live scores from the scoring server.

## Routing caveat

Bun.serve `routes` has issues with deeply nested paths like `/api/timer/start`. Use flat paths like `/api/start` instead.

---

Use Bun APIs throughout: `Bun.serve()` not express, `bun:sqlite` not better-sqlite3, `Bun.file` not `node:fs`. Bun automatically loads `.env`. Use `bun install` / `bunx` / `bun test`.

Bun API docs are in `node_modules/bun-types/docs/**.mdx`.
