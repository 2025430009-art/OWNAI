import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config, assertSecureConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';
import openaiRouter from './routes/openai.js';
import { initDatabase } from './db/index.js';
import { initMongo } from './db/mongo.js';
import { resolveListenPort } from '../scripts/ensure-port.js';

const __dirnameServer = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirnameServer, '../..');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OWN AI Platform API',
      version: '1.0.0',
      description: 'REST API for QVAC-powered AI inference',
    },
    servers: [
      { url: '/', description: 'This server (uses the host and port you opened)' },
      { url: `http://localhost:${config.port}`, description: `Localhost port ${config.port}` },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
});

const app = express();

function swaggerBasicAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : decoded;
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';
    if (user === process.env.SWAGGER_USER && password === process.env.SWAGGER_PASSWORD) {
      return next();
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="OWN AI API Docs"');
  return res.status(401).send('Authentication required');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigin.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

// Swagger UI documents every endpoint and is an attack-surface map — keep it off in production
// unless explicitly enabled (SWAGGER_ENABLED=true) with HTTP Basic Auth credentials.
if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
  const swaggerUiSetup = swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'OWN AI API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  if (process.env.NODE_ENV === 'production') {
    app.use('/api-docs', swaggerBasicAuth, swaggerUi.serve, swaggerUiSetup);
    app.get('/api-docs.json', swaggerBasicAuth, (_req, res) => res.json(swaggerSpec));
  } else {
    app.use('/api-docs', swaggerUi.serve, swaggerUiSetup);
    app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
  }
}

app.get('/', (_req, res) => {
  const frontendUrl = config.nodeEnv === 'production'
    ? (config.corsOrigin.find((o) => o.includes('github.io')) || config.corsOrigin[0] || null)
    : 'http://localhost:5176';
  res.json({
    success: true,
    name: 'OWN AI Platform API',
    version: '1.0.0',
    status: 'running',
    docs: '/api-docs',
    health: '/api/v1/health',
    endpoints: {
      api: '/api/v1',
      openai: '/v1',
    },
    frontend: frontendUrl,
    hint: frontendUrl
      ? `API is live. Open the web app at ${frontendUrl}`
      : 'API is live. Connect your frontend to this origin.',
  });
});

app.use('/api/v1', apiRouter);
app.use('/v1', openaiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    assertSecureConfig();
  } catch (error) {
    console.error(`[OWN AI] Startup blocked: ${error.message}`);
    logger.error(error.message);
    process.exit(1);
  }

  try {
    await initDatabase();
  } catch (error) {
    logger.warn('Database unavailable — auth/usage features disabled', { error: error.message });
  }

  await initMongo();

  const listenPort = await resolveListenPort(config.port);

  try {
    await fs.writeFile(path.join(PROJECT_ROOT, '.backend-port'), String(listenPort), 'utf8');
  } catch {
    // non-fatal — vite proxy may use PORT env instead
  }

  const server = createServer(app);

  const ptvWss = new WebSocketServer({ noServer: true });
  const { attachPromptToVideoWs } = await import('./services/promptToVideo/orchestrator.js');
  attachPromptToVideoWs(ptvWss);

  ptvWss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', jobId: ws.jobId || null }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && msg.jobId) {
          ws.jobId = msg.jobId;
          ws.send(JSON.stringify({ type: 'subscribed', jobId: msg.jobId }));
        }
      } catch {
        // ignore invalid client messages
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/v1/prompt-to-video/ws') {
      ptvWss.handleUpgrade(request, socket, head, (ws) => {
        const jobId = url.searchParams.get('jobId');
        if (jobId) ws.jobId = jobId;
        ptvWss.emit('connection', ws, request);
      });
      return;
    }
    socket.destroy();
  });

  const { ensurePromptToVideoDirs } = await import('./services/promptToVideo/videoJobStore.js');
  await ensurePromptToVideoDirs().catch(() => {});

  const host = process.env.HOST || '0.0.0.0';
  const publicUrl = process.env.RENDER_EXTERNAL_URL
    || (config.nodeEnv === 'production' ? `http://0.0.0.0:${listenPort}` : `http://localhost:${listenPort}`);

  server.listen(listenPort, host, () => {
    console.log(`OWN AI API running on http://localhost:${listenPort}`);
    logger.info(`OWN AI API running on ${publicUrl}`);
    if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
      logger.info(`Swagger docs at ${publicUrl.replace(/\/$/, '')}/api-docs`);
    }
    logger.info(`OpenAI-compatible API at ${publicUrl.replace(/\/$/, '')}/v1`);
    if (listenPort !== config.port && config.nodeEnv !== 'production') {
      logger.warn(`Port ${config.port} was busy — using ${listenPort} instead`);
    }
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      const { modelManager } = await import('./services/modelManager.js');
      const { disconnectMongo } = await import('./db/mongo.js');
      await modelManager.unloadAll().catch(() => {});
      await disconnectMongo().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error(`[OWN AI] Failed to start server: ${error.message}`);
  logger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});

export default app;
