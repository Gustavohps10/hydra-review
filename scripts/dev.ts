import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');

// 1. Inicia o MCP Server local a partir de mcp/server.ts
const mcp: ChildProcess = spawn('npx', ['tsx', 'mcp/server.ts'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: true,
});

// 2. Inicia o ambiente WXT de desenvolvimento
const wxt: ChildProcess = spawn('npx', ['wxt'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: true,
});

function cleanup(): void {
  try {
    if (process.platform === 'win32') {
      if (mcp.pid) spawn('taskkill', ['/pid', String(mcp.pid), '/f', '/t'], { stdio: 'ignore' });
      if (wxt.pid) spawn('taskkill', ['/pid', String(wxt.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      mcp.kill('SIGTERM');
      wxt.kill('SIGTERM');
    }
  } catch {}
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', cleanup);

wxt.on('close', (code) => {
  cleanup();
  process.exit(code || 0);
});
