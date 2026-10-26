import { describe, test, expect } from "bun:test";
import {
  type State,
  type AppsScriptResponse,
  MATCH_DURATION_MS,
  DEFAULT_RVB_SERVER_IP,
  RVB_SERVER_HOSTNAME,
  normalizeRvbServerIp,
  isRvbScoresResponse,
  rvbCandidateHosts,
  mapSheetData,
  applyStateUpdate,
  applyStart,
  applyEnd,
  applyReset,
  applyWinner,
} from "./handlers";

const baseState: State = {
  gameMode: "sumo",
  match: 1,
  team1: 10,
  team2: 20,
  team1Name: "Blue",
  team2Name: "Red",
  timerEnd: null,
  arrows: null,
  winner: null,
  ondeck1: null,
  ondeck2: null,
  autoAddTeams: true,
  rvbBlue1: 111,
  rvbBlue2: 112,
  rvbRed1: 211,
  rvbRed2: 212,
  rvbServerIp: "localhost",
};

describe("normalizeRvbServerIp", () => {
  test("normalizes hostname and strips protocol/path/port", () => {
    expect(normalizeRvbServerIp("http://127.0.0.1:8080/action")).toBe("127.0.0.1");
  });

  test("returns localhost for empty/invalid values", () => {
    expect(normalizeRvbServerIp("")).toBe("localhost");
    expect(normalizeRvbServerIp(":::")).toBe("localhost");
  });
});

const fullSheet: AppsScriptResponse = {
  matchNumber: 5,
  blueTeamNumber: 123,
  redTeamNumber: 456,
  blueTeamName: "Sparky",
  redTeamName: "Chomper",
  blueTeamMembers: "Alice, Bob",
  redTeamMembers: "Carol, Dave",
  blueOnDeck: 789,
  redOnDeck: 999,
};

// --- mapSheetData ---

describe("isRvbScoresResponse", () => {
  const scores = {
    redScore: 3, blueScore: 5, redAutoScore: 2, blueAutoScore: 0, redPens: 1, bluePens: 0,
    matchRunning: true, matchReady: false, auto: false, paused: false,
    displayedPhase: "Drive Your Robot!", timeRemaining: 90, redBlink: 0, blueBlink: 0,
  };

  test("accepts a scoring server /scores payload", () => {
    expect(isRvbScoresResponse(scores)).toBe(true);
  });

  test("rejects other JSON", () => {
    expect(isRvbScoresResponse(null)).toBe(false);
    expect(isRvbScoresResponse([])).toBe(false);
    expect(isRvbScoresResponse({ status: "ok" })).toBe(false);
    expect(isRvbScoresResponse({ ...scores, redScore: "3" })).toBe(false);
  });
});

describe("rvbCandidateHosts", () => {
  const wifi = { address: "10.176.71.83", family: "IPv4", internal: false };
  const ics = { address: "192.168.137.1", family: "IPv4", internal: false };
  const loopback = { address: "127.0.0.1", family: "IPv4", internal: true };

  test("tries the saved host first, then the default IP, hostname and localhost", () => {
    const { preferred } = rvbCandidateHosts("10.0.0.42", [wifi]);
    expect(preferred).toEqual(["10.0.0.42", DEFAULT_RVB_SERVER_IP, RVB_SERVER_HOSTNAME, "localhost"]);
  });

  test("does not repeat the saved host", () => {
    const { preferred } = rvbCandidateHosts(DEFAULT_RVB_SERVER_IP, []);
    expect(preferred).toEqual([DEFAULT_RVB_SERVER_IP, RVB_SERVER_HOSTNAME, "localhost"]);
  });

  test("skips the subnet scan when not on the ICS subnet", () => {
    expect(rvbCandidateHosts("localhost", [wifi, loopback]).scan).toEqual([]);
  });

  test("scans the ICS subnet except its own and already-preferred addresses", () => {
    const { scan } = rvbCandidateHosts("localhost", [wifi, ics, loopback]);
    expect(scan).toHaveLength(252);
    expect(scan).not.toContain("192.168.137.1");
    expect(scan).not.toContain(DEFAULT_RVB_SERVER_IP);
    expect(scan).toContain("192.168.137.2");
    expect(scan).toContain("192.168.137.254");
  });

  test("accepts numeric address families", () => {
    expect(rvbCandidateHosts("localhost", [{ ...ics, family: 4 }]).scan).toHaveLength(252);
  });
});

