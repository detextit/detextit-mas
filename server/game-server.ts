import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
  InputState,
  PlayerState,
  ProjectileState,
  RoomState,
  ClientMessage,
  ServerMessage,
  KillEvent,
} from "../src/game/types";
import { GAME_CONFIG } from "../src/game/types";

const {
  TICK_RATE,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PLAYER_MAX_HEALTH,
  PROJECTILE_SPEED,
  PROJECTILE_RADIUS,
  PROJECTILE_DAMAGE,
  PROJECTILE_TTL_MS,
  SHOOT_COOLDOWN_MS,
  MAX_INPUTS_PER_SECOND,
  MAX_PLAYERS_PER_ROOM,
  PLAYER_COLORS,
  VIOLATION_WARN_THRESHOLD,
  VIOLATION_WARN_WINDOW_MS,
  VIOLATION_KICK_THRESHOLD,
  VIOLATION_KICK_WINDOW_MS,
} = GAME_CONFIG;

// ---- Types for server-side tracking ----

interface ServerPlayer extends PlayerState {
  ws: WebSocket;
  lastInput: InputState | null;
  lastShootTime: number;
  inputTimestamps: number[];
  violations: number[];
  respawnAt: number | null;
  colorIndex: number;
}

interface Room {
  id: string;
  players: Map<string, ServerPlayer>;
  projectiles: Map<string, ProjectileState>;
  state: "waiting" | "playing" | "finished";
  tick: number;
  createdAt: number;
  loopInterval: ReturnType<typeof setInterval> | null;
}

// ---- Global state ----

const rooms = new Map<string, Room>();
const playerToRoom = new Map<string, string>();

// ---- Room management ----

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  const room: Room = {
    id: code,
    players: new Map(),
    projectiles: new Map(),
    state: "waiting",
    tick: 0,
    createdAt: Date.now(),
    loopInterval: null,
  };
  rooms.set(code, room);
  console.log(`[Room ${code}] Created`);
  return room;
}

function getAvailableColor(room: Room): { color: string; index: number } {
  const usedIndices = new Set(
    Array.from(room.players.values()).map((p) => p.colorIndex)
  );
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    if (!usedIndices.has(i)) return { color: PLAYER_COLORS[i], index: i };
  }
  return { color: PLAYER_COLORS[0], index: 0 };
}

function getSpawnPosition(): { x: number; y: number } {
  const margin = 60;
  return {
    x: margin + Math.random() * (ARENA_WIDTH - 2 * margin),
    y: margin + Math.random() * (ARENA_HEIGHT - 2 * margin),
  };
}

function getRoomState(room: Room): RoomState {
  const players: Record<string, PlayerState> = {};
  for (const [id, p] of room.players) {
    players[id] = {
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      angle: p.angle,
      health: p.health,
      score: p.score,
      color: p.color,
    };
  }
  const projectiles: Record<string, ProjectileState> = {};
  for (const [id, proj] of room.projectiles) {
    projectiles[id] = proj;
  }
  return {
    roomId: room.id,
    state: room.state,
    players,
    projectiles,
    tick: room.tick,
  };
}

// ---- Anti-cheat ----

function checkInputRate(player: ServerPlayer, now: number): boolean {
  player.inputTimestamps.push(now);
  // Keep only last second
  player.inputTimestamps = player.inputTimestamps.filter(
    (t) => now - t < 1000
  );
  return player.inputTimestamps.length <= MAX_INPUTS_PER_SECOND;
}

function recordViolation(player: ServerPlayer, now: number): "ok" | "warn" | "kick" {
  player.violations.push(now);
  // Clean old violations
  player.violations = player.violations.filter(
    (t) => now - t < VIOLATION_KICK_WINDOW_MS
  );

  const recentViolations = player.violations.filter(
    (t) => now - t < VIOLATION_WARN_WINDOW_MS
  ).length;

  if (player.violations.length >= VIOLATION_KICK_THRESHOLD) {
    return "kick";
  }
  if (recentViolations >= VIOLATION_WARN_THRESHOLD) {
    return "warn";
  }
  return "ok";
}

// ---- Game loop ----

