export interface State {
  gameMode: "sumo" | "rvb";
  match: number;
  team1: number;
  team2: number;
  team1Name: string;
  team2Name: string;
  timerEnd: number | null;
  arrows: "up-down" | "down-up" | null;
  winner: "team1" | "team2" | null;
  ondeck1: number | null;
  ondeck2: number | null;
  autoAddTeams: boolean;
  rvbBlue1: number;
  rvbBlue2: number;
  rvbRed1: number;
  rvbRed2: number;
  rvbServerIp: string;
}

export interface AppsScriptResponse {
  matchNumber: number;
  blueTeamNumber: number;
  redTeamNumber: number;
  blueTeamName: string;
  redTeamName: string;
  blueTeamMembers: string;
  redTeamMembers: string;
  blueTeam2Number?: number | string;
  redTeam2Number?: number | string;
  blueTeam2Name?: string;
  redTeam2Name?: string;
  blueTeam2Members?: string;
  redTeam2Members?: string;
  blueOnDeck: number;
  redOnDeck: number;
}

export interface RvbScoresResponse {
  redScore: number;
  blueScore: number;
  redAutoScore: number;
  blueAutoScore: number;
  redPens: number;
  bluePens: number;
  matchRunning: boolean;
  matchReady: boolean;
  auto: boolean;
  paused: boolean;
  displayedPhase: string;
  timeRemaining: number;
  redBlink: number;
  blueBlink: number;
}

export const MATCH_DURATION_MS = 2 * 60 * 1000;

// The Pi has a static IP on the Windows Internet Connection Sharing subnet (192.168.137.0/24)
export const DEFAULT_RVB_SERVER_IP = "192.168.137.100";
export const RVB_SERVER_HOSTNAME = "rpi-fms.local";
const RVB_SCAN_PREFIX = "192.168.137.";

export interface RvbDiscovery {
  status: "idle" | "searching" | "found" | "not-found";
  host: string | null;
  checkedAt: number | null;
}

export interface InterfaceAddress {
  address: string;
  family: string | number;
  internal: boolean;
}

export function normalizeRvbServerIp(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "localhost";
  const withProtocol = /^[a-zA-Z]+:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname || "localhost";
  } catch {
    return "localhost";
  }
}

export function isRvbScoresResponse(data: unknown): data is RvbScoresResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  const numbers = ["redScore", "blueScore", "redAutoScore", "blueAutoScore", "redPens", "bluePens", "timeRemaining"];
  return numbers.every((key) => typeof d[key] === "number") &&
    typeof d.matchRunning === "boolean" &&
    typeof d.displayedPhase === "string";
}

// Hosts to probe for the scoring server: `preferred` first (in order), then `scan` (every
// address on the ICS subnet, only when this machine is on it).
export function rvbCandidateHosts(
  saved: string,
  interfaces: InterfaceAddress[],
): { preferred: string[]; scan: string[] } {
  const preferred = [...new Set([saved, DEFAULT_RVB_SERVER_IP, RVB_SERVER_HOSTNAME, "localhost"])];
  const own = interfaces
    .filter((a) => !a.internal && (a.family === "IPv4" || a.family === 4))
    .map((a) => a.address);
  if (!own.some((address) => address.startsWith(RVB_SCAN_PREFIX))) return { preferred, scan: [] };
  const scan: string[] = [];
  for (let i = 1; i <= 254; i++) {
    const host = `${RVB_SCAN_PREFIX}${i}`;
    if (!own.includes(host) && !preferred.includes(host)) scan.push(host);
  }
  return { preferred, scan };
}

function toTeamNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function mapSheetData(data: AppsScriptResponse): {
  match: number; team1: number; team2: number;
  team1Name: string; team2Name: string;
  team1Members: string; team2Members: string;
  ondeck1: number | null; ondeck2: number | null;
  rvbBlue1: number; rvbBlue2: number | null;
  rvbRed1: number; rvbRed2: number | null;
  rvbBlue1Name: string; rvbBlue2Name: string;
  rvbRed1Name: string; rvbRed2Name: string;
  rvbBlue1Members: string; rvbBlue2Members: string;
  rvbRed1Members: string; rvbRed2Members: string;
} | null {
  const { matchNumber: match, blueTeamNumber: team1, redTeamNumber: team2 } = data;
  if (!match || !team1 || !team2) return null;
  return {
    match,
    team1,
    team2,
    team1Name: data.blueTeamName || "Blue",
    team2Name: data.redTeamName || "Red",
    team1Members: data.blueTeamMembers || "",
    team2Members: data.redTeamMembers || "",
    ondeck1: data.blueOnDeck || null,
    ondeck2: data.redOnDeck || null,
    rvbBlue1: team1,
    rvbBlue2: toTeamNumber(data.blueTeam2Number),
    rvbRed1: team2,
    rvbRed2: toTeamNumber(data.redTeam2Number),
    rvbBlue1Name: data.blueTeamName || "",
    rvbBlue2Name: toText(data.blueTeam2Name),
    rvbRed1Name: data.redTeamName || "",
    rvbRed2Name: toText(data.redTeam2Name),
    rvbBlue1Members: data.blueTeamMembers || "",
    rvbBlue2Members: toText(data.blueTeam2Members),
    rvbRed1Members: data.redTeamMembers || "",
    rvbRed2Members: toText(data.redTeam2Members),
  };
}

export function applyStateUpdate(
  state: State,
  body: Partial<State>,
  arrows: "up-down" | "down-up" | null,
): State {
  const next = { ...state };
  if (body.gameMode === "sumo" || body.gameMode === "rvb") next.gameMode = body.gameMode;
  if (typeof body.match === "number") next.match = body.match;
  if (typeof body.team1 === "number") next.team1 = body.team1;
  if (typeof body.team2 === "number") next.team2 = body.team2;
  if (typeof body.team1Name === "string") next.team1Name = body.team1Name;
  if (typeof body.team2Name === "string") next.team2Name = body.team2Name;
  if (typeof body.ondeck1 === "number") next.ondeck1 = body.ondeck1;
  if (typeof body.ondeck2 === "number") next.ondeck2 = body.ondeck2;
  if (typeof body.autoAddTeams === "boolean") next.autoAddTeams = body.autoAddTeams;
  if (typeof body.rvbBlue1 === "number") next.rvbBlue1 = body.rvbBlue1;
  if (typeof body.rvbBlue2 === "number") next.rvbBlue2 = body.rvbBlue2;
  if (typeof body.rvbRed1 === "number") next.rvbRed1 = body.rvbRed1;
  if (typeof body.rvbRed2 === "number") next.rvbRed2 = body.rvbRed2;
  if (typeof body.rvbServerIp === "string") {
    next.rvbServerIp = body.rvbServerIp.trim() ? normalizeRvbServerIp(body.rvbServerIp) : DEFAULT_RVB_SERVER_IP;
  }

  if (arrows) {
    next.arrows = arrows;
    next.winner = null;
  }
  return next;
}

export function applyStart(state: State, now: number): State {
  return { ...state, timerEnd: now + MATCH_DURATION_MS, arrows: null, winner: null };
}

export function applyEnd(state: State): State {
  return { ...state, timerEnd: null };
}

export function applyReset(state: State): State {
  return { ...state, timerEnd: null, winner: null };
}

export function applyWinner(
  state: State,
  winner: string,
): { ok: true; state: State } | { ok: false; error: string } {
  if (winner !== "team1" && winner !== "team2") {
    return { ok: false, error: "winner must be team1 or team2" };
  }
  return {
    ok: true,
    state: { ...state, winner: winner as "team1" | "team2", timerEnd: null },
  };
}
