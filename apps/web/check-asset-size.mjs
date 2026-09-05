import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the runtime asset tree from growing back after the 2026-09 texture
// shrink pass (120 PNGs reduced from 81.7 MiB to 42.3 MiB).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const assetRoot = join(repoRoot, 'apps', 'web', 'src', 'assets');
const maxFileBytes = 1024 * 1024; // 1 MiB per asset file
const maxTotalBytes = 48 * 1024 * 1024; // 48 MiB for the whole asset tree

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const files = collectFiles(assetRoot);
let total = 0;
const violations = [];
for (const path of files) {
  const size = statSync(path).size;
  total += size;
  if (size > maxFileBytes) {
    violations.push({ path: relative(repoRoot, path).split(sep).join('/'), size, limit: maxFileBytes });
  }
}
if (total > maxTotalBytes) {
  violations.push({ path: 'apps/web/src/assets (total)', size: total, limit: maxTotalBytes });
}

if (violations.length) {
  console.error('Asset size limit exceeded:');
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${(violation.size / 1024 / 1024).toFixed(2)} MiB (limit ${(violation.limit / 1024 / 1024).toFixed(0)} MiB)`);
  }
  process.exitCode = 1;
} else {
  console.log(`Asset size check passed: ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MiB (limit ${(maxTotalBytes / 1024 / 1024).toFixed(0)} MiB).`);
}
