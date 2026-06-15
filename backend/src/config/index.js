import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  modelPath: process.env.MODEL_PATH || path.resolve(__dirname, '../../../models'),
  defaultModelSrc: process.env.DEFAULT_MODEL_SRC || 'LLAMA_3_2_1B_INST_Q4_0',
  modelCtxSize: parseInt(process.env.MODEL_CTX_SIZE || '2048', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://ownai:ownai@localhost:5432/ownai',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,https://2025430009-art.github.io')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname, '../../../uploads/attachments'),
  uploadMaxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || String(10 * 1024 * 1024), 10),
  uploadMaxFiles: parseInt(process.env.UPLOAD_MAX_FILES || '5', 10),
  uploadTextMaxChars: parseInt(process.env.UPLOAD_TEXT_MAX_CHARS || '12000', 10),
  security: {
    requireAuth: process.env.REQUIRE_API_AUTH === 'true'
      || (process.env.NODE_ENV === 'production' && process.env.REQUIRE_API_AUTH !== 'false'),
    apiKey: process.env.API_KEY || null,
  },
};

const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-in-production',
  'change-me-in-production',
  'change-me-to-a-long-random-secret',
]);

export function assertSecureConfig() {
  if (config.nodeEnv !== 'production') return;

  const secret = process.env.JWT_SECRET || config.jwt.secret;
  if (!secret || INSECURE_JWT_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value in production. Update your .env file.',
    );
  }

  if (config.security.requireAuth && !config.security.apiKey) {
    console.warn(
      '[security] REQUIRE_API_AUTH is enabled but API_KEY is not set — only JWT auth will be accepted.',
    );
  }
}
