import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/server/app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/';
  if (rawUrl.startsWith('/api/index')) {
    const parsed = new URL(rawUrl, 'http://localhost');
    const pathParam = parsed.searchParams.get('__path') || '';
    parsed.searchParams.delete('__path');
    const remainingQuery = parsed.searchParams.toString();
    req.url = `/api/${pathParam.replace(/^\/+/, '')}${remainingQuery ? `?${remainingQuery}` : ''}`;
  }
  return app(req as unknown as Parameters<typeof app>[0], res as unknown as Parameters<typeof app>[1]);
}
