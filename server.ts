import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './src/server/app.ts';
import { ensureInitialSupabaseSync } from './src/lib/supabase-sync.ts';
import { isSqlDatabaseConfigured } from './src/db/shared.ts';

const PORT =
  process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
const app = createApiApp();

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'Rota de API não encontrada.' });
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`QHS Engenharia server listening on http://0.0.0.0:${PORT}`);
    if (isSqlDatabaseConfigured()) {
      void ensureInitialSupabaseSync();
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
