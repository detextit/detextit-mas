import type {
  InputState,
  PlayerState,
  ProjectileState,
  RoomState,
  ServerMessage,
  KillEvent,
} from "./types";
import { GAME_CONFIG } from "./types";

const {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PROJECTILE_RADIUS,
} = GAME_CONFIG;

export interface GameEngine {
  canvas: HTMLCanvasElement;
  connect: (wsUrl: string, token: string, roomCode: string, name: string) => void;
  disconnect: () => void;
  getState: () => {
    connected: boolean;
    playerId: string | null;
    roomId: string | null;
    roomState: RoomState | null;
    ping: number;
    killFeed: KillEvent[];
  };
  destroy: () => void;
}

export function createGameEngine(canvas: HTMLCanvasElement): GameEngine {
  const ctx = canvas.getContext("2d")!;
  let ws: WebSocket | null = null;
  let connected = false;
  let playerId: string | null = null;
  let roomId: string | null = null;
  let roomState: RoomState | null = null;
  let ping = 0;
  let animFrame = 0;
  let destroyed = false;

  // Kill feed
  const killFeed: (KillEvent & { time: number })[] = [];
  const KILL_FEED_DURATION = 5000;

  // Input state
  const keys: Record<string, boolean> = {};
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let inputSeq = 0;

  // Client-side prediction
  let localPlayer: PlayerState | null = null;
  let pendingInputs: InputState[] = [];

  // Interpolation for other players
  const playerSnapshots: Map<string, { prev: PlayerState; next: PlayerState; t: number }> = new Map();

  // Ping interval
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  // Input sending interval
  let inputInterval: ReturnType<typeof setInterval> | null = null;

  // ---- Input handlers ----

  function onKeyDown(e: KeyboardEvent) {
    if (["w", "a", "s", "d", " "].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
    keys[e.key.toLowerCase()] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    keys[e.key.toLowerCase()] = false;
  }

  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
  }

  function onMouseDown() {
    mouseDown = true;
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mouseup", onMouseUp);

  // ---- Networking ----

  function getInput(): InputState {
    const angle = localPlayer
      ? Math.atan2(mouseY - localPlayer.y, mouseX - localPlayer.x)
      : 0;

    return {
      up: !!(keys["w"] || keys["arrowup"]),
      down: !!(keys["s"] || keys["arrowdown"]),
      left: !!(keys["a"] || keys["arrowleft"]),
      right: !!(keys["d"] || keys["arrowright"]),
      shoot: mouseDown || !!keys[" "],
      angle,
      seq: ++inputSeq,
    };
  }

  function sendInput() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !playerId) return;
    const input = getInput();
    ws.send(JSON.stringify({ type: "input", data: input }));
    pendingInputs.push(input);

    // Client-side prediction
    if (localPlayer && localPlayer.health > 0) {
      applyInput(localPlayer, input, 1 / 20);
    }
  }

  function applyInput(player: PlayerState, input: InputState, dt: number) {
    let vx = 0;
    let vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag > 0) {
      vx = (vx / mag) * PLAYER_SPEED;
      vy = (vy / mag) * PLAYER_SPEED;
    }

    player.x += vx * dt;
    player.y += vy * dt;
    player.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, player.y));
    player.angle = input.angle;
  }

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "joined":
        playerId = msg.playerId;
        roomId = msg.state.roomId;
        roomState = msg.state;
        localPlayer = msg.state.players[msg.playerId] ? { ...msg.state.players[msg.playerId] } : null;
        break;

      case "state":
        roomState = msg.state;

        // Server reconciliation for local player
        if (playerId && msg.state.players[playerId]) {
          const serverPlayer = msg.state.players[playerId];
          localPlayer = { ...serverPlayer };
          // Re-apply pending inputs that server hasn't processed yet
          // (simplified - just use server state for now)
          pendingInputs = [];
        }

        // Update interpolation snapshots for other players
        for (const [id, player] of Object.entries(msg.state.players)) {
          if (id === playerId) continue;
          const existing = playerSnapshots.get(id);
          if (existing) {
            playerSnapshots.set(id, { prev: existing.next, next: player, t: 0 });
          } else {
            playerSnapshots.set(id, { prev: player, next: player, t: 1 });
          }
        }

        // Clean up disconnected players from snapshots
        for (const id of playerSnapshots.keys()) {
          if (!msg.state.players[id]) {
            playerSnapshots.delete(id);
          }
        }
        break;

      case "kill":
        killFeed.push({ ...msg.event, time: Date.now() });
        break;

      case "pong":
        ping = Date.now() - msg.t;
        break;

      case "error":
        console.error("[Game]", msg.message);
        break;

      case "warning":
        console.warn("[Game]", msg.message);
        break;
    }
  }

  // ---- Rendering ----

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, t);
  }

  function render() {
    if (destroyed) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, w, h);

    if (!roomState) {
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Connecting...", w / 2, h / 2);
      animFrame = requestAnimationFrame(render);
      return;
    }

    // Draw arena border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Draw grid
    ctx.strokeStyle = "#1F2937";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < ARENA_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }

    // Update interpolation
    const interpSpeed = 1 / (1000 / GAME_CONFIG.TICK_RATE / 16.67);
    for (const [, snap] of playerSnapshots) {
      snap.t = Math.min(1, snap.t + interpSpeed);
    }

    // Draw projectiles
    for (const proj of Object.values(roomState.projectiles)) {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#FCD34D";
      ctx.fill();
      // Glow effect
      ctx.shadowColor = "#FCD34D";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw players
    for (const [id, player] of Object.entries(roomState.players)) {
      let drawX = player.x;
      let drawY = player.y;
      let drawAngle = player.angle;

      if (id === playerId && localPlayer) {
        // Use client-predicted position
        drawX = localPlayer.x;
        drawY = localPlayer.y;
        drawAngle = localPlayer.angle;
      } else {
        // Interpolate other players
        const snap = playerSnapshots.get(id);
        if (snap) {
          drawX = lerp(snap.prev.x, snap.next.x, snap.t);
          drawY = lerp(snap.prev.y, snap.next.y, snap.t);
          drawAngle = snap.next.angle;
        }
      }

      const isDead = player.health <= 0;
      const alpha = isDead ? 0.3 : 1;

      // Player body
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(drawX, drawY, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = id === playerId ? "#FFFFFF" : "#374151";
      ctx.lineWidth = id === playerId ? 3 : 1.5;
      ctx.stroke();

      // Direction indicator (gun barrel)
      if (!isDead) {
        ctx.beginPath();
        ctx.moveTo(drawX, drawY);
        ctx.lineTo(
          drawX + Math.cos(drawAngle) * (PLAYER_RADIUS + 8),
          drawY + Math.sin(drawAngle) * (PLAYER_RADIUS + 8)
        );
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Name tag
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(player.name, drawX, drawY - PLAYER_RADIUS - 16);

      // Health bar
      if (!isDead) {
        const barWidth = 32;
        const barHeight = 4;
        const barX = drawX - barWidth / 2;
        const barY = drawY - PLAYER_RADIUS - 10;

        ctx.fillStyle = "#374151";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPct = player.health / GAME_CONFIG.PLAYER_MAX_HEALTH;
        ctx.fillStyle = healthPct > 0.5 ? "#10B981" : healthPct > 0.25 ? "#F59E0B" : "#EF4444";
        ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);
      }

      ctx.globalAlpha = 1;
    }

    // Draw HUD
    drawHUD();

    animFrame = requestAnimationFrame(render);
  }

  function drawHUD() {
    const w = canvas.width;
    const now = Date.now();

    // Kill feed (top right)
    const activeKills = killFeed.filter((k) => now - k.time < KILL_FEED_DURATION);
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    activeKills.slice(-5).forEach((kill, i) => {
      const opacity = Math.max(0, 1 - (now - kill.time) / KILL_FEED_DURATION);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "#F87171";
      ctx.fillText(
        `${kill.killerName} eliminated ${kill.victimName}`,
        w - 16,
        30 + i * 18
      );
    });
    ctx.globalAlpha = 1;

    // Connection info (top left)
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = connected ? "#10B981" : "#EF4444";
    ctx.fillText(connected ? `CONNECTED` : "DISCONNECTED", 16, 24);
    ctx.fillStyle = "#9CA3AF";
    ctx.fillText(`PING: ${ping}ms`, 16, 40);
    if (roomId) {
      ctx.fillText(`ROOM: ${roomId}`, 16, 56);
    }

    // Player count
    if (roomState) {
      const playerCount = Object.keys(roomState.players).length;
      ctx.fillText(`PLAYERS: ${playerCount}`, 16, 72);
    }

    // Scoreboard (top center)
    if (roomState) {
      const sorted = Object.values(roomState.players).sort((a, b) => b.score - a.score);
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#D1D5DB";
      ctx.fillText("SCOREBOARD", ARENA_WIDTH / 2, 24);
      ctx.font = "12px monospace";
      sorted.slice(0, 5).forEach((p, i) => {
        const isMe = p.id === playerId;
        ctx.fillStyle = isMe ? "#FCD34D" : "#9CA3AF";
        ctx.fillText(`${p.name}: ${p.score}`, ARENA_WIDTH / 2, 42 + i * 16);
      });
    }

    // Controls help (bottom left)
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#6B7280";
    const bottom = ARENA_HEIGHT - 16;
    ctx.fillText("WASD: Move | Mouse: Aim | Click/Space: Shoot", 16, bottom);
  }

  // ---- Public API ----

  function connect(wsUrl: string, token: string, roomCode: string, name: string) {
    if (ws) {
      ws.close();
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      ws!.send(JSON.stringify({ type: "join", token, roomCode, name }));

      // Start sending inputs
      inputInterval = setInterval(sendInput, 1000 / GAME_CONFIG.TICK_RATE);

      // Start ping
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
        }
      }, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        handleMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      connected = false;
      playerId = null;
      if (inputInterval) clearInterval(inputInterval);
      if (pingInterval) clearInterval(pingInterval);
    };

    ws.onerror = () => {
      connected = false;
    };
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
    playerId = null;
    roomState = null;
    if (inputInterval) clearInterval(inputInterval);
    if (pingInterval) clearInterval(pingInterval);
  }

  function destroy() {
    destroyed = true;
    disconnect();
    cancelAnimationFrame(animFrame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("mouseup", onMouseUp);
  }

  // Start render loop
  animFrame = requestAnimationFrame(render);

  return {
    canvas,
    connect,
    disconnect,
    getState: () => ({
      connected,
      playerId,
      roomId,
      roomState,
      ping,
      killFeed: killFeed.filter((k) => Date.now() - k.time < KILL_FEED_DURATION),
    }),
    destroy,
  };
}
