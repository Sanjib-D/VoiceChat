import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  // Configure Socket.IO
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = Number(process.env.PORT) || 3000;

  // Track connected users
  // Map of 6-digit ID -> socket.id
  const users = new Map<string, string>();
  // Map of socket.id -> 6-digit ID
  const socketToUser = new Map<string, string>();
  // Track rooms
  const socketToRoom = new Map<string, string>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("register", (userId: string) => {
      // Basic validation for 6-digit ID
      if (userId && /^[0-9]{6}$/.test(userId)) {
        users.set(userId, socket.id);
        socketToUser.set(socket.id, userId);
        console.log(`User registered: ${userId} -> ${socket.id}`);
        socket.emit("registered", true);
      } else {
        socket.emit("registered", false);
      }
    });

    // 1-to-1 Signaling
    socket.on("signal", (data: { to: string, from: string, signal: any, type: string, callerName?: string }) => {
      const targetSocketId = users.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("signal", {
          from: data.from,
          signal: data.signal,
          type: data.type,
          callerName: data.callerName
        });
      } else {
        if (data.type === 'offer') {
           socket.emit("call-error", { message: "User is offline or does not exist." });
        }
      }
    });

    socket.on("end-call", (data: { to: string }) => {
      const targetSocketId = users.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("call-ended");
      }
    });

    // Group Call Signaling
    socket.on("join-room", (roomId: string) => {
      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);
      const userId = socketToUser.get(socket.id);
      if (userId) {
        // notify others in the room
        socket.to(roomId).emit("user-joined", userId);
        
        // send back list of existing users to the joined user
        const clients = io.sockets.adapter.rooms.get(roomId);
        const usersInRoom = [];
        if (clients) {
          for (const clientId of clients) {
            if (clientId !== socket.id) {
              const u = socketToUser.get(clientId);
              if (u) usersInRoom.push(u);
            }
          }
        }
        socket.emit("room-users", usersInRoom);
      }
    });

    socket.on("group-signal", (data: { to: string, from: string, signal: any, type: string }) => {
      const targetSocketId = users.get(data.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("group-signal", {
          from: data.from,
          signal: data.signal,
          type: data.type
        });
      }
    });

    socket.on("leave-room", (roomId: string) => {
      socket.leave(roomId);
      socketToRoom.delete(socket.id);
      const userId = socketToUser.get(socket.id);
      if (userId) {
        socket.to(roomId).emit("user-left", userId);
      }
    });

    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
          socket.to(roomId).emit("user-left", userId);
        }
        users.delete(userId);
        socketToUser.delete(socket.id);
        socketToRoom.delete(socket.id);
        console.log(`User disconnected: ${userId}`);
      }
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
