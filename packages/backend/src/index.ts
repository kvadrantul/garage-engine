// Main Server Entry Point

import express, { type Express } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initializeDatabase } from './db/index.js';
import { workflowsRouter } from './api/workflows.js';
import { executionsRouter } from './api/executions.js';
import { hitlRouter } from './api/hitl.js';
import { credentialsRouter } from './api/credentials.js';
import { customNodesRouter } from './api/custom-nodes.js';
import { webhookRouter } from './webhooks/webhook-handler.js';
import { initExecutionService } from './services/execution-service.js';
import { initScheduler } from './services/scheduler.js';
import { loadCustomNodes } from './nodes/custom/custom-node-loader.js';

const PORT = process.env.PORT || 3000;

// Initialize Express
const app: Express = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = createServer(app);

// WebSocket Setup
const wss = new WebSocketServer({ server, path: '/ws' });

// Track subscriptions
const subscriptions = new Map<string, Set<WebSocket>>();

// Broadcast function for execution events
export function broadcastExecutionEvent(
  executionId: string,
  event: { type: string; payload: unknown },
) {
  const clients = subscriptions.get(executionId);
  if (!clients) return;

  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  // Also broadcast to all clients (for dashboard updates)
  broadcastAll(event);
}

function broadcastAll(event: { type: string; payload: unknown }) {
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Create execution service with broadcast
export const executionService = initExecutionService(broadcastExecutionEvent);

// API Routes
app.use('/api/workflows', workflowsRouter);
app.use('/api/executions', executionsRouter);
app.use('/api/hitl', hitlRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/custom-nodes', customNodesRouter);

// Webhook Handler
app.use('/webhooks', webhookRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe:execution': {
          const executionId = message.executionId;
          if (!subscriptions.has(executionId)) {
            subscriptions.set(executionId, new Set());
          }
          subscriptions.get(executionId)!.add(ws);
          break;
        }

        case 'unsubscribe:execution': {
          const executionId = message.executionId;
          subscriptions.get(executionId)?.delete(ws);
          break;
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    for (const [executionId, clients] of subscriptions) {
      clients.delete(ws);
      if (clients.size === 0) {
        subscriptions.delete(executionId);
      }
    }
  });
});

// Initialize database and start server
initializeDatabase();

// Load custom nodes from manifests + DB
loadCustomNodes();

// Initialize scheduler for cron jobs
const scheduler = initScheduler();
scheduler.initialize().catch(console.error);

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         ORCHESTRATOR SERVER               ║
  ╠═══════════════════════════════════════════╣
  ║  HTTP:  http://localhost:${PORT}             ║
  ║  WS:    ws://localhost:${PORT}/ws            ║
  ╚═══════════════════════════════════════════╝
  `);
});

export { app, server, wss };
