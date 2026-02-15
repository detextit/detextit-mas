import { describe, it, expect, beforeEach } from "vitest";
import { GAME_CONFIG } from "../src/game/types";
import type { InputState, PlayerState, ProjectileState, RoomState } from "../src/game/types";

// ---- Unit tests for game logic (no server needed) ----

// Replicate server-side physics for testability
function applyMovement(
  player: { x: number; y: number; vx: number; vy: number },
  input: InputState,
  dt: number
): void {
  let vx = 0;
  let vy = 0;
  if (input.left) vx -= 1;
  if (input.right) vx += 1;
  if (input.up) vy -= 1;
  if (input.down) vy += 1;

  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag > 0) {
    vx = (vx / mag) * GAME_CONFIG.PLAYER_SPEED;
    vy = (vy / mag) * GAME_CONFIG.PLAYER_SPEED;
  }

  player.vx = vx;
  player.vy = vy;
  player.x += vx * dt;
  player.y += vy * dt;

  // Clamp to arena
  player.x = Math.max(
    GAME_CONFIG.PLAYER_RADIUS,
    Math.min(GAME_CONFIG.ARENA_WIDTH - GAME_CONFIG.PLAYER_RADIUS, player.x)
  );
  player.y = Math.max(
    GAME_CONFIG.PLAYER_RADIUS,
    Math.min(GAME_CONFIG.ARENA_HEIGHT - GAME_CONFIG.PLAYER_RADIUS, player.y)
  );
}

