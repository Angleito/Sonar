#!/usr/bin/env bun
/**
 * Concurrent Development Server Script
 * Runs both backend and frontend servers simultaneously
 */

import { spawn } from 'child_process';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const backendDir = join(rootDir, 'backend');
const frontendDir = join(rootDir, 'frontend');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(service: string, message: string, color: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] [${service}]${colors.reset} ${message}`);
}

// Start backend server
const backend = spawn('bun', ['run', 'dev'], {
  cwd: backendDir,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

// Start frontend server
const frontend = spawn('bun', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

// Handle backend output
backend.stdout?.on('data', (data) => {
  const message = data.toString().trim();
  if (message) log('BACKEND', message, colors.cyan);
});

backend.stderr?.on('data', (data) => {
  const message = data.toString().trim();
  if (message) log('BACKEND', message, colors.red);
});

// Handle frontend output
frontend.stdout?.on('data', (data) => {
  const message = data.toString().trim();
  if (message) log('FRONTEND', message, colors.green);
});

frontend.stderr?.on('data', (data) => {
  const message = data.toString().trim();
  if (message) log('FRONTEND', message, colors.yellow);
});

// Handle process exits
backend.on('exit', (code) => {
  log('BACKEND', `Exited with code ${code}`, colors.red);
  frontend.kill();
  process.exit(code || 0);
});

frontend.on('exit', (code) => {
  log('FRONTEND', `Exited with code ${code}`, colors.red);
  backend.kill();
  process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nShutting down servers...');
  backend.kill();
  frontend.kill();
  process.exit(0);
});

console.log(`${colors.bright}${colors.green}
╔═══════════════════════════════════════════════════════════╗
║                  SONAR Development Servers                ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}

${colors.cyan}Backend:${colors.reset}  http://localhost:3001
${colors.green}Frontend:${colors.reset} http://localhost:3000

Press ${colors.bright}Ctrl+C${colors.reset} to stop both servers
`);
