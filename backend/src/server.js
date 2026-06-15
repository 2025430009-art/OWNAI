import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';
import openaiRouter from './routes/openai.js';
import { initDatabase } from './db/index.js';
import { modelManager } from './services/modelManager.js';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OWN AI Platform API',
      version: '1.0.0',
      description: 'REST API for QVAC-powered AI inference',
    },
    servers: [{ url: `http://localhost:${config.port}`, description: 'Development' }],
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

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/v1', apiRouter);
app.use('/v1', openaiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await initDatabase();
    logger.info('Database ready');
  } catch (error) {
    logger.warn('Database unavailable — auth/usage features disabled', { error: error.message });
  }

  const server = app.listen(config.port, () => {
    logger.info(`OWN AI API running on http://localhost:${config.port}`);
    logger.info(`Swagger docs at http://localhost:${config.port}/api-docs`);
    logger.info(`OpenAI-compatible API at http://localhost:${config.port}/v1`);
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