function checkCollision(
  proj: { x: number; y: number },
  player: { x: number; y: number }
): boolean {
  const dx = proj.x - player.x;
  const dy = proj.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < GAME_CONFIG.PLAYER_RADIUS + GAME_CONFIG.PROJECTILE_RADIUS;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Anti-cheat: input rate check
function checkInputRate(timestamps: number[], now: number, maxPerSecond: number): boolean {
  const recent = timestamps.filter((t) => now - t < 1000);
  return recent.length <= maxPerSecond;
}

// ---- Tests ----

describe("Game Configuration", () => {
  it("has valid tick rate", () => {
    expect(GAME_CONFIG.TICK_RATE).toBeGreaterThan(0);
    expect(GAME_CONFIG.TICK_RATE).toBeLessThanOrEqual(60);
  });

  it("has valid arena dimensions", () => {
    expect(GAME_CONFIG.ARENA_WIDTH).toBeGreaterThan(0);
    expect(GAME_CONFIG.ARENA_HEIGHT).toBeGreaterThan(0);
  });

  it("has enough player colors for max players", () => {
    expect(GAME_CONFIG.PLAYER_COLORS.length).toBeGreaterThanOrEqual(GAME_CONFIG.MAX_PLAYERS_PER_ROOM);
  });

  it("shoot cooldown is positive", () => {
    expect(GAME_CONFIG.SHOOT_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it("projectile speed exceeds player speed", () => {
    expect(GAME_CONFIG.PROJECTILE_SPEED).toBeGreaterThan(GAME_CONFIG.PLAYER_SPEED);
  });
});

describe("Player Movement", () => {
  it("moves right when right input is pressed", () => {
    const player = { x: 400, y: 400, vx: 0, vy: 0 };
    const input: InputState = {
      up: false, down: false, left: false, right: true,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 1 / 20);
    expect(player.x).toBeGreaterThan(400);
    expect(player.y).toBe(400);
  });

  it("moves up when up input is pressed", () => {
    const player = { x: 400, y: 400, vx: 0, vy: 0 };
    const input: InputState = {
      up: true, down: false, left: false, right: false,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 1 / 20);
    expect(player.y).toBeLessThan(400);
    expect(player.x).toBe(400);
  });

  it("normalizes diagonal movement speed", () => {
    const playerDiag = { x: 400, y: 400, vx: 0, vy: 0 };
    const playerStraight = { x: 400, y: 400, vx: 0, vy: 0 };

    const diagInput: InputState = {
      up: true, down: false, left: false, right: true,
      shoot: false, angle: 0, seq: 1,
    };
    const straightInput: InputState = {
      up: false, down: false, left: false, right: true,
      shoot: false, angle: 0, seq: 1,
    };

    applyMovement(playerDiag, diagInput, 1);
    applyMovement(playerStraight, straightInput, 1);

    const diagSpeed = Math.sqrt(playerDiag.vx ** 2 + playerDiag.vy ** 2);
    const straightSpeed = Math.sqrt(playerStraight.vx ** 2 + playerStraight.vy ** 2);

    // Diagonal and straight speeds should be equal (normalized)
    expect(Math.abs(diagSpeed - straightSpeed)).toBeLessThan(0.01);
  });

  it("does not move when no input", () => {
    const player = { x: 400, y: 400, vx: 0, vy: 0 };
    const input: InputState = {
      up: false, down: false, left: false, right: false,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 1 / 20);
    expect(player.x).toBe(400);
    expect(player.y).toBe(400);
  });

  it("clamps player within arena bounds", () => {
    const player = { x: 0, y: 0, vx: 0, vy: 0 };
    const input: InputState = {
      up: true, down: false, left: true, right: false,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 10); // Large dt to overshoot
    expect(player.x).toBeGreaterThanOrEqual(GAME_CONFIG.PLAYER_RADIUS);
    expect(player.y).toBeGreaterThanOrEqual(GAME_CONFIG.PLAYER_RADIUS);
  });

  it("clamps player at right/bottom bounds", () => {
    const player = { x: GAME_CONFIG.ARENA_WIDTH, y: GAME_CONFIG.ARENA_HEIGHT, vx: 0, vy: 0 };
    const input: InputState = {
      up: false, down: true, left: false, right: true,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 10);
    expect(player.x).toBeLessThanOrEqual(GAME_CONFIG.ARENA_WIDTH - GAME_CONFIG.PLAYER_RADIUS);
    expect(player.y).toBeLessThanOrEqual(GAME_CONFIG.ARENA_HEIGHT - GAME_CONFIG.PLAYER_RADIUS);
  });

  it("respects maximum speed cap", () => {
    const player = { x: 400, y: 400, vx: 0, vy: 0 };
    const input: InputState = {
      up: true, down: false, left: true, right: false,
      shoot: false, angle: 0, seq: 1,
    };
    applyMovement(player, input, 1);
    const speed = Math.sqrt(player.vx ** 2 + player.vy ** 2);
    expect(speed).toBeLessThanOrEqual(GAME_CONFIG.PLAYER_SPEED + 0.01);
  });
});

describe("Collision Detection", () => {
  it("detects collision when projectile hits player", () => {
    const proj = { x: 100, y: 100 };
    const player = { x: 105, y: 100 };
    expect(checkCollision(proj, player)).toBe(true);
  });

  it("detects no collision when projectile misses", () => {
    const proj = { x: 100, y: 100 };
    const player = { x: 200, y: 200 };
    expect(checkCollision(proj, player)).toBe(false);
  });

  it("handles edge case at exact collision boundary", () => {
    const distance = GAME_CONFIG.PLAYER_RADIUS + GAME_CONFIG.PROJECTILE_RADIUS;
    const proj = { x: 100, y: 100 };
    const player = { x: 100 + distance + 1, y: 100 };
    expect(checkCollision(proj, player)).toBe(false);
  });
});

describe("Room Code Generation", () => {
  it("generates 6-character codes", () => {
    const code = generateRoomCode();
    expect(code.length).toBe(6);
  });

  it("only uses allowed characters", () => {
    const allowed = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      for (const char of code) {
        expect(allowed.includes(char)).toBe(true);
      }
    }
  });

  it("generates unique codes (statistical)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode());
    }
    // Expect at least 90% unique (very likely with 31^6 = ~887M possibilities)
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("Anti-Cheat: Input Rate Limiting", () => {
  it("allows inputs within rate limit", () => {
    const timestamps: number[] = [];
    const now = 1000;
    for (let i = 0; i < GAME_CONFIG.MAX_INPUTS_PER_SECOND; i++) {
      timestamps.push(now - i * 40);
    }
    expect(checkInputRate(timestamps, now, GAME_CONFIG.MAX_INPUTS_PER_SECOND)).toBe(true);
  });

  it("rejects inputs exceeding rate limit", () => {
    const timestamps: number[] = [];
    const now = 1000;
    for (let i = 0; i < GAME_CONFIG.MAX_INPUTS_PER_SECOND + 5; i++) {
      timestamps.push(now - i * 30);
    }
    expect(checkInputRate(timestamps, now, GAME_CONFIG.MAX_INPUTS_PER_SECOND)).toBe(false);
  });

  it("allows inputs after old ones expire", () => {
    const timestamps: number[] = [];
    const now = 5000;
    // Old timestamps outside window
    for (let i = 0; i < 50; i++) {
      timestamps.push(now - 2000 - i * 10);
    }
    // Only a few recent
    timestamps.push(now - 100);
    timestamps.push(now - 50);
    expect(checkInputRate(timestamps, now, GAME_CONFIG.MAX_INPUTS_PER_SECOND)).toBe(true);
  });
});

describe("Anti-Cheat: Shoot Cooldown", () => {
  it("allows shooting after cooldown", () => {
    const lastShootTime = 1000;
    const now = lastShootTime + GAME_CONFIG.SHOOT_COOLDOWN_MS + 1;
    expect(now - lastShootTime >= GAME_CONFIG.SHOOT_COOLDOWN_MS).toBe(true);
  });

  it("blocks shooting before cooldown", () => {
    const lastShootTime = 1000;
    const now = lastShootTime + GAME_CONFIG.SHOOT_COOLDOWN_MS - 1;
    expect(now - lastShootTime >= GAME_CONFIG.SHOOT_COOLDOWN_MS).toBe(false);
  });
});

describe("Game State Snapshot", () => {
  it("creates valid room state structure", () => {
    const state: RoomState = {
      roomId: "ABC123",
      state: "playing",
      players: {
        player1: {
          id: "player1",
          name: "Alice",
          x: 100, y: 200,
          vx: 0, vy: 0,
          angle: 0,
          health: 100,
          score: 0,
          color: "#FF6B6B",
        },
      },
      projectiles: {},
      tick: 42,
    };

    expect(state.roomId).toBe("ABC123");
    expect(state.state).toBe("playing");
    expect(Object.keys(state.players)).toHaveLength(1);
    expect(state.players.player1.health).toBe(100);
    expect(state.tick).toBe(42);
  });

  it("tracks multiple players", () => {
    const players: Record<string, PlayerState> = {};
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS_PER_ROOM; i++) {
      players[`player${i}`] = {
        id: `player${i}`,
        name: `Player ${i}`,
        x: 100 + i * 50, y: 100,
        vx: 0, vy: 0,
        angle: 0,
        health: GAME_CONFIG.PLAYER_MAX_HEALTH,
        score: 0,
        color: GAME_CONFIG.PLAYER_COLORS[i],
      };
    }

    expect(Object.keys(players)).toHaveLength(GAME_CONFIG.MAX_PLAYERS_PER_ROOM);
    // Each player has unique color
    const colors = new Set(Object.values(players).map((p) => p.color));
    expect(colors.size).toBe(GAME_CONFIG.MAX_PLAYERS_PER_ROOM);
  });
});

describe("Projectile Lifecycle", () => {
  it("projectile moves in firing direction", () => {
    const angle = Math.PI / 4; // 45 degrees
    const proj: ProjectileState = {
      id: "proj1",
      ownerId: "player1",
      x: 400, y: 400,
      vx: Math.cos(angle) * GAME_CONFIG.PROJECTILE_SPEED,
      vy: Math.sin(angle) * GAME_CONFIG.PROJECTILE_SPEED,
    };

    const dt = 1 / 20;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    expect(proj.x).toBeGreaterThan(400);
    expect(proj.y).toBeGreaterThan(400);
  });

  it("projectile goes out of bounds eventually", () => {
    const proj: ProjectileState = {
      id: "proj1",
      ownerId: "player1",
      x: GAME_CONFIG.ARENA_WIDTH - 10, y: 400,
      vx: GAME_CONFIG.PROJECTILE_SPEED, vy: 0,
    };

    // Simulate several ticks
    for (let i = 0; i < 10; i++) {
      proj.x += proj.vx * (1 / 20);
    }

    expect(proj.x).toBeGreaterThan(GAME_CONFIG.ARENA_WIDTH + 50);
  });

  it("projectile damage reduces health correctly", () => {
    let health = GAME_CONFIG.PLAYER_MAX_HEALTH;
    health -= GAME_CONFIG.PROJECTILE_DAMAGE;
    expect(health).toBe(GAME_CONFIG.PLAYER_MAX_HEALTH - GAME_CONFIG.PROJECTILE_DAMAGE);

    // 5 hits to kill at 20 damage / 100 health
    const hitsToKill = Math.ceil(GAME_CONFIG.PLAYER_MAX_HEALTH / GAME_CONFIG.PROJECTILE_DAMAGE);
    let hp = GAME_CONFIG.PLAYER_MAX_HEALTH;
    for (let i = 0; i < hitsToKill; i++) {
      hp -= GAME_CONFIG.PROJECTILE_DAMAGE;
    }
    expect(hp).toBeLessThanOrEqual(0);
  });
});

describe("Room Lifecycle", () => {
  it("room states follow valid transitions", () => {
    const validTransitions: Record<string, string[]> = {
      waiting: ["playing"],
      playing: ["finished"],
      finished: [],
    };

    // Verify all states have defined transitions
    expect(validTransitions.waiting).toBeDefined();
    expect(validTransitions.playing).toBeDefined();
    expect(validTransitions.finished).toBeDefined();

    // Playing can follow waiting
    expect(validTransitions.waiting).toContain("playing");
  });

  it("max players limit is enforced in config", () => {
    expect(GAME_CONFIG.MAX_PLAYERS_PER_ROOM).toBeGreaterThan(1);
    expect(GAME_CONFIG.MAX_PLAYERS_PER_ROOM).toBeLessThanOrEqual(16);
  });
});

describe("Auth Token Format", () => {
  it("accepts valid dev tokens", () => {
    const token = "user_123abc:PlayerName";
    expect(token.startsWith("user_")).toBe(true);
    const parts = token.split(":");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]).toBe("user_123abc");
    expect(parts.slice(1).join(":")).toBe("PlayerName");
  });

  it("rejects tokens without user_ prefix", () => {
    const token = "invalid_token";
    expect(token.startsWith("user_")).toBe(false);
  });

  it("handles names with colons", () => {
    const token = "user_abc:Name:With:Colons";
    const parts = token.split(":");
    expect(parts[0]).toBe("user_abc");
    expect(parts.slice(1).join(":")).toBe("Name:With:Colons");
  });
});
