// src/config/socket.js — Socket.io singleton with JWT auth
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  // Auth middleware — validate JWT token on handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("No token"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "secret");
      socket.userId = payload.user_id || payload.id || payload.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    if (userId) {
      // Each user joins their own room — room name: "user:<id>"
      socket.join(`user:${userId}`);
      console.log(`[socket] user ${userId} connected (${socket.id})`);
    }

    socket.on("disconnect", () => {
      console.log(`[socket] user ${userId} disconnected (${socket.id})`);
    });
  });

  console.log("[socket] Socket.io initialised");
  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialised — call initSocket() first");
  return io;
}

/** Emit a notification to a specific user (best-effort — won't throw) */
export function emitToUser(userId, event, data) {
  try {
    getIO().to(`user:${userId}`).emit(event, data);
  } catch { /* socket not ready */ }
}
