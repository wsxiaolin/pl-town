import type { IncomingMessage } from 'node:http';

export class HttpBodyError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}

export async function readJson(request: IncomingMessage, maximumBytes = 64_000): Promise<Record<string, unknown>> {
  const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') throw new HttpBodyError('Content-Type must be application/json', 415);
  const rawLength = request.headers['content-length'];
  if (rawLength !== undefined) {
    const declaredLength = typeof rawLength === 'string' && /^\d+$/.test(rawLength) ? Number(rawLength) : Number.NaN;
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) throw new HttpBodyError('Invalid Content-Length', 400);
    if (declaredLength > maximumBytes) throw new HttpBodyError('Request too large', 413);
  }

  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maximumBytes) throw new HttpBodyError('Request too large', 413);
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new HttpBodyError('Invalid JSON object', 400); }
}
