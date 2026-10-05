import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';

// `apps/server/admin` is the admin console's browser bundle; it grows like any
// other logic file, so include it rather than trusting a hand-written comment
// that it is "close to the limit".
const roots = ['apps/web/src', 'apps/server/src', 'apps/server/admin'];
const sourceExtensions = new Set(['.js', '.mjs', '.ts', '.tsx']);
const dataDirectories = new Set(['content', 'data']);
const defaultLimit = 1_000;

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && dataDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const violations = [];
for (const root of roots) {
  for (const path of collectSourceFiles(root)) {
    const normalizedPath = relative('.', path).split(sep).join('/');
    const lines = readFileSync(path, 'utf8').split(/\r?\n/).length;
    if (lines > defaultLimit) violations.push({ path: normalizedPath, lines, limit: defaultLimit });
  }
}

if (violations.length) {
  console.error('Logic source size limit exceeded:');
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lines} lines (limit ${violation.limit})`);
  }
  process.exitCode = 1;
} else {
  console.log('Logic source size check passed.');
}
