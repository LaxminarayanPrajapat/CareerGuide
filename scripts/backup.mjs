#!/usr/bin/env node
/**
 * Database backup / restore helper.
 *
 * Usage:
 *   node scripts/backup.mjs                  - create a compressed backup
 *   node scripts/backup.mjs --list           - list available backups
 *   node scripts/backup.mjs --restore <file> - restore from a backup
 *   node scripts/backup.mjs --prune 14       - delete backups older than N days
 *
 * The MONGODB_URI is read from server/.env. Backups are written to ./backups
 * (gitignored). An unverified backup is not a backup, so --verify is offered
 * for a dry-run restore into a scratch database.
 */

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import readEnvFile from './readEnvFile.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(ROOT, 'backups');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = argv[index + 1];
  // A following token that is itself a flag means the value was omitted.
  if (next === undefined || next.startsWith('--')) {
    console.error(`--${name} requires a value.`);
    process.exit(1);
  }
  return next;
};

/**
 * MongoDB's backup tools ship separately from the MongoDB server. Fail with an
 * actionable message rather than a bare ENOENT.
 */
function assertToolAvailable(tool) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [tool], { stdio: 'ignore' });
  } catch {
    console.error(`\n  '${tool}' was not found on your PATH.\n`);
    console.error('  The MongoDB Database Tools are installed separately from the server:');
    console.error('    Windows : https://www.mongodb.com/try/download/database-tools');
    console.error('    macOS   : brew install mongodb-database-tools');
    console.error('    Linux   : see https://www.mongodb.com/docs/database-tools/\n');
    console.error('  Alternatively, use mongosh to export data, or your cloud provider');
    console.error('  built-in backup service (MongoDB Atlas continuous backup).\n');
    process.exit(1);
  }
}

function loadUri() {
  const envPath = path.join(ROOT, 'server', '.env');
  if (!existsSync(envPath)) {
    console.error('server/.env not found. Copy server/.env.example to server/.env first.');
    process.exit(1);
  }
  const uri = readEnvFile(envPath).MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in server/.env');
    process.exit(1);
  }
  return uri;
}

function dbNameFromUri(uri) {
  const fromEnv = readEnvFile(path.join(ROOT, 'server', '.env')).MONGODB_DB_NAME;
  if (fromEnv) return fromEnv;
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'mongodb://'));
    return parsed.pathname.replace(/^\//, '') || 'career_guide';
  } catch {
    return 'career_guide';
  }
}

function ensureDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
}

async function create() {
  assertToolAvailable('mongodump');
  const uri = loadUri();
  const db = dbNameFromUri(uri);
  ensureDir();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${db}-${stamp}.archive.gz`);

  console.log(`Backing up database "${db}" ...`);
  const startedAt = Date.now();
  await exec('mongodump', ['--uri', uri, '--db', db, '--gzip', '--archive', file]);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const sizeMb = (statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`Backup complete: ${file} (${sizeMb} MB in ${seconds}s)`);
}

function list() {
  if (!existsSync(BACKUP_DIR)) {
    console.log('No backups directory yet.');
    return;
  }
  const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.archive.gz'));
  if (files.length === 0) {
    console.log('No backups found.');
    return;
  }
  console.log(`Backups in ${BACKUP_DIR}:`);
  for (const file of files.sort()) {
    const stats = statSync(path.join(BACKUP_DIR, file));
    console.log(
      `  ${file}  ${(stats.size / 1024 / 1024).toFixed(2)} MB  ${stats.mtime.toISOString().slice(0, 19)}`,
    );
  }
}

async function restore() {
  const file = value('restore');
  if (!file) {
    console.error('Usage: node scripts/backup.mjs --restore <path-to-archive.gz>');
    process.exit(1);
  }
  const absolute = path.isAbsolute(file) ? file : path.join(BACKUP_DIR, file);
  if (!existsSync(absolute)) {
    console.error(`Backup not found: ${absolute}`);
    process.exit(1);
  }
  assertToolAvailable('mongorestore');

  const uri = loadUri();
  const target = flag('verify') ? `${dbNameFromUri(uri)}_restore_check` : dbNameFromUri(uri);

  console.log(
    flag('verify')
      ? `Dry-run: restoring into scratch database "${target}" ...`
      : `Restoring into "${target}" (existing data will be dropped) ...`,
  );
  if (!flag('verify')) {
    console.log('   Re-run with --verify to restore into a scratch database instead.');
  }

  await exec('mongorestore', [
    '--uri', uri,
    '--gzip',
    '--archive', absolute,
    '--db', target,
    '--drop',
  ]);
  console.log(`Restore complete: "${target}"`);
  if (flag('verify')) {
    console.log(`\nVerify counts in ${target}, then drop it when satisfied:`);
    console.log(`  mongosh --eval 'db.getSiblingDB("${target}").users.countDocuments()'`);
    console.log(`  mongosh --eval 'db.getSiblingDB("${target}").dropDatabase()'`);
  }
}

function prune() {
  const days = Number(value('prune') ?? 14);
  if (!existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - days * 86400000;
  let removed = 0;
  for (const file of readdirSync(BACKUP_DIR)) {
    if (!file.endsWith('.archive.gz')) continue;
    const target = path.join(BACKUP_DIR, file);
    if (statSync(target).mtimeMs < cutoff) {
      unlinkSync(target);
      removed += 1;
    }
  }
  console.log(`Removed ${removed} backup(s) older than ${days} days.`);
}

async function main() {
  if (flag('list')) return list();
  if (flag('restore')) return restore();
  if (flag('prune')) return prune();
  return create();
}

main().catch((error) => {
  console.error('Backup operation failed:', error.stderr || error.message);
  process.exit(1);
});
