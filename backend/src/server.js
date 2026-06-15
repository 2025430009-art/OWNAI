import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config, assertSecureConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';
import openaiRouter from './routes/openai.js';
import { initDatabase } from './db/index.js';
import { modelManager } from './services/modelManager.js';
import { resolveListenPort } from '../scripts/ensure-port.js';

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
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'OWN AI API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  },
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

app.get('/', (_req, res) => {
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
    hint: 'This is the API server. Open the React app at http://localhost:5173 (or your Vite dev port).',
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
    logger.error(error.message);
    process.exit(1);
  }

  try {
    await initDatabase();
    logger.info('Database ready');
  } catch (error) {
    logger.warn('Database unavailable — auth/usage features disabled', { error: error.message });
  }

  const listenPort = await resolveListenPort(config.port);

  const server = app.listen(listenPort, () => {
    logger.info(`OWN AI API running on http://localhost:${listenPort}`);
    logger.info(`Swagger docs at http://localhost:${listenPort}/api-docs`);
    logger.info(`OpenAI-compatible API at http://localhost:${listenPort}/v1`);
    if (listenPort !== config.port) {
      logger.warn(`Port ${config.port} was busy — using ${listenPort} instead`);
    }
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await modelManager.unloadAll().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});

export default app;