describe("mapSheetData", () => {
  test("maps a full response", () => {
    const row = mapSheetData(fullSheet);
    expect(row).toEqual({
      match: 5,
      team1: 123,
      team2: 456,
      team1Name: "Sparky",
      team2Name: "Chomper",
      team1Members: "Alice, Bob",
      team2Members: "Carol, Dave",
      ondeck1: 789,
      ondeck2: 999,
      rvbBlue1: 123,
      rvbBlue2: null,
      rvbRed1: 456,
      rvbRed2: null,
      rvbBlue1Name: "Sparky",
      rvbBlue2Name: "",
      rvbRed1Name: "Chomper",
      rvbRed2Name: "",
      rvbBlue1Members: "Alice, Bob",
      rvbBlue2Members: "",
      rvbRed1Members: "Carol, Dave",
      rvbRed2Members: "",
    });
  });

  test("returns null if matchNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, matchNumber: 0 })).toBeNull();
  });

  test("returns null if blueTeamNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, blueTeamNumber: 0 })).toBeNull();
  });

  test("returns null if redTeamNumber is missing", () => {
    expect(mapSheetData({ ...fullSheet, redTeamNumber: 0 })).toBeNull();
  });

  test("falls back to 'Blue'/'Red' when names are empty", () => {
    const row = mapSheetData({ ...fullSheet, blueTeamName: "", redTeamName: "" });
    expect(row?.team1Name).toBe("Blue");
    expect(row?.team2Name).toBe("Red");
  });

  test("ondeck is null when zero", () => {
    const row = mapSheetData({ ...fullSheet, blueOnDeck: 0, redOnDeck: 0 });
    expect(row?.ondeck1).toBeNull();
    expect(row?.ondeck2).toBeNull();
  });

  test("maps RvB second-team fields when present", () => {
    const row = mapSheetData({
      ...fullSheet,
      blueTeam2Number: 124,
      blueTeam2Name: "Zapper",
      blueTeam2Members: "Eve, Frank",
      redTeam2Number: 457,
      redTeam2Name: "Muncher",
      redTeam2Members: "Gabe, Hana",
    });
    expect(row?.rvbBlue2).toBe(124);
    expect(row?.rvbRed2).toBe(457);
    expect(row?.rvbBlue2Name).toBe("Zapper");
    expect(row?.rvbRed2Name).toBe("Muncher");
    expect(row?.rvbBlue2Members).toBe("Eve, Frank");
    expect(row?.rvbRed2Members).toBe("Gabe, Hana");
  });

  test("RvB second-team is null when #N/A string", () => {
    const row = mapSheetData({
      ...fullSheet,
      blueTeam2Number: "#N/A",
      redTeam2Number: "#N/A",
    });
    expect(row?.rvbBlue2).toBeNull();
    expect(row?.rvbRed2).toBeNull();
  });
});

// --- applyStateUpdate ---

