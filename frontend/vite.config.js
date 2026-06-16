import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function readBackendPort(env) {
  try {
    const fromFile = fs.readFileSync(path.join(projectRoot, '.backend-port'), 'utf8').trim();
    if (fromFile) return fromFile;
  } catch {
    // backend not started yet
  }
  return env.PORT || '3000';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const backendPort = readBackendPort(env);
  const isGitHubPages = process.env.GITHUB_PAGES === 'true';

  return {
    base: isGitHubPages ? '/OWNAI/' : '/',
    plugins: [react()],
    server: {
      port: 5176,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/v1': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
