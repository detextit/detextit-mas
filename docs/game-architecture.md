# Detextit MAS - Multiplayer 2D Game Architecture

## Overview

A server-authoritative multiplayer 2D arena game built on Next.js 15 with a standalone WebSocket game server. Players authenticate via Clerk, join rooms through a lobby system, and compete in real-time 2D arenas with movement, shooting, and scoring.

## Entity Model

### Player
```
Player {
  id: string              // Clerk user ID
  name: string            // Display name
  x: number               // World position X
  y: number               // World position Y
  vx: number              // Velocity X (server-computed)
  vy: number              // Velocity Y (server-computed)
  angle: number           // Facing direction (radians)
  health: number          // 0-100, dead at 0
  score: number           // Kills in current session
  color: string           // Player color (assigned on join)
  lastInput: InputState   // Most recent client input
  lastInputSeq: number    // Input sequence number for reconciliation
}
```

### Projectile
```
Projectile {
  id: string              // Unique projectile ID
  ownerId: string         // Player who fired it
  x: number               // World position X
  y: number               // World position Y
  vx: number              // Velocity X
  vy: number              // Velocity Y
  createdAt: number       // Timestamp for TTL
}
```

### Room
```
Room {
  id: string              // 6-character room code
  players: Map<string, Player>
  projectiles: Map<string, Projectile>
  state: 'waiting' | 'playing' | 'finished'
  maxPlayers: number      // Default 8
  tickRate: number        // Server ticks per second (20)
  createdAt: number
  updatedAt: number
}
```

### InputState
```
InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  shoot: boolean
  angle: number           // Mouse aim angle
  seq: number             // Sequence number
}
```

## Tick Model

### Server Tick Loop (20 Hz)
The game server runs an authoritative simulation at 20 ticks per second:

1. **Process Inputs** - Dequeue all buffered client inputs, validate against anti-cheat rules
2. **Update Physics** - Apply validated movement to player positions, update projectile positions
3. **Collision Detection** - Check projectile-player and player-boundary collisions
4. **State Cleanup** - Remove expired projectiles, respawn dead players
5. **Broadcast State** - Send authoritative game state snapshot to all room clients

### Client Render Loop (60 FPS)
The client runs at 60 FPS with interpolation:

1. **Capture Input** - Read keyboard/mouse state
2. **Send Input** - Send input to server (throttled to tick rate)
3. **Client-Side Prediction** - Apply local input immediately for responsiveness
4. **Receive State** - Process server snapshots
5. **Server Reconciliation** - Correct local prediction errors
6. **Interpolate Others** - Smooth other players' positions between snapshots
7. **Render** - Draw all entities to canvas

## Ownership Matrix

| Entity        | Created By | Authoritative Owner | Read By       |
|---------------|------------|---------------------|---------------|
| Player State  | Server     | Server              | All Clients   |
| Input State   | Client     | Client              | Server        |
| Projectiles   | Server     | Server              | All Clients   |
| Room State    | Server     | Server              | All Clients   |
| Auth Session  | Clerk      | Server              | Client+Server |
| Room Code     | Server     | Server              | All Clients   |
| Score/Health  | Server     | Server              | All Clients   |

## System Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Next.js Frontend  │     │   WebSocket Server    │
│                     │     │   (game-server.ts)    │
│  /game - Game UI    │◄───►│                       │
│  /lobby - Room mgmt │     │  - Room management    │
│  /sign-in - Auth    │     │  - Game loop (20Hz)   │
│  /sign-up - Auth    │     │  - Anti-cheat         │
│                     │     │  - State broadcast    │
│  Clerk Auth ────────┼────►│  - Auth verification  │
└─────────────────────┘     └──────────────────────┘
         │                            │
         │                            │
    ┌────┴────┐                  ┌────┴────┐
    │  Clerk  │                  │ In-Mem  │
    │  Auth   │                  │  State  │
    └─────────┘                  └─────────┘
```

## Network Protocol

### Client → Server Messages
- `join` - Join room with auth token and room code
- `input` - Player input state (keys + mouse angle + sequence number)
- `ping` - Latency measurement

### Server → Client Messages
- `joined` - Confirm join with player ID and initial state
- `state` - Authoritative game state snapshot (20 Hz)
- `player_joined` - New player entered room
- `player_left` - Player disconnected
- `kill` - Kill event for HUD feed
- `pong` - Latency response
- `error` - Error message (auth failure, room full, etc.)

## Anti-Cheat Design

### Movement Validation
- Maximum speed cap: 300 units/sec. Any input producing faster movement is clamped.
- Position is always server-computed. Clients send inputs, never positions.
- Input rate limiting: max 25 inputs/second per client. Excess inputs dropped.

### Shoot Rate Validation
- Minimum cooldown between shots: 250ms
- Server ignores shoot inputs that violate cooldown
- Projectile creation is server-only

### Penalty Behavior
- Repeated violations (>10 in 30s window) trigger a warning message to client
- Continued violations (>30 in 60s) result in auto-kick from room
- All violations are logged with timestamps for observability

## Local Development Runbook

### Prerequisites
- Node.js 18+
- npm

### Running the Full Stack

**Terminal 1 - Game Server:**
```bash
npx tsx server/game-server.ts
# Starts WebSocket server on port 3001
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev
# Starts Next.js on port 3000
```

### Testing with 2+ Players

1. Open `http://localhost:3000` in browser window 1
2. Sign in with Clerk (or use test account)
3. Go to Lobby, create a room - note the room code
4. Open `http://localhost:3000` in browser window 2 (incognito for different auth)
5. Sign in with a different account
6. Go to Lobby, enter the room code, click Join
7. Both players should see each other in the arena
8. Use WASD to move, mouse to aim, click/space to shoot

### Running Tests
```bash
npm test
```

### Running Full CI Check
```bash
npm run lint && npm run build && npm test
```
