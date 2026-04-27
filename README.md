# Telegram Clone MVP

A full-stack Telegram Web clone built as a hackathon project. Real-time messaging, media sharing, voice messages, video calls, and group chats.

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, TypeScript
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL
- **Calls**: WebRTC (peer-to-peer audio/video)
- **Icons**: Lucide React

## Features

- **Auth**: Registration & login with username
- **Real-time messaging**: Socket.io powered instant messaging
- **DMs & Groups**: Personal chats and group conversations
- **User search**: Find friends by @username
- **Media**: Photo and file sharing
- **Voice messages**: Record and send voice messages with speech-to-text
- **Audio/Video calls**: WebRTC peer-to-peer calls
- **Message actions**: Edit, delete, reply, pin, save to favorites
- **Reactions**: Emoji reactions on messages
- **Online status**: Real-time online/offline indicators
- **Typing indicator**: "typing..." status
- **Delivery status**: Read receipts (double check marks)
- **Dark theme**: Telegram-style dark UI
- **Responsive**: Full-width desktop layout

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Setup Database

```bash
# Create PostgreSQL user and database
sudo -u postgres psql -c "CREATE USER telegram_user WITH PASSWORD 'telegram_pass';"
sudo -u postgres psql -c "CREATE DATABASE telegram_clone OWNER telegram_user;"

# Initialize schema
cd server && npm run db:init
```

### 2. Install Dependencies

```bash
# Install all dependencies (root + server + client)
npm run install:all
```

### 3. Run the App

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 3000).

Open http://localhost:3000 in your browser.

### 4. Test It

1. Register two users in two browser tabs
2. Search for user by @username
3. Start chatting!

## Project Structure

```
telegram-clone/
├── client/                 # Next.js frontend
│   └── src/
│       ├── app/            # Next.js app router
│       ├── components/     # React components
│       ├── contexts/       # Auth context
│       └── lib/            # API client, socket
├── server/                 # Express backend
│   └── src/
│       ├── db/             # Database pool & schema
│       ├── middleware/      # JWT auth
│       ├── routes/         # REST API routes
│       ├── socket.js       # Socket.io handlers
│       └── index.js        # Server entry point
└── package.json            # Root package with dev scripts
```

## Environment Variables

Server `.env`:
```
DATABASE_URL=postgresql://telegram_user:telegram_pass@localhost:5432/telegram_clone
JWT_SECRET=super-secret-jwt-key-change-in-production
PORT=3001
CLIENT_URL=http://localhost:3000
```
