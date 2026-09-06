import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// In-memory ESM transpilation keeps import.meta and avoids a production build.
const moduleUrl = async (path, imports = {}) => {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  for (const [specifier, url] of Object.entries(imports)) source = source.replace(`'${specifier}'`, JSON.stringify(url));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
};
const serverModule = await moduleUrl('../src/network/serverUrl.ts');
const { getServerUrl, getApiUrl, apiFetch } = await import(serverModule);
const location = (hostname, protocol = 'https:') => ({ hostname, protocol });
const path = '/town-api/works?scope=all';

test('explicit URLs win and HTTP uses only the configured origin', () => {
  const host = location('pl-town.pages.dev');
  for (const [server, origin] of [
    ['ws://localhost:8787/socket?token=test', 'http://localhost:8787'],
    ['wss://server.example/socket?token=test', 'https://server.example'],
    ['https://server.example/base/', 'https://server.example'],
  ]) {
    const env = { VITE_SERVER_URL: server };
    assert.equal(getServerUrl(env, host), server);
    assert.equal(getApiUrl(path, env, host), origin + path);
    env.VITE_API_BASE_URL = 'https://api.example:9443/ignored?query=ignored';
    assert.equal(getApiUrl(path, env, host), 'https://api.example:9443' + path);
    assert.equal(getServerUrl(env, host), server);
  }
  assert.equal(getApiUrl(path, { VITE_API_BASE_URL: 'http://api.example/base' }, host), 'http://api.example' + path);
  assert.equal(getServerUrl({ VITE_API_BASE_URL: 'https://api.example' }, host), 'wss://plaqtown.onrender.com');
});

test('product mapping is limited to production and one preview label', () => {
  for (const hostname of ['pl-town.pages.dev', 'abc123.pl-town.pages.dev', 'feature-branch.pl-town.pages.dev']) {
    assert.equal(getServerUrl({}, location(hostname)), 'wss://plaqtown.onrender.com');
    assert.equal(getApiUrl(path, {}, location(hostname)), 'https://plaqtown.onrender.com' + path);
  }
  for (const hostname of ['other.pages.dev', 'a.b.pl-town.pages.dev', 'fakepl-town.pages.dev', 'pl-town.pages.dev.example', 'example.com']) {
    assert.equal(getApiUrl(path, {}, location(hostname)), path);
    assert.equal(getServerUrl({}, location(hostname, 'http:')), `wss://${hostname}:8787`);
  }
});

test('local defaults retain same-origin HTTP and the existing WS transport', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(getApiUrl(path, {}, location(hostname, 'http:')), path);
    assert.equal(getServerUrl({}, location(hostname, 'http:')), `ws://${hostname}:8787`);
    assert.equal(getServerUrl({}, location(hostname)), `wss://${hostname}:8787`);
  }
});

test('apiFetch preserves request options and telemetry resolves Beacon and fetch', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    for (const [key, descriptor] of [['window', originalWindow], ['navigator', originalNavigator]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: location('pl-town.pages.dev') } });
  const beacon = t.mock.fn(() => true);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: beacon } });
  const init = { method: 'POST', headers: { 'x-town-pl-session': 'test' }, body: '{}', keepalive: true, signal: new AbortController().signal };
  await apiFetch(path, init);
  assert.equal(fetch.mock.calls[0].arguments[0], 'https://plaqtown.onrender.com' + path);
  assert.equal(fetch.mock.calls[0].arguments[1], init);
  const { trackEvent } = await import(await moduleUrl('../src/core/telemetryClient.ts', { '../network/serverUrl': serverModule }));
  trackEvent('test.beacon');
  const expected = 'https://plaqtown.onrender.com/town-api/telemetry/event';
  assert.equal(beacon.mock.calls[0].arguments[0], expected);
  assert.equal(fetch.mock.callCount(), 1);
  beacon.mock.mockImplementation(() => false);
  trackEvent('test.fallback');
  assert.equal(fetch.mock.calls[1].arguments[0], expected);
  assert.equal(fetch.mock.calls[1].arguments[1].keepalive, true);
  delete navigator.sendBeacon;
  trackEvent('test.noBeacon');
  assert.equal(fetch.mock.calls[2].arguments[0], expected);
});
