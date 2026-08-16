import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

function waitForPort(port: number, host = '127.0.0.1', timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const sock = createConnection({ port, host }, () => { sock.end(); resolve(); });
      sock.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`port ${port} not up in ${timeout}ms`));
        else setTimeout(probe, 400);
      });
    };
    probe();
  });
}

async function main() {
  const preview = spawn('npm', ['run', 'preview', '-w', '@minicity/web', '--', '--port', '4173', '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'], cwd: '/work',
  });
  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  try {
    await waitForPort(4173);
    console.log('preview up');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      const NW = window.WebSocket;
      class O extends EventTarget { readyState = NW.CONNECTING; send(){} close(){ this.readyState = NW.CLOSED; } }
      Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NW, { construct(T, a) { return String(a[0]).includes(':8787') ? new O() : Reflect.construct(T, a); } }) });
      localStorage.setItem('minicityCGSeenV3', 'true');
      localStorage.setItem('minicityUser', 'diag');
      localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
    });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
    console.log('navigating...');
    await page.goto('http://127.0.0.1:4173/');
    console.log('waiting for __mini player...');
    await page.waitForFunction(() => Boolean((window as any).__mini?.().player), undefined, { timeout: 90_000 });
    console.log('player ready');
    await page.waitForFunction(() => document.getElementById('bootScreen')?.classList.contains('is-ready'), undefined, { timeout: 90_000 });
    console.log('boot ready');
    await page.waitForTimeout(1500);
    const webgl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl2') || c.getContext('webgl');
      return g ? g.getParameter(g.RENDERER) : 'NO WEBGL';
    });
    console.log('webgl renderer:', webgl);
    const shot = await page.screenshot();
    fs.mkdirSync('diagnostics-output', { recursive: true });
    fs.writeFileSync('diagnostics-output/min-boot.png', shot);
    console.log('saved min-boot.png size', shot.length);
    await browser.close();
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
