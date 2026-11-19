import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './src/server/app.ts';
import * as fullRepository from './src/db/repository.ts';
import {
  ensureInitialSupabaseSync,
  getSupabaseSyncBlockReason,
  isSupabaseSyncEnabled,
  syncAllTablesToSupabase,
} from './src/lib/supabase-sync.ts';
import { DomainError, isSqlDatabaseConfigured } from './src/db/shared.ts';

const PORT =
  process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;

const app = createApiApp({
  ...fullRepository,
  forceSupabaseSync: async () => {
    if (!isSqlDatabaseConfigured()) return;
    if (!isSupabaseSyncEnabled()) {
      throw new DomainError(
        'As variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ainda não estão configuradas nos Secrets.',
        400
      );
    }
    const blockReason = getSupabaseSyncBlockReason();
    if (blockReason) {
      throw new DomainError(blockReason, 400);
    }
    const ok = await syncAllTablesToSupabase();
    if (!ok) {
      throw new DomainError(
        getSupabaseSyncBlockReason() ||
          'Não foi possível concluir a sincronização com o Supabase. Verifique URL, chave Service Role e se as tabelas foram criadas.',
        502
      );
    }
  },
});

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
