"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LobbyPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 font-mono">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold text-white font-mono">DETEXTIT ARENA</h1>
        <p className="text-gray-400 font-mono">Sign in to play</p>
        <SignInButton mode="modal">
          <button className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-mono rounded-lg transition-colors">
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  const displayName = user?.firstName || user?.username || "Player";

  function handleCreateRoom() {
    setLoading(true);
    setError("");
    router.push(`/game?room=NEW&name=${encodeURIComponent(displayName)}`);
  }

  function handleJoinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a room code");
      return;
    }
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    router.push(`/game?room=${code}&name=${encodeURIComponent(displayName)}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white font-mono mb-2">DETEXTIT ARENA</h1>
        <p className="text-gray-400 font-mono">Multiplayer 2D Shooter</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-gray-300 font-mono">
            Welcome, <span className="text-purple-400 font-bold">{displayName}</span>
          </p>
        </div>

        {/* Create Room */}
        <div className="space-y-3">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-mono font-bold text-lg rounded-lg transition-colors"
          >
            {loading ? "LOADING..." : "CREATE ROOM"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 font-mono text-sm">OR</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        {/* Join Room */}
        <div className="space-y-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ENTER ROOM CODE"
            maxLength={6}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-center text-xl tracking-widest placeholder:text-gray-600 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            onClick={handleJoinRoom}
            disabled={loading}
            className="w-full px-6 py-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-mono font-bold text-lg rounded-lg transition-colors"
          >
            {loading ? "JOINING..." : "JOIN ROOM"}
          </button>
        </div>

        {error && (
          <p className="text-red-400 font-mono text-sm text-center">{error}</p>
        )}
      </div>

      {/* Controls help */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 max-w-md w-full">
        <h3 className="text-gray-300 font-mono font-bold mb-2 text-sm">CONTROLS</h3>
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          <span className="text-gray-500">WASD</span>
          <span className="text-gray-400">Move</span>
          <span className="text-gray-500">Mouse</span>
          <span className="text-gray-400">Aim</span>
          <span className="text-gray-500">Click / Space</span>
          <span className="text-gray-400">Shoot</span>
        </div>
      </div>

      <button
        onClick={() => router.push("/")}
        className="text-gray-500 hover:text-gray-300 font-mono text-sm transition-colors"
      >
        Back to Home
      </button>
    </div>
  );
}
