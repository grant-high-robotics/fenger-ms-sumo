# Setup Guide

This guide walks you through installing, configuring, and running the Fenger Management System.

## Prerequisites

- [Bun](https://bun.sh) (latest version recommended)
- A Google Sheet with the expected columns (for Sumo / sheet integration)
- (Optional) An RvB scoring server on the same network (for Red vs Blue mode)

## Installation

1. **Clone or download the repository** to your local machine.

2. **Install dependencies:**

   ```bash
   bun install
   ```

   This installs Bun type definitions and TypeScript support. No heavy frameworks or build tools are required.

## Running the Server

### Development (with hot reload)

```bash
bun --hot index.ts
```

The `--hot` flag automatically restarts the server when you change `index.ts`, `handlers.ts`, or imported HTML files.

### Production / Standalone

You can compile to a standalone executable:

```bash
bun build --compile index.ts --target=bun-windows-x64-modern --outfile sumo
```

Then run the binary directly:

```bash
./sumo
```

## Default URLs

Once the server is running, the following URLs are available:

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/` | Admin control panel |
| `http://localhost:3000/overlay` | OBS Browser Source overlay |
| `http://localhost:3000/api/state` | Full state JSON (GET/POST) |

## Configuration

### Environment Variables

Bun automatically loads `.env` files. You can create a `.env` file in the project root to override defaults:

```env
# Optional: override the port (default 3000)
PORT=8080
```

> **Note:** The Apps Script URL and token are hardcoded in `index.ts`. If you need to change them, edit the source directly:
> - `APPS_SCRIPT_BASE` - the Google Apps Script web app URL
> - `TOKEN` - the shared secret for Apps Script authentication

### Google Sheets Integration

The Apps Script (`apps-script.gs`) reads from a Google Spreadsheet. To use your own sheet:

1. Create a new Google Sheet with the expected columns (see below).
2. Open **Extensions > Apps Script** and paste the contents of `apps-script.gs`.
3. Update `SPREADSHEET_ID` in the script to your sheet's ID.
4. Deploy the script as a **Web app** (Execute as: Me, Access: Anyone).
5. Copy the deployed URL and update `APPS_SCRIPT_BASE` in `index.ts`.

#### Expected Sheet Structure

**Sheet: "All Matches"**

| Column | Header |
|--------|--------|
| A | Match # |
| B | Red Team #1 |
| C | Robot Name RT1 |
| D | Team Members RT1 |
| E | Blue Team #1 |
| F | Robot Name BT1 |
| G | Team Members BT1 |
| H | Red Team #2 |
| I | Robot Name RT2 |
| J | Team Members RT2 |
| K | Blue Team #2 |
| L | Robot Name BT2 |
| M | Team Members BT2 |
| ... | Winner |
| ... | Blue Sumo Win |
| ... | Red Sumo Win |
| ... | Blue Balls |
| ... | Red Balls |
| ... | Blue Auto Balls |
| ... | Red Auto Balls |
| ... | Blue Goal Penalty |
| ... | Red Goal Penalty |

**Sheet: "P8 Sumo Next Plays"**

| Column | Header |
|--------|--------|
| ... | Team # |

Row 2 = Red on-deck, Row 3 = Blue on-deck.

### RvB Scoring Server

For Red vs Blue mode, an external scoring server must be reachable on port `8080`. The server must implement:

- `GET /scores` - returns current match scores and state
- `POST /action` - accepts scoring actions

See [RvB-API.md](../RvB-API.md) in the project root for the full protocol.

Enter the server's IP or hostname in the RvB admin panel (e.g., `10.0.0.42` or `fms-scoring.local`).

## OBS Setup

1. In OBS, add a **Browser Source** to your scene.
2. Set the URL to `http://localhost:3000/overlay`.
3. Set width and height to match your canvas (e.g., 1920x1080).
4. The overlay background is transparent, so it will composite cleanly over your camera feed.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `bun: command not found` | Install Bun from [bun.sh](https://bun.sh) |
| Port 3000 is in use | Kill the other process or change the port in `index.ts` |
| Sheet load fails | Verify the Apps Script URL and that the sheet is publicly readable by the script |
| RvB scores don't update | Click **Find** next to the scoring server field. If nothing is found, check that the Pi is on, the Ethernet cable is plugged in, and Windows Internet Connection Sharing is still enabled on the laptop's Ethernet adapter (the laptop must be `192.168.137.1`) |
| Overlay not showing in OBS | Ensure the Browser Source URL is correct and the server is running |
