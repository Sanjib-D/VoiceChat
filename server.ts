import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";

// MongoDB setup
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Simple setup, normally hash passwords
  userId: { type: String, unique: true }, // 5-digit user ID
  friends: { type: [String], default: [] }, // List of friend userIds
  friendRequests: { type: [String], default: [] } // List of incoming friend request userIds
});
const User = mongoose.model('User', userSchema);

// In-memory mock for users when not using MongoDB
interface MockUser {
  username: string;
  password?: string;
  userId: string;
  friends: string[]; // List of friend userIds
  friendRequests: string[]; // List of incoming friend request userIds
}
const mockUsers = new Map<string, MockUser>();

function generateUserId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, { dbName: 'Voicechat' })
      .then(() => console.log("Connected to MongoDB database: Voicechat"))
      .catch((err) => console.error("MongoDB connection fail:", err));
  } else {
    console.log("No MONGODB_URI provided, skipping MongoDB connection.");
  }
  
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  // State
  interface Message {
    id: string;
    text: string;
    username: string;
    timestamp: number;
    roomId: string;
  }
  
  interface Room {
    id: string;
    password?: string;
    users: Map<string, { socketId: string, username: string }>;
    messages: Message[];
  }
  
  const rooms = new Map<string, Room>();

  io.on("connection", (socket) => {
    
    // Join a room (lobby or personal)
    socket.on("join-room", ({ roomId, password, username, action }) => {
      let room = rooms.get(roomId);
      
      if (action === 'create') {
        if (room) {
          socket.emit("error", { message: "Room already exists" });
          return;
        }
        room = { id: roomId, password, users: new Map(), messages: [] };
        rooms.set(roomId, room);
      } else if (action === 'join') {
        if (!room) {
          socket.emit("error", { message: "Room does not exist" });
          return;
        }
        if (room.password && room.password !== password) {
          socket.emit("error", { message: "Incorrect password" });
          return;
        }
      } else {
        // Fallback or generic personal chats
        if (!room) {
          room = { id: roomId, password, users: new Map(), messages: [] };
          rooms.set(roomId, room);
        } else if (room.password && room.password !== password) {
          socket.emit("error", { message: "Incorrect password" });
          return;
        }
      }
      
      room.users.set(socket.id, { socketId: socket.id, username });
      socket.join(roomId);
      
      // Store current room on socket for easy access
      (socket as any).roomId = roomId;
      (socket as any).username = username;
      
      // Send chat history and current users to the new user
      socket.emit("room-joined", { 
        roomId,
        messages: room.messages,
        users: Array.from(room.users.values())
      });
      
      // Notify others in the room
      socket.to(roomId).emit("user-joined", { socketId: socket.id, username });
    });
      
    // WebRTC signaling
    socket.on("webrtc-signal", ({ signal, to }) => {
      io.to(to).emit("webrtc-signal", { signal, from: socket.id });
    });
    
    // Voice state management
    socket.on("join-voice", () => {
      const roomId = (socket as any).roomId;
      if (roomId) {
        socket.to(roomId).emit("user-joined-voice", socket.id);
      }
    });

    socket.on("leave-voice", () => {
      const roomId = (socket as any).roomId;
      if (roomId) {
        socket.to(roomId).emit("user-left-voice", socket.id);
      }
    });

    socket.on("send-message", (content) => {
      const roomId = (socket as any).roomId;
      const username = (socket as any).username;
      console.log(`[SERVER] Received message: ${content} from ${username} in ${roomId}`);
      
      if (!roomId) return;
      
      const room = rooms.get(roomId);
      if (!room) return;
      
      const message: Message = {
        id: Math.random().toString(36).substring(7),
        text: content,
        username,
        timestamp: Date.now(),
        roomId
      };
      
      room.messages.push(message);
      
      // Keep only last 100 messages
      if (room.messages.length > 100) {
        room.messages.shift();
      }
      
      console.log(`[SERVER] Broadcasting message to ${roomId}`);
      io.to(roomId).emit("new-message", message);
    });
    
    socket.on("disconnect", () => {
      const roomId = (socket as any).roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.users.delete(socket.id);
          socket.to(roomId).emit("user-left", socket.id);
          socket.to(roomId).emit("user-left-voice", socket.id);
        }
      }
    });
    
    socket.on("leave-room", () => {
      const roomId = (socket as any).roomId;
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          room.users.delete(socket.id);
          socket.to(roomId).emit("user-left", socket.id);
          socket.to(roomId).emit("user-left-voice", socket.id);
        }
        socket.leave(roomId);
        (socket as any).roomId = null;
      }
    });
  });

  // API Route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug", (req, res) => {
    const r: any = {};
    for (const [id, room] of rooms.entries()) {
      r[id] = {
        users: Array.from(room.users.values()),
        messages: room.messages
      };
    }
    res.json(r);
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!process.env.MONGODB_URI) {
      const user = Array.from(mockUsers.values()).find(u => u.username === username && u.password === password);
      if (user) {
        return res.json({ success: true, username: user.username, userId: user.userId, friends: user.friends });
      }
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    try {
      const user = await User.findOne({ username, password });
      if (user) {
        res.json({ success: true, username: user.username, userId: user.userId });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;
    const userId = generateUserId();

    if (!process.env.MONGODB_URI) {
      if (Array.from(mockUsers.values()).some(u => u.username === username)) {
        return res.status(400).json({ success: false, message: "Username taken" });
      }
      const newUser = { username, password, userId, friends: [], friendRequests: [] };
      mockUsers.set(userId, newUser);
      return res.json({ success: true, username, userId, friends: [], friendRequests: [] });
    }
    
    try {
      const user = new User({ username, password, userId });
      await user.save();
      res.json({ success: true, username: user.username, userId: user.userId });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(400).json({ success: false, message: err.message || "Signup failed (username might be taken)" });
    }
  });

  app.post("/api/friends/add", async (req, res) => {
    const { currentUserId, friendId } = req.body;

    if (!process.env.MONGODB_URI) {
      const currentUser = mockUsers.get(currentUserId);
      
      // Look up friendUser by exact userId or username
      let friendUser = mockUsers.get(friendId);
      if (!friendUser) {
        // Try searching by username
        friendUser = Array.from(mockUsers.values()).find(u => u.username === friendId);
      }
      
      if (!currentUser || !friendUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (currentUser.userId === friendUser.userId) {
        return res.status(400).json({ success: false, message: "Cannot add yourself" });
      }
      
      if (currentUser.friends.includes(friendUser.userId)) {
        return res.status(400).json({ success: false, message: "Already friends" });
      }

      if (friendUser.friendRequests.includes(currentUser.userId)) {
        return res.status(400).json({ success: false, message: "Request already sent" });
      }
      
      friendUser.friendRequests.push(currentUser.userId);
      return res.json({ success: true, message: "Friend request sent!" });
    }
    
    try {
      const currentUser = await User.findOne({ userId: currentUserId });
      
      // Look up friendUser by exact userId or username
      let friendUser = await User.findOne({ userId: friendId });
      if (!friendUser) {
        friendUser = await User.findOne({ username: friendId });
      }
      
      if (!currentUser || !friendUser) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (currentUser.userId === friendUser.userId) {
        return res.status(400).json({ success: false, message: "Cannot add yourself" });
      }
      
      if (!currentUser.friends) currentUser.friends = [];
      if (!friendUser.friendRequests) friendUser.friendRequests = [];

      if (currentUser.friends.includes(friendUser.userId)) {
        return res.status(400).json({ success: false, message: "Already friends" });
      }

      if (friendUser.friendRequests.includes(currentUserId)) {
         return res.status(400).json({ success: false, message: "Request already sent" });
      }

      friendUser.friendRequests.push(currentUserId);
      await friendUser.save();
      
      return res.json({ success: true, message: "Friend request sent!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/friends/requests/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!process.env.MONGODB_URI) {
      const user = mockUsers.get(userId);
      if (!user) return res.status(404).json({ success: false, message: "Not found" });
      
      const requests = user.friendRequests.map(fId => {
        const f = mockUsers.get(fId);
        return { userId: f?.userId, username: f?.username };
      });
      return res.json({ success: true, friendRequests: requests });
    }
    
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, message: "Not found" });
      
      if (!user.friendRequests) user.friendRequests = [];

      const requesters = await User.find({ userId: { $in: user.friendRequests } });
      const requests = requesters.map(f => ({ userId: f.userId, username: f.username }));
      
      return res.json({ success: true, friendRequests: requests });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/friends/accept", async (req, res) => {
    const { currentUserId, friendId } = req.body;

    if (!process.env.MONGODB_URI) {
      const currentUser = mockUsers.get(currentUserId);
      const friendUser = mockUsers.get(friendId);
      
      if (!currentUser || !friendUser) return res.status(404).json({ success: false, message: "User not found" });

      if (currentUser.friendRequests.includes(friendId)) {
        currentUser.friendRequests = currentUser.friendRequests.filter(id => id !== friendId);
        if (!currentUser.friends.includes(friendId)) currentUser.friends.push(friendId);
        if (!friendUser.friends.includes(currentUserId)) friendUser.friends.push(currentUserId);
        return res.json({ success: true });
      }
      return res.status(400).json({ success: false, message: "No request found" });
    }

    try {
      const currentUser = await User.findOne({ userId: currentUserId });
      const friendUser = await User.findOne({ userId: friendId });

      if (!currentUser || !friendUser) return res.status(404).json({ success: false, message: "User not found" });

      if (!currentUser.friendRequests) currentUser.friendRequests = [];
      if (!currentUser.friends) currentUser.friends = [];
      if (!friendUser.friends) friendUser.friends = [];

      if (currentUser.friendRequests.includes(friendId)) {
        currentUser.friendRequests = currentUser.friendRequests.filter(id => id !== friendId);
        if (!currentUser.friends.includes(friendId)) currentUser.friends.push(friendId);
        if (!friendUser.friends.includes(currentUserId)) friendUser.friends.push(currentUserId);
        
        await currentUser.save();
        await friendUser.save();
        return res.json({ success: true });
      }
      return res.status(400).json({ success: false, message: "No request found" });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.post("/api/friends/reject", async (req, res) => {
    const { currentUserId, friendId } = req.body;

    if (!process.env.MONGODB_URI) {
      const currentUser = mockUsers.get(currentUserId);
      if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

      currentUser.friendRequests = currentUser.friendRequests.filter(id => id !== friendId);
      return res.json({ success: true });
    }

    try {
      const currentUser = await User.findOne({ userId: currentUserId });
      if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

      if (!currentUser.friendRequests) currentUser.friendRequests = [];
      currentUser.friendRequests = currentUser.friendRequests.filter(id => id !== friendId);
      await currentUser.save();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/friends/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!process.env.MONGODB_URI) {
      const user = mockUsers.get(userId);
      if (!user) return res.status(404).json({ success: false, message: "Not found" });
      
      const populatedFriends = user.friends.map(fId => {
        const f = mockUsers.get(fId);
        return { userId: f?.userId, username: f?.username };
      });
      return res.json({ success: true, friends: populatedFriends });
    }
    
    try {
      const user = await User.findOne({ userId });
      if (!user) return res.status(404).json({ success: false, message: "Not found" });
      
      if (!user.friends) user.friends = [];

      // Populate friends
      const friends = await User.find({ userId: { $in: user.friends } });
      const populatedFriends = friends.map(f => ({ userId: f.userId, username: f.username }));
      
      return res.json({ success: true, friends: populatedFriends });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
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

startServer().catch(console.error);