describe("applyStateUpdate", () => {
  test("updates provided fields", () => {
    const next = applyStateUpdate(baseState, { match: 3, team1: 11, team1Name: "Voltage" }, "up-down");
    expect(next.match).toBe(3);
    expect(next.team1).toBe(11);
    expect(next.team1Name).toBe("Voltage");
    expect(next.team2).toBe(20); // unchanged
  });

  test("sets arrows to the provided value", () => {
    expect(applyStateUpdate(baseState, {}, "up-down").arrows).toBe("up-down");
    expect(applyStateUpdate(baseState, {}, "down-up").arrows).toBe("down-up");
  });

  test("clears winner", () => {
    const withWinner = { ...baseState, winner: "team1" as const };
    expect(applyStateUpdate(withWinner, {}, "up-down").winner).toBeNull();
  });

  test("preserves winner when sumo visuals are not refreshed", () => {
    const withWinner = { ...baseState, winner: "team1" as const };
    expect(applyStateUpdate(withWinner, {}, null).winner).toBe("team1");
  });

  test("ignores non-numeric team values", () => {
    const next = applyStateUpdate(baseState, { team1: "bad" as any }, "up-down");
    expect(next.team1).toBe(10); // unchanged
  });

  test("updates ondeck fields", () => {
    const next = applyStateUpdate(baseState, { ondeck1: 77, ondeck2: 88 }, "up-down");
    expect(next.ondeck1).toBe(77);
    expect(next.ondeck2).toBe(88);
  });

  test("updates rvb fields", () => {
    const next = applyStateUpdate(
      baseState,
      { gameMode: "rvb", rvbBlue1: 1, rvbBlue2: 2, rvbRed1: 3, rvbRed2: 4, rvbServerIp: "localhost:8080" },
      null,
    );
    expect(next.gameMode).toBe("rvb");
    expect(next.rvbBlue1).toBe(1);
    expect(next.rvbBlue2).toBe(2);
    expect(next.rvbRed1).toBe(3);
    expect(next.rvbRed2).toBe(4);
    expect(next.rvbServerIp).toBe("localhost");
  });

  test("an empty rvbServerIp falls back to the default scoring server IP", () => {
    const next = applyStateUpdate(baseState, { rvbServerIp: "  " }, null);
    expect(next.rvbServerIp).toBe(DEFAULT_RVB_SERVER_IP);
  });

  test("does not mutate the original state", () => {
    applyStateUpdate(baseState, { match: 99 }, "up-down");
    expect(baseState.match).toBe(1);
  });
});

// --- applyStart ---

describe("applyStart", () => {
  test("sets timerEnd to now + MATCH_DURATION_MS", () => {
    const now = 1_000_000;
    const next = applyStart(baseState, now);
    expect(next.timerEnd).toBe(now + MATCH_DURATION_MS);
  });

  test("clears arrows and winner", () => {
    const active = { ...baseState, arrows: "up-down" as const, winner: "team2" as const };
    const next = applyStart(active, Date.now());
    expect(next.arrows).toBeNull();
    expect(next.winner).toBeNull();
  });

  test("does not mutate the original state", () => {
    applyStart(baseState, Date.now());
    expect(baseState.timerEnd).toBeNull();
  });
});

// --- applyEnd ---

describe("applyEnd", () => {
  test("clears timerEnd but preserves winner", () => {
    const active = { ...baseState, timerEnd: Date.now() + 10000, winner: "team1" as const };
    const next = applyEnd(active);
    expect(next.timerEnd).toBeNull();
    expect(next.winner).toBe("team1");
  });

  test("preserves other fields", () => {
    const next = applyEnd({ ...baseState, match: 7 });
    expect(next.match).toBe(7);
  });
});

// --- applyReset ---

describe("applyReset", () => {
  test("clears timerEnd and winner", () => {
    const active = { ...baseState, timerEnd: Date.now() + 5000, winner: "team2" as const };
    const next = applyReset(active);
    expect(next.timerEnd).toBeNull();
    expect(next.winner).toBeNull();
  });

  test("preserves team and match info", () => {
    const next = applyReset({ ...baseState, match: 4, team1: 55 });
    expect(next.match).toBe(4);
    expect(next.team1).toBe(55);
  });
});

// --- applyWinner ---

describe("applyWinner", () => {
  test("sets winner=team1 and clears timer", () => {
    const active = { ...baseState, timerEnd: Date.now() + 30000 };
    const result = applyWinner(active, "team1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe("team1");
    expect(result.state.timerEnd).toBeNull();
  });

  test("sets winner=team2", () => {
    const result = applyWinner(baseState, "team2");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe("team2");
  });

  test("rejects invalid winner value", () => {
    const result = applyWinner(baseState, "team3");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/team1 or team2/);
  });

  test("rejects empty string", () => {
    expect(applyWinner(baseState, "").ok).toBe(false);
  });

  test("does not mutate the original state", () => {
    applyWinner(baseState, "team1");
    expect(baseState.winner).toBeNull();
  });
});
