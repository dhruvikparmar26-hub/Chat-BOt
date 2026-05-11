# Chat-BOt

A modern full-stack AI chat application built with Express, Socket.io, MongoDB, and Google Gemini. It supports real-time messaging, authenticated user sessions, conversation history, moderation, and secure backend controls.

## Resume Summary

Chat-BOt is a production-style AI chatbot that combines streaming Gemini responses with persistent chat history, JWT-based authentication, and defensive middleware for rate limiting, validation, and content moderation.

Live repository: [https://github.com/dhruvikparmar26-hub/Chat-BOt](https://github.com/dhruvikparmar26-hub/Chat-BOt)

## Tech Stack

- Backend: Node.js, Express, Socket.io
- Database: MongoDB, Mongoose
- AI: Google Gemini API
- Security: JWT, bcryptjs, helmet, rate limiting, input validation, XSS/NoSQL sanitization
- Frontend: HTML, CSS, JavaScript

## Project Structure

```
Chat-BOt/
├── backend/           # API Server, Database Models, Socket.io Handlers, AI logic
│   ├── controllers/   # AI chat handler with model fallback
│   ├── middleware/     # Auth, security, moderation, input validation
│   ├── models/        # Mongoose schemas (User, ChatSession)
│   ├── routes/        # Express API routes (auth, history)
│   ├── tests/         # Backend integration test suite
│   ├── server.js      # Express + Socket.io entry point
│   └── .env           # Environment variables (not committed)
├── frontend/          # User Interface (HTML, CSS, JS)
│   ├── css/style.css  # Premium dark theme with glassmorphism
│   ├── js/app.js      # Client-side logic, Socket.io, auth
│   └── index.html     # Single-page app shell
├── vercel.json        # Vercel config (frontend-only deploy)
├── .gitignore
└── README.md
```

## Features

- 🤖 AI streaming responses via Google Gemini with model fallback
- 💬 Real-time messaging via Socket.io
- 🔐 JWT authentication with bcrypt password hashing
- 📜 Persistent conversation history with AI-generated summaries
- 🛡️ Content moderation, rate limiting, XSS/NoSQL injection protection
- 🎨 Responsive UI with a polished dark theme

## Setup & Running

### Requirements
- Node.js (v18+)
- MongoDB (running locally on default port 27017, or MongoDB Atlas)
- Gemini API Key ([Get one here](https://aistudio.google.com/apikey))

### 1. Backend

```bash
cd backend
npm install
```

Copy the example env and fill in your values:
```bash
cp .env.example .env
```

Required environment variables:
| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Random secret for JWT signing (use `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:5500`) |
| `PORT` | Server port (default: `3001`) |

Start the server:
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### 2. Frontend

The frontend is served automatically by Express at `http://localhost:3001`.

For separate development with Live Server:
```bash
cd frontend
npx serve . -p 5500
```
Then set `localStorage.setItem('API_URL', 'http://localhost:3001')` in the browser console.

## Testing

```bash
cd backend

# Start server in test mode (relaxed rate limits)
$env:NODE_ENV="test"; node server.js

# In a separate terminal:
node tests/test_backend.js
node tests/test_ai.js
```

## Deployment

### Option A: Full-Stack on Render / Railway (Recommended)
1. Push code to GitHub
2. Connect repo to [Render](https://render.com) or [Railway](https://railway.app)
3. Set environment variables in the dashboard
4. Set build command: `cd backend && npm install`
5. Set start command: `cd backend && npm start`
6. Use MongoDB Atlas for the database

### Option B: Frontend on Vercel + Backend on Render
1. Deploy frontend to Vercel (uses `vercel.json` — serves `frontend/` as static)
2. Deploy backend to Render/Railway
3. Set `FRONTEND_URL` to your Vercel URL in the backend env vars

> **Note:** Vercel serverless does NOT support WebSockets. The backend must be deployed to a platform that supports persistent connections.

## Portfolio Notes

- Best for showcasing full-stack JavaScript, realtime systems, authentication, and AI integration
- Safe to share publicly because secrets are excluded and environment values live in `.env.example`
- If you want recruiters to test it quickly, add a deployed backend URL here once it is live

## Security Notes

- Never commit `.env` files (already in `.gitignore`)
- Use a strong, random JWT secret in production
- Rate limiting is applied to all routes and stricter on auth endpoints
- Content moderation blocks abusive messages and disconnects repeat offenders
