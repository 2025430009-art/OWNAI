import { execSync } from 'node:child_process';
import { createServer } from 'node:net';

export function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

export function killPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(parseInt(pid, 10), 'SIGKILL');
      } catch {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        } catch {
          // ignore protected processes
        }
      }
    }
  } catch {
    // nothing to kill
  }
}

export async function resolveListenPort(preferred) {
  const start = preferred || 3001;
  for (let port = start; port < start + 8; port += 1) {
    if (await isPortFree(port)) return port;
    killPort(port);
    await new Promise((r) => setTimeout(r, 800));
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found between ${start} and ${start + 7}`);
}
