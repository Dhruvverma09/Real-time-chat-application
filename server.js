/*
 * Real-Time Chat Application — Server
 * Stack: Node.js + Express + ws (WebSocket)
 * Author: Dhruv
 */

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// ─── Serve static frontend ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ─── In-Memory State ─────────────────────────────────────────────────────────
const rooms = {
  general: { name: "# general", users: new Map(), messages: [] },
  tech:    { name: "# tech",    users: new Map(), messages: [] },
  random:  { name: "# random",  users: new Map(), messages: [] },
  gaming:  { name: "# gaming",  users: new Map(), messages: [] },
};

const MAX_ROOM_HISTORY = 50; // keep last 50 messages per room

// ─── Helpers ─────────────────────────────────────────────────────────────────
function broadcast(roomId, message, excludeWs = null) {
  const room = rooms[roomId];
  if (!room) return;
  room.users.forEach((user, ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

function broadcastToAll(roomId, message) {
  broadcast(roomId, message, null);
}

function getRoomUserList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];
  return Array.from(room.users.values()).map((u) => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
  }));
}

function sendTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// ─── REST: Get available rooms ────────────────────────────────────────────────
app.get("/api/rooms", (req, res) => {
  const roomList = Object.entries(rooms).map(([id, room]) => ({
    id,
    name: room.name,
    onlineCount: room.users.size,
  }));
  res.json(roomList);
});

// ─── WebSocket Logic ──────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  // Each connection gets a temp session
  ws.userId = uuidv4();
  ws.username = null;
  ws.currentRoom = null;
  ws.avatar = null;

  console.log(`[WS] New connection: ${ws.userId}`);

  // ── Handle messages from client ──
  ws.on("message", (rawData) => {
    let data;
    try {
      data = JSON.parse(rawData);
    } catch {
      return;
    }

    switch (data.type) {

      // ── JOIN: user sets username and enters a room ──
      case "JOIN": {
        const { username, roomId, avatar } = data;

        if (!username || username.trim().length < 2) {
          return sendTo(ws, { type: "ERROR", message: "Username must be at least 2 characters." });
        }
        if (!rooms[roomId]) {
          return sendTo(ws, { type: "ERROR", message: "Room not found." });
        }

        // Leave old room if switching
        if (ws.currentRoom && ws.currentRoom !== roomId) {
          const oldRoom = rooms[ws.currentRoom];
          oldRoom.users.delete(ws);
          broadcast(ws.currentRoom, {
            type: "USER_LEFT",
            userId: ws.userId,
            username: ws.username,
            users: getRoomUserList(ws.currentRoom),
            roomId: ws.currentRoom,
          });
        }

        ws.username = username.trim().slice(0, 20);
        ws.currentRoom = roomId;
        ws.avatar = avatar || generateAvatar(username);

        rooms[roomId].users.set(ws, {
          id: ws.userId,
          username: ws.username,
          avatar: ws.avatar,
          joinedAt: Date.now(),
        });

        // Send room history to joining user
        sendTo(ws, {
          type: "ROOM_JOINED",
          roomId,
          roomName: rooms[roomId].name,
          history: rooms[roomId].messages,
          users: getRoomUserList(roomId),
          userId: ws.userId,
        });

        // Announce to others
        broadcast(roomId, {
          type: "USER_JOINED",
          userId: ws.userId,
          username: ws.username,
          avatar: ws.avatar,
          users: getRoomUserList(roomId),
          roomId,
          timestamp: Date.now(),
        }, ws);

        console.log(`[ROOM] ${ws.username} joined #${roomId}`);
        break;
      }

      // ── SEND_MESSAGE: user sends a chat message ──
      case "SEND_MESSAGE": {
        if (!ws.username || !ws.currentRoom) {
          return sendTo(ws, { type: "ERROR", message: "Not in a room." });
        }

        const content = (data.content || "").trim().slice(0, 500);
        if (!content) return;

        const message = {
          id: uuidv4(),
          type: "MESSAGE",
          roomId: ws.currentRoom,
          userId: ws.userId,
          username: ws.username,
          avatar: ws.avatar,
          content,
          timestamp: Date.now(),
        };

        // Store in history
        const room = rooms[ws.currentRoom];
        room.messages.push(message);
        if (room.messages.length > MAX_ROOM_HISTORY) {
          room.messages.shift();
        }

        // Broadcast to ALL users in room (including sender)
        broadcastToAll(ws.currentRoom, message);
        break;
      }

      // ── SWITCH_ROOM ──
      case "SWITCH_ROOM": {
        const { roomId } = data;
        if (!rooms[roomId]) {
          return sendTo(ws, { type: "ERROR", message: "Room not found." });
        }
        // Simulate re-join
        ws.emit("message", JSON.stringify({
          type: "JOIN",
          username: ws.username,
          roomId,
          avatar: ws.avatar,
        }));
        break;
      }

      // ── TYPING indicator ──
      case "TYPING": {
        if (!ws.username || !ws.currentRoom) return;
        broadcast(ws.currentRoom, {
          type: "TYPING",
          userId: ws.userId,
          username: ws.username,
          isTyping: data.isTyping,
          roomId: ws.currentRoom,
        }, ws);
        break;
      }

      default:
        break;
    }
  });

  // ── On disconnect ──
  ws.on("close", () => {
    if (ws.currentRoom && ws.username) {
      const room = rooms[ws.currentRoom];
      if (room) {
        room.users.delete(ws);
        broadcast(ws.currentRoom, {
          type: "USER_LEFT",
          userId: ws.userId,
          username: ws.username,
          users: getRoomUserList(ws.currentRoom),
          roomId: ws.currentRoom,
          timestamp: Date.now(),
        });
      }
    }
    console.log(`[WS] Disconnected: ${ws.username || ws.userId}`);
  });

  ws.on("error", (err) => {
    console.error(`[WS ERROR] ${ws.userId}:`, err.message);
  });
});

// ─── Avatar color generator ───────────────────────────────────────────────────
function generateAvatar(username) {
  const colors = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7",
                  "#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#82E0AA"];
  let hash = 0;
  for (let c of username) hash = (hash * 31 + c.charCodeAt(0)) % colors.length;
  return colors[Math.abs(hash)];
}

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Chat server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
  console.log(`📁 Rooms: ${Object.keys(rooms).join(", ")}\n`);
});