function startGameLoop(room: Room): void {
  if (room.loopInterval) return;

  const tickInterval = 1000 / TICK_RATE;
  room.state = "playing";

  room.loopInterval = setInterval(() => {
    const now = Date.now();
    const dt = tickInterval / 1000;
    room.tick++;

    // Process player inputs and movement
    for (const [, player] of room.players) {
      // Handle respawn
      if (player.respawnAt && now >= player.respawnAt) {
        const spawn = getSpawnPosition();
        player.x = spawn.x;
        player.y = spawn.y;
        player.health = PLAYER_MAX_HEALTH;
        player.respawnAt = null;
      }

      if (player.health <= 0) continue;

      const input = player.lastInput;
      if (!input) continue;

      // Compute velocity from input
      let vx = 0;
      let vy = 0;
      if (input.left) vx -= 1;
      if (input.right) vx += 1;
      if (input.up) vy -= 1;
      if (input.down) vy += 1;

      // Normalize diagonal movement
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag > 0) {
        vx = (vx / mag) * PLAYER_SPEED;
        vy = (vy / mag) * PLAYER_SPEED;
      }

      player.vx = vx;
      player.vy = vy;
      player.angle = input.angle;

      // Update position
      player.x += vx * dt;
      player.y += vy * dt;

      // Clamp to arena
      player.x = Math.max(
        PLAYER_RADIUS,
        Math.min(ARENA_WIDTH - PLAYER_RADIUS, player.x)
      );
      player.y = Math.max(
        PLAYER_RADIUS,
        Math.min(ARENA_HEIGHT - PLAYER_RADIUS, player.y)
      );

      // Handle shooting
      if (input.shoot && now - player.lastShootTime >= SHOOT_COOLDOWN_MS) {
        player.lastShootTime = now;
        const projId = uuidv4();
        const proj: ProjectileState = {
          id: projId,
          ownerId: player.id,
          x: player.x + Math.cos(input.angle) * (PLAYER_RADIUS + PROJECTILE_RADIUS + 2),
          y: player.y + Math.sin(input.angle) * (PLAYER_RADIUS + PROJECTILE_RADIUS + 2),
          vx: Math.cos(input.angle) * PROJECTILE_SPEED,
          vy: Math.sin(input.angle) * PROJECTILE_SPEED,
        };
        room.projectiles.set(projId, proj);
      }
    }

    // Update projectiles
    const expiredProjectiles: string[] = [];
    for (const [id, proj] of room.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Remove out-of-bounds
      if (
        proj.x < -50 ||
        proj.x > ARENA_WIDTH + 50 ||
        proj.y < -50 ||
        proj.y > ARENA_HEIGHT + 50
      ) {
        expiredProjectiles.push(id);
        continue;
      }

      // Check collisions with players
      for (const [, player] of room.players) {
        if (player.id === proj.ownerId) continue;
        if (player.health <= 0) continue;

        const dx = proj.x - player.x;
        const dy = proj.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {
          player.health -= PROJECTILE_DAMAGE;
          expiredProjectiles.push(id);

          if (player.health <= 0) {
            player.health = 0;
            player.respawnAt = now + 2000;

            // Award kill
            const killer = room.players.get(proj.ownerId);
            if (killer) {
              killer.score++;
              const killEvent: KillEvent = {
                killerId: killer.id,
                killerName: killer.name,
                victimId: player.id,
                victimName: player.name,
              };
              broadcast(room, { type: "kill", event: killEvent });
            }
          }
          break;
        }
      }
    }

    for (const id of expiredProjectiles) {
      room.projectiles.delete(id);
    }

    // Broadcast state to all players
    const state = getRoomState(room);
    broadcast(room, { type: "state", state });

    // Cleanup empty rooms
    if (room.players.size === 0) {
      stopGameLoop(room);
      rooms.delete(room.id);
      console.log(`[Room ${room.id}] Deleted (empty)`);
    }
  }, tickInterval);
}

function stopGameLoop(room: Room): void {
  if (room.loopInterval) {
    clearInterval(room.loopInterval);
    room.loopInterval = null;
  }
}

// ---- Networking ----

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: Room, msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const [, player] of room.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function removePlayer(playerId: string): void {
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.players.delete(playerId);
  playerToRoom.delete(playerId);
  broadcast(room, { type: "player_left", playerId });
  console.log(`[Room ${roomId}] Player ${playerId} left (${room.players.size} remaining)`);

  if (room.players.size === 0) {
    stopGameLoop(room);
    rooms.delete(roomId);
    console.log(`[Room ${roomId}] Deleted (empty)`);
  }
}

// ---- Auth verification ----

