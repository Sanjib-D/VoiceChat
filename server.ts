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

  const PORT = process.env.PORT || 3000;

  // Track connected users
  // Map of 6-digit ID -> socket.id
  const users = new Map<string, string>();
  // Map of socket.id -> 6-digit ID
  const socketToUser = new Map<string, string>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("register", (userId: string) => {
      // Basic validation for 6-digit ID
      if (userId && /^[0-9]{6}$/.test(userId)) {
        // If someone else had this ID (should be rare), disconnect them 
        // to keep it simple, or just override.
        users.set(userId, socket.id);
        socketToUser.set(socket.id, userId);
        console.log(`User registered: ${userId} -> ${socket.id}`);
        socket.emit("registered", true);
      } else {
        socket.emit("registered", false);
      }
    });

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
      const socketId = users.get(data.to);
      if (socketId) {
        io.to(socketId).emit("call-ended");
      }
    });

    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        users.delete(userId);
        socketToUser.delete(socket.id);
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
