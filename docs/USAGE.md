# User Guide

This guide explains how to operate the Fenger Management System during an event. It covers both the **Admin Panel** (`/`) and the **OBS Overlay** (`/overlay`).

## Admin Panel Overview

Open `http://localhost:3000/` in a web browser. The admin panel is divided into sections based on the selected game mode.

### Switching Game Modes

At the top of the page, use the **Game Mode** dropdown to switch between:
- **Sumo** - 1v1 matches with timer
- **Red vs Blue** - 2v2 alliance matches with live scoring

The overlay automatically switches layouts when you change modes.

---

## Sumo Mode

### Setting Up a Match

1. **Enter match info manually** or click **Load from Sheet** to pull the latest row from the Google Sheet.
   - Match Number
   - Blue Team # and Name
   - Red Team # and Name
2. Click **Set Match Info** to save. This also randomizes the arrow direction and clears any previous winner.

### Auto Add Teams (Tournament Mode)

Check the **Auto Add Teams** checkbox to automatically register teams in the spreadsheet when loading from the sheet. This sends `&autoAddTeams=true` to the Apps Script.

### Starting a Match

Click **Start Match**. This:
- Starts a 2-minute countdown timer
- Hides the arrows
- Clears any previous winner
- Disables match info editing until the match ends

### During the Match

The timer counts down on the admin panel and overlay. When 30 seconds remain, the timer turns red on both displays.

### Declaring a Winner

When the match ends (or when a winner is clear), click:
- **Blue Wins** (team1) or
- **Red Wins** (team2)

This:
- Stops the timer
- Displays the winner banner on the overlay
- Automatically exports the result to the Google Sheet

### Ending Without a Winner

Click **End Match** to stop the timer without declaring a winner. No export occurs.

### On-Deck Teams

If on-deck data is loaded from the sheet, the overlay shows the next teams above the current team boxes. This helps viewers and commentators know what's coming next.

---

## Red vs Blue (RvB) Mode

### Configuration

1. Check the **Scoring Server IP / Hostname**. It defaults to the Pi's Ethernet address, `192.168.137.100`, and the dashboard searches for the Pi automatically if that stops answering. The line under the field shows whether it's connected. Click **Find** to search now, or type an address (e.g. `localhost` for simulation mode) to override it. Port is fixed at `8080`.
2. Enter the **Match Number**.
3. Enter the **Blue Alliance** team numbers (2 teams) and **Red Alliance** team numbers (2 teams).
4. You can also click **Load from Sheet** to populate these fields from the spreadsheet.
5. Click **Save RvB Config** to store the settings.

### Match Controls

The RvB panel provides buttons to control the external scoring server:

| Button | Effect |
|--------|--------|
| **Start / Resume** | Starts the match or toggles pause |
| **Pause / Resume** | Alias for start/resume |
| **Start Teleop** | Skips auto and starts teleop directly |
| **Clear Match** | Resets all scores and match state |
| **Red/Blue Score +/-** | Adjusts total score |
| **Red/Blue Auto +/-** | Adjusts autonomous score (+/- 2) |
| **Red/Blue Pen +/-** | Adjusts penalties |

### Live Scores

Scores, auto scores, penalties, match phase, and time remaining are polled from the RvB server every second and displayed in the admin panel.

### Declaring a Winner

Click **Blue Wins** or **Red Wins**. This exports the result to the Google Sheet including the full score breakdown (total, auto, penalties).

---

## Overlay Behavior

The overlay (`/overlay`) is designed to be used as an OBS Browser Source. It polls the server every second and updates automatically.

### Sumo Overlay Elements

- **Match Badge** - top-right, shows match number
- **Timer** - top-right below badge, hidden until match starts
- **Team Boxes** - bottom-left (Blue) and bottom-right (Red)
- **Arrows** - center, shows randomized direction when match info is set
- **On-Deck Labels** - above team boxes, shown only when data exists
- **Winner Banner** - center, hides everything else when a winner is set

### RvB Overlay Elements

- **Header** - top-center, shows match phase and time remaining
- **Blue Alliance Card** - bottom-left, shows total score, auto, penalties, and team numbers
- **Red Alliance Card** - bottom-right, same info for Red

### Important Overlay Rules

- When a **winner is set**, all match elements (badge, timer, teams, arrows) are hidden and only the **winner banner** is shown.
- The overlay background is **transparent** - it composites over your video feed.
- The overlay automatically switches between Sumo and RvB layouts when the game mode changes.

---

## Match Day Workflow Example (Sumo)

1. Load from Sheet to get the current match and on-deck teams.
2. Verify team names and numbers.
3. Click **Start Match** when the robots are ready.
4. Watch the timer. The match lasts 2 minutes.
5. When the match ends (or a winner is clear), click the winner button.
6. The result is automatically exported to the sheet.
7. Load from Sheet again to advance to the next match.

## Match Day Workflow Example (RvB)

1. Check that the line under the scoring server field says it's connected (click **Find** if not).
2. Load from Sheet or manually enter the 4 team numbers.
3. Click **Save RvB Config**.
4. Use the scoring controls to run the match.
5. When the match ends, click the winner button to export results.