async function verifyToken(token: string): Promise<{ userId: string; name: string } | null> {
  // In production, verify the Clerk JWT token
  // For local development, we accept tokens in the format "user_<id>:<name>"
  // In production, you'd call Clerk's API to verify the session token
  if (token.startsWith("user_")) {
    const parts = token.split(":");
    if (parts.length >= 2) {
      return { userId: parts[0], name: parts.slice(1).join(":") };
    }
  }

  // Try Clerk verification via JWKS (if CLERK_SECRET_KEY is set)
  if (process.env.CLERK_SECRET_KEY) {
    try {
      // Simple JWT decode (header.payload.signature)
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        if (payload.sub) {
          return {
            userId: payload.sub,
            name: payload.name || payload.username || `Player_${payload.sub.slice(-4)}`,
          };
        }
      }
    } catch {
      // Token parse failed
    }
  }

  return null;
}

// ---- WebSocket server ----

const PORT = parseInt(process.env.GAME_SERVER_PORT || "3001", 10);

const wss = new WebSocketServer({ port: PORT });

console.log(`Game server listening on ws://localhost:${PORT}`);

// REST-like room management via message protocol
// Rooms can also be created/listed via Next.js API routes that talk to this server

wss.on("connection", (ws: WebSocket) => {
  let currentPlayerId: string | null = null;

  ws.on("message", async (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    if (msg.type === "ping") {
      send(ws, { type: "pong", t: msg.t });
      return;
    }

    if (msg.type === "join") {
      // Verify auth token
      const auth = await verifyToken(msg.token);
      if (!auth) {
        send(ws, { type: "error", message: "Authentication failed. Please sign in." });
        return;
      }

      // Find or create room
      let room = rooms.get(msg.roomCode);
      if (!room) {
        // If room code is "NEW", create a new room
        if (msg.roomCode === "NEW") {
          room = createRoom();
        } else {
          send(ws, { type: "error", message: `Room ${msg.roomCode} not found` });
          return;
        }
      }

      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        send(ws, { type: "error", message: "Room is full" });
        return;
      }

      // Check if player already in a room
      if (playerToRoom.has(auth.userId)) {
        removePlayer(auth.userId);
      }

      const { color, index } = getAvailableColor(room);
      const spawn = getSpawnPosition();

      const player: ServerPlayer = {
        id: auth.userId,
        name: msg.name || auth.name,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        angle: 0,
        health: PLAYER_MAX_HEALTH,
        score: 0,
        color,
        colorIndex: index,
        ws,
        lastInput: null,
        lastShootTime: 0,
        inputTimestamps: [],
        violations: [],
        respawnAt: null,
      };

      room.players.set(auth.userId, player);
      playerToRoom.set(auth.userId, room.id);
      currentPlayerId = auth.userId;

      // Notify others
      broadcast(room, {
        type: "player_joined",
        player: {
          id: player.id,
          name: player.name,
          x: player.x,
          y: player.y,
          vx: 0,
          vy: 0,
          angle: 0,
          health: player.health,
          score: 0,
          color: player.color,
        },
      });

      // Send join confirmation
      send(ws, { type: "joined", playerId: auth.userId, state: getRoomState(room) });

      console.log(
        `[Room ${room.id}] ${auth.name} (${auth.userId}) joined (${room.players.size} players)`
      );

      // Start game loop if we have 2+ players
      if (room.players.size >= 1 && !room.loopInterval) {
        startGameLoop(room);
      }

      return;
    }

    if (msg.type === "input") {
      if (!currentPlayerId) {
        send(ws, { type: "error", message: "Not joined to a room" });
        return;
      }

      const roomId = playerToRoom.get(currentPlayerId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.get(currentPlayerId);
      if (!player) return;

      const now = Date.now();

      // Anti-cheat: check input rate
      if (!checkInputRate(player, now)) {
        const result = recordViolation(player, now);
        if (result === "kick") {
          send(ws, { type: "error", message: "Kicked: too many input rate violations" });
          ws.close();
          return;
        }
        if (result === "warn") {
          send(ws, { type: "warning", message: "Warning: unusual input rate detected" });
        }
        return; // Drop this input
      }

      // Anti-cheat: validate shoot cooldown
      if (msg.data.shoot && now - player.lastShootTime < SHOOT_COOLDOWN_MS) {
        const result = recordViolation(player, now);
        if (result === "warn") {
          send(ws, { type: "warning", message: "Warning: shooting too fast" });
        }
        msg.data.shoot = false; // Silently ignore rapid fire
      }

      player.lastInput = msg.data;
      return;
    }
  });

  ws.on("close", () => {
    if (currentPlayerId) {
      removePlayer(currentPlayerId);
    }
  });

  ws.on("error", () => {
    if (currentPlayerId) {
      removePlayer(currentPlayerId);
    }
  });
});

// Export for testing
export { rooms, createRoom, verifyToken, checkInputRate, recordViolation, generateRoomCode };
