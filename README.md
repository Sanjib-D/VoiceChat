# 6-Digit Connect – WebRTC Video Calling App

A real-time peer-to-peer video calling application built using **React**, **TypeScript**, **WebRTC**, **Socket.IO**, **Express**, and **Vite**.  
Users can connect instantly using a simple **6-digit ID system** without requiring authentication.

---

## 🚀 Features

- 📞 Real-time video & audio calling
- 🔢 Unique 6-digit user ID generation
- 👤 Custom display names
- 🎤 Mute / unmute microphone
- 📹 Turn camera on / off
- 📡 WebRTC peer-to-peer communication
- ⚡ Socket.IO signaling server
- 🎨 Modern responsive UI with Tailwind CSS
- 🔄 Automatic reconnection handling
- ❌ Call rejection & call end support

---

## 🛠 Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React Icons

### Backend
- Node.js
- Express.js
- Socket.IO

### Real-Time Communication
- WebRTC
- STUN Servers

---

## 📂 Project Structure

```bash
project/
│
├── App.tsx                # Main UI
├── useWebRTC.ts           # WebRTC logic and socket handling
├── server.ts              # Express + Socket.IO server
├── types.ts               # Shared TypeScript types
├── main.tsx               # React entry point
├── index.css              # Tailwind styles
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
├── package.json           # Dependencies & scripts
└── metadata.json          # App metadata
```

---

## ⚙️ Installation

### 1️⃣ Clone Repository

```bash
git clone <repository-url>
cd project-folder
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Start Development Server

```bash
npm run dev
```

The app will start on:

```bash
http://localhost:3000
```

---

## 📦 Build for Production

```bash
npm run build
```

---

## ▶️ Run Production Build

```bash
npm start
```

---

## 📞 How Calling Works

1. User opens the app
2. App generates a random 6-digit ID
3. Share the ID with another user
4. Enter the target user's ID
5. Start a call
6. WebRTC establishes peer-to-peer connection
7. Socket.IO handles signaling

---

## 🔌 WebRTC Flow

```text
Caller → Offer → Server → Receiver
Receiver → Answer → Server → Caller
ICE Candidates exchanged via Socket.IO
Direct Peer Connection Established
```

---

## 🌐 STUN Servers Used

```javascript
stun:stun.l.google.com:19302
stun:global.stun.twilio.com:3478
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build frontend & backend |
| `npm start` | Run production build |
| `npm run preview` | Preview Vite build |
| `npm run clean` | Remove build files |
| `npm run lint` | Type checking |

---

## 🔒 Permissions Required

- Camera Access
- Microphone Access

---

## 📱 Future Improvements

- Chat messaging
- Screen sharing
- Group video calls
- TURN server support
- Authentication system
- Call history
- Mobile app support

---

## 📄 License

MIT License

---

## 👨‍💻 Author

Built with ❤️ using React + WebRTC
