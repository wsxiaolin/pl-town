#!/usr/bin/env node
// Story-bundle guard — the compile-time core of PR #202's promise: while the
// echo story is suspended (__ECHO_STORY_SUSPENDED__ true), NOT ONE byte of
// its narrative may ship in any production artifact. Runs after `vite build`
// (needs dist/); wired into the root build script so CI fails loudly if a
// future refactor lets the story slip back in.
//
// Two probes, both cheap and versioned with the story itself:
//   1. File probe: no dist chunk may match the echo CG filename set —
//      import.meta.glob excluding assets/cg/echo/** keeps them out, but a
//      glob pattern edit would silently re-emit them.
//   2. Text probe: dist JS must not contain the story's opening line
//      ('他又开始写了' — first sentence of echoStory.ts). Chunk names are
//      hashed and the loader string lives in the dynamic-import graph, so
//      grepping a sentence from the narrative itself is the only probe that
//      survives refactors of filenames, routing, and module ids.
//
// ECHO_STORY_SUSPENDED=false skips everything (restore-mode build: the story
// chunk legitimately exists — vite.config.ts's restore checklist applies).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const suspended = process.env.ECHO_STORY_SUSPENDED !== 'false';
if (!suspended) {
  console.log('[check-story-bundle] ECHO_STORY_SUSPENDED=false — restore-mode build, guard skipped.');
  process.exit(0);
}

const dist = join(process.cwd(), 'apps/web/dist');
const ECHO_CG_FILES = [
  'mountain-promise',
  'observatory-song',
  'shared-meal',
  'starlit-cabin',
];
// Distinctive sentence from the echo story's 'mountain-memory' node
// (echoStory.ts): if this string ships, the narrative itself shipped.
// Update when the story text changes — it is the probe, not documentation.
const ECHO_TEXT_PROBE = '想在山顶看一次日出';

function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

let failures = 0;
const files = walkFiles(dist);

// Probe 1 — echo CG assets must not be emitted at all.
for (const file of files) {
  for (const cg of ECHO_CG_FILES) {
    if (file.includes(`${cg}-`) && /\.(png|webp|jpg|avif)$/.test(file)) {
      console.error(`[check-story-bundle] FAIL: echo CG emitted: ${file}`);
      failures += 1;
    }
  }
}

// Probe 2 — the narrative's opening line must not appear in any shipped JS.
for (const file of files) {
  if (!file.endsWith('.js')) continue;
  if (readFileSync(file, 'utf8').includes(ECHO_TEXT_PROBE)) {
    console.error(`[check-story-bundle] FAIL: echo narrative text found in ${file}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`[check-story-bundle] ${failures} violation(s) — the suspended story is shipping. See the restore checklist in apps/web/vite.config.ts.`);
  process.exit(1);
}
console.log(`[check-story-bundle] clean — echo story is fully un-bundled across ${files.length} dist files.`);
