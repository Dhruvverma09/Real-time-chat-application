# NexChat — Real-Time Chat Application

> **Internship Task 5** | Built with Node.js, WebSocket (ws), Express, HTML/CSS/JS

---

## 📌 Features Implemented

| Feature | Status |
|---|---|
| Real-time WebSocket messaging | ✅ |
| Node.js backend with Express | ✅ |
| Multiple chat rooms (general, tech, random, gaming) | ✅ |
| User authentication (username login) | ✅ |
| In-memory message storage (last 50 per room) | ✅ |
| Online users panel | ✅ |
| Typing indicators | ✅ |
| Room switching | ✅ |
| Message history on join | ✅ |
| Responsive UI | ✅ |
| User join/leave notifications | ✅ |

---

## 🚀 How to Run

### Prerequisites
- Node.js v14+ installed

### Steps

```bash
# 1. Clone / unzip the project
cd chat-app

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# (For development with auto-restart)
npm run dev
```

Open your browser at: **http://localhost:3000**

To test real-time: open **multiple browser tabs** or different browsers at the same URL.

---

## 🏗️ Architecture

```
chat-app/
├── server.js          ← Node.js + Express + WebSocket server
├── package.json       ← Dependencies
└── public/
    └── index.html     ← Frontend (HTML + CSS + JS in one file)
```

### Backend (`server.js`)
- **Express** serves the static frontend
- **`ws` library** handles WebSocket upgrade
- In-memory `rooms` object stores users + messages per room
- Each client gets a UUID on connection
- Handles: `JOIN`, `SEND_MESSAGE`, `TYPING`, `SWITCH_ROOM` message types
- Broadcasts to all room members on events

### Frontend (`public/index.html`)
- Pure HTML/CSS/JS — no frameworks needed
- `WebSocket` browser API for real-time connection
- Login screen → room selection → chat UI
- Message bubbles differentiate self vs others
- Typing indicator with debounce (1.5s)

---

## 📡 WebSocket Message Protocol

| Type | Direction | Payload |
|---|---|---|
| `JOIN` | Client → Server | `{ username, roomId, avatar }` |
| `ROOM_JOINED` | Server → Client | `{ roomId, history, users, userId }` |
| `SEND_MESSAGE` | Client → Server | `{ content }` |
| `MESSAGE` | Server → All | `{ id, userId, username, content, timestamp }` |
| `TYPING` | Client → Server | `{ isTyping }` |
| `TYPING` | Server → Others | `{ userId, username, isTyping }` |
| `USER_JOINED` | Server → Others | `{ userId, username, users }` |
| `USER_LEFT` | Server → Others | `{ userId, username, users }` |
| `ERROR` | Server → Client | `{ message }` |

---

## 🌐 Deployment

### Option 1: Railway / Render / Heroku
1. Push code to GitHub
2. Connect repo on [Railway](https://railway.app) or [Render](https://render.com)
3. Set start command: `node server.js`
4. Done — WebSocket works on these platforms

### Option 2: VPS (DigitalOcean / AWS EC2)
```bash
npm install -g pm2
pm2 start server.js --name nexchat
pm2 save
```

### Port Configuration
Change port via environment variable:
```bash
PORT=8080 node server.js
```

---

## 🔧 Optional Enhancements (to extend)
- **MongoDB** for persistent message storage (replace in-memory array)
- **JWT auth** for secure login with passwords
- **Socket.io** as drop-in for more features and fallback support
- **Redis** for scaling across multiple server instances
- **File/image sharing** via multipart upload

---

## 📝 Tech Stack
- **Backend**: Node.js, Express 4.x, ws 8.x
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Real-time**: WebSocket (RFC 6455)
- **Fonts**: Google Fonts (Syne + DM Sans)
