// Shared types for multiplayer game

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  angle: number;
  seq: number;
}

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  health: number;
  score: number;
  color: string;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RoomState {
  roomId: string;
  state: "waiting" | "playing" | "finished";
  players: Record<string, PlayerState>;
  projectiles: Record<string, ProjectileState>;
  tick: number;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
}

// Client -> Server messages
export type ClientMessage =
  | { type: "join"; token: string; roomCode: string; name: string }
  | { type: "input"; data: InputState }
  | { type: "ping"; t: number };

// Server -> Client messages
export type ServerMessage =
  | { type: "joined"; playerId: string; state: RoomState }
  | { type: "state"; state: RoomState }
  | { type: "player_joined"; player: PlayerState }
  | { type: "player_left"; playerId: string }
  | { type: "kill"; event: KillEvent }
  | { type: "pong"; t: number }
  | { type: "error"; message: string }
  | { type: "warning"; message: string };

// Game constants
export const GAME_CONFIG = {
  TICK_RATE: 20,
  ARENA_WIDTH: 1600,
  ARENA_HEIGHT: 900,
  PLAYER_SPEED: 250,
  PLAYER_RADIUS: 16,
  PLAYER_MAX_HEALTH: 100,
  PROJECTILE_SPEED: 500,
  PROJECTILE_RADIUS: 4,
  PROJECTILE_DAMAGE: 20,
  PROJECTILE_TTL_MS: 3000,
  SHOOT_COOLDOWN_MS: 250,
  MAX_INPUTS_PER_SECOND: 25,
  MAX_PLAYERS_PER_ROOM: 8,
  RESPAWN_DELAY_MS: 2000,
  PLAYER_COLORS: [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  ],
  // Anti-cheat thresholds
  VIOLATION_WARN_THRESHOLD: 10,
  VIOLATION_WARN_WINDOW_MS: 30000,
  VIOLATION_KICK_THRESHOLD: 30,
  VIOLATION_KICK_WINDOW_MS: 60000,
} as const;
