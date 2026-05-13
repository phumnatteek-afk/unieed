// src/lib/socket.js — Socket.io client factory (singleton per token)
import { io } from "socket.io-client";

const BASE = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:3000";

let _socket = null;
let _currentToken = null;

/**
 * getSocket(token) — returns a connected socket for the given JWT token.
 * Reconnects automatically if the token changes (logout/login).
 */
export function getSocket(token) {
  if (!token) {
    if (_socket) { _socket.disconnect(); _socket = null; _currentToken = null; }
    return null;
  }

  // Reuse existing connection if token hasn't changed
  if (_socket && _currentToken === token && _socket.connected) return _socket;

  // Disconnect stale connection
  if (_socket) { _socket.disconnect(); _socket = null; }

  _currentToken = token;
  _socket = io(BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on("connect",       ()  => console.log("[socket] connected:", _socket.id));
  _socket.on("disconnect",    (r) => console.log("[socket] disconnected:", r));
  _socket.on("connect_error", (e) => console.warn("[socket] error:", e.message));

  return _socket;
}

export function disconnectSocket() {
  if (_socket) { _socket.disconnect(); _socket = null; _currentToken = null; }
}
