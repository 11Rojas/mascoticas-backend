import 'dotenv/config';
import { Hono } from 'hono'
import authRouter from './routes/auth/auth';
import userRouter from './routes/user';
import mongoose from 'mongoose';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun'
import { setServerInstance, broadcastToChat, broadcastGlobal } from './libs/ws';

const { upgradeWebSocket, websocket } = createBunWebSocket()

const onlineUsers = new Map<any, string>(); // ws.raw -> userId

const app = new Hono()

// ── CORS ────────────────────────────────────────────────────────────────────
const envOrigin = process.env.ALLOWED_ORIGIN;
const allowedOrigins = Array.from(new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://mascoticas.app',
  'https://www.mascoticas.app',
  ...(envOrigin ? [envOrigin] : []),
]));

app.use(cors({
  // Return the matched origin (required for credentials) or null to reject
  origin: (origin) => {
    if (!origin) return origin;                              // server-to-server / Postman
    return allowedOrigins.includes(origin) ? origin : null; // null = rejected
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-better-auth-origin', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
}));


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/mascoticas?authSource=admin").then(() => {
  console.log("Connected to MongoDB");
});

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// WebSocket Endpoint
app.get('/ws', upgradeWebSocket((c) => {
  return {
    onOpen(_evt, ws) {
      (ws.raw as any).subscribe('global_presence');
    },
    onMessage(evt, ws) {
      const data = JSON.parse(evt.data as string)

      if (data.type === 'presence_join') {
        onlineUsers.set(ws.raw, data.userId);
        broadcastGlobal({
          type: 'presence_update',
          onlineUserIds: Array.from(new Set(onlineUsers.values()))
        });
        console.log(`WS User Joined Presence: ${data.userId}`);
      }

      if (data.type === 'subscribe') {
        const chatId = data.chatId;
        (ws.raw as any).subscribe(chatId);
        console.log(`WS User Subscribed to chat: ${chatId}`)
      }

      if (data.type === 'typing') {
        broadcastToChat(data.chatId, {
          type: 'typing',
          chatId: data.chatId,
          userId: data.userId
        });
      }
    },
    onClose: (_evt, ws) => {
      const userId = onlineUsers.get(ws.raw);
      if (userId) {
        onlineUsers.delete(ws.raw);
        broadcastGlobal({
          type: 'presence_update',
          onlineUserIds: Array.from(new Set(onlineUsers.values()))
        });
      }
      console.log('WS Connection Closed')
    },
  }
}))

app.route('/api', authRouter);
app.route('/api/user', userRouter);

// Capture server instance from fetch
const mainFetch = (req: Request, server: any) => {
  setServerInstance(server);
  return app.fetch(req, server);
};

export default {
  port: 3001,
  fetch: mainFetch,
  websocket
}
