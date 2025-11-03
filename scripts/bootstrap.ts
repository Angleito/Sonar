#!/usr/bin/env bun

import { access, readFile } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

type EnvCheckResult = {
  workspace: string;
  missingKeys: string[];
  missingFile: boolean;
};

const rootDir = path.resolve(path.dirname(import.meta.dir), '..');
const backendDir = path.join(rootDir, 'backend');
const workspaces: Array<{ name: string; example: string; actual: string }> = [
  {
    name: 'backend',
    example: path.join(backendDir, '.env.example'),
    actual: path.join(backendDir, '.env'),
  },
  {
    name: 'frontend',
    example: path.join(rootDir, 'frontend', '.env.example'),
    actual: path.join(rootDir, 'frontend', '.env'),
  },
];

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  label: string
): Promise<void> {
  console.log(`\n➡️  ${label}`);
  const subprocess = Bun.spawn({
    cmd: [command, ...args],
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await subprocess.exited;

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
}

function parseEnvKeys(contents: string): Set<string> {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=')[0]!.trim())
    .filter((key) => key.length > 0)
    .reduce((set, key) => set.add(key), new Set<string>());
}

async function validateEnvFiles(): Promise<EnvCheckResult[]> {
  const results: EnvCheckResult[] = [];

  for (const workspace of workspaces) {
    const { name, example, actual } = workspace;
    let missingFile = false;
    let missingKeys: string[] = [];

    try {
      await access(example, constants.R_OK);
    } catch (error) {
      console.warn(`⚠️  Missing ${name} example env file at ${example}`);
      results.push({ workspace: name, missingKeys: [], missingFile: true });
      continue;
    }

    const exampleContents = await readFile(example, 'utf8');
    const requiredKeys = parseEnvKeys(exampleContents);

    try {
      await access(actual, constants.R_OK);
    } catch {
      missingFile = true;
      missingKeys = [...requiredKeys];
    }

    if (!missingFile) {
      const actualContents = await readFile(actual, 'utf8');
      const actualKeys = parseEnvKeys(actualContents);
      missingKeys = [...requiredKeys].filter((key) => !actualKeys.has(key));
    }

    results.push({ workspace: name, missingKeys, missingFile });
  }

  return results;
}

async function main() {
  console.log('🔧 SONAR repository bootstrap starting...');

  await runCommand('bun', ['install'], rootDir, 'Install workspace dependencies');

  console.log('\n🧪 Validating environment configuration');
  const envResults = await validateEnvFiles();
  const invalidEnvs = envResults.filter(
    (result) => result.missingFile || result.missingKeys.length > 0
  );

  if (invalidEnvs.length > 0) {
    console.warn('\n❌ Environment validation failed:');
    for (const result of invalidEnvs) {
      if (result.missingFile) {
        console.warn(
          `  • ${result.workspace}: .env file missing. Copy from .env.example and update values.`
        );
      } else if (result.missingKeys.length > 0) {
        console.warn(
          `  • ${result.workspace}: missing keys -> ${result.missingKeys.join(', ')}`
        );
      }
    }
    console.warn('\nPlease address the missing configuration and re-run the bootstrap script.');
    process.exit(1);
  }

  await runCommand('bun', ['run', 'generate'], backendDir, 'Generate Prisma client');
  await runCommand('bun', ['run', 'db:push'], backendDir, 'Synchronize database schema');

  console.log('\n✅ Bootstrap complete! You can now run `bun run dev` to start the stack.');
}

main().catch((error) => {
  console.error('\n🚨 Bootstrap failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
