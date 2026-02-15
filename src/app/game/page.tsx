"use client";

import { useUser } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { createGameEngine, type GameEngine } from "@/game/engine";
import { GAME_CONFIG } from "@/game/types";

function GameContent() {
  const { user, isSignedIn, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);

  const roomCode = searchParams.get("room") || "NEW";
  const playerName = searchParams.get("name") || "Player";

  const statusCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStatusCheck = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = engine.getState();
    if (state.connected) {
      setConnectionStatus("connected");
      if (state.roomId) setRoomId(state.roomId);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = GAME_CONFIG.ARENA_WIDTH;
    canvas.height = GAME_CONFIG.ARENA_HEIGHT;

    const engine = createGameEngine(canvas);
    engineRef.current = engine;

    // Build auth token
    // For local dev, use a simple token format that the game server accepts
    const token = `user_${user!.id}:${playerName}`;

    // Connect to game server
    const wsUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:3001";
    engine.connect(wsUrl, token, roomCode, playerName);

    // Poll connection status
    statusCheckRef.current = setInterval(handleStatusCheck, 500);

    // Timeout for connection
    const timeout = setTimeout(() => {
      const state = engine.getState();
      if (!state.connected) {
        setConnectionStatus("error");
        setErrorMessage("Could not connect to game server. Make sure the game server is running on port 3001.");
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      engine.destroy();
      engineRef.current = null;
    };
  }, [isLoaded, isSignedIn, roomCode, playerName, user, handleStatusCheck]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 font-mono">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    router.push("/lobby");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center">
      {/* Top bar */}
      <div className="w-full max-w-[1600px] flex items-center justify-between px-4 py-2">
        <button
          onClick={() => {
            if (engineRef.current) engineRef.current.disconnect();
            router.push("/lobby");
          }}
          className="text-gray-400 hover:text-white font-mono text-sm transition-colors"
        >
          &larr; LEAVE GAME
        </button>
        <div className="flex items-center gap-4">
          {roomId && (
            <span className="text-gray-300 font-mono text-sm">
              Room: <span className="text-purple-400 font-bold">{roomId}</span>
            </span>
          )}
          <span
            className={`font-mono text-sm ${
              connectionStatus === "connected"
                ? "text-green-400"
                : connectionStatus === "error"
                ? "text-red-400"
                : "text-yellow-400"
            }`}
          >
            {connectionStatus === "connected"
              ? "CONNECTED"
              : connectionStatus === "error"
              ? "DISCONNECTED"
              : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* Game canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="border border-gray-800 rounded-lg cursor-crosshair"
          style={{
            maxWidth: "100vw",
            maxHeight: "calc(100vh - 60px)",
            width: "100%",
            aspectRatio: `${GAME_CONFIG.ARENA_WIDTH}/${GAME_CONFIG.ARENA_HEIGHT}`,
          }}
        />

        {connectionStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 rounded-lg">
            <p className="text-red-400 font-mono text-lg mb-2">Connection Failed</p>
            <p className="text-gray-400 font-mono text-sm mb-4 max-w-md text-center px-4">
              {errorMessage}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConnectionStatus("connecting");
                  setErrorMessage("");
                  const engine = engineRef.current;
                  if (engine) {
                    const token = `user_${user!.id}:${playerName}`;
                    const wsUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:3001";
                    engine.connect(wsUrl, token, roomCode, playerName);
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono rounded-lg transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => router.push("/lobby")}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-mono rounded-lg transition-colors"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <p className="text-gray-400 font-mono">Loading...</p>
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
