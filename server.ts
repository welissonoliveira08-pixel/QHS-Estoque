import http from 'node:http';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { requireAdmin, requireAuth, requireDirectDelete } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  approveDeletionRequestInDb,
  approveNegativeRequestInDb,
  checkEmailInvitationStatus,
  createCollaboratorInDb,
  createDeletionRequestInDb,
  createNegativeRequestInDb,
  createProductInDb,
  createUserInDb,
  deleteCollaboratorInDb,
  deleteMovementInDb,
  deleteNegativeRequestInDb,
  deleteProductInDb,
  deleteUserInDb,
  DomainError,
  getBootstrapData,
  recordMovementInDb,
  rejectDeletionRequestInDb,
  rejectNegativeRequestInDb,
  resetAllDataInDb,
  toggleCollaboratorActiveInDb,
  updateCollaboratorInDb,
  updateManagedListsInDb,
  updateProductInDb,
  updateSystemSettingsInDb,
  updateUserDeletePermissionInDb,
  updateUserInDb,
  updateUserPermissionsInDb,
} from './src/db/repository.ts';
import {
  ensureInitialSupabaseSync,
  getSupabaseSyncBlockReason,
  isSupabaseSyncEnabled,
  syncAllTablesToSupabase,
} from './src/lib/supabase-sync.ts';

const PORT =
  process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
const app = express();

app.use(express.json({ limit: '5mb' }));

const asyncHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Pre-registration check for first access by email
app.post(
  '/api/auth/verify-invite',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const status = await checkEmailInvitationStatus(email);
    if (!status.authorized) {
      res.status(403).json({ error: status.message || 'E-mail não autorizado.' });
      return;
    }
    res.json(status);
  })
);

// Bootstrap all state for authenticated & authorized user
app.get(
  '/api/bootstrap',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await getBootstrapData(req.dbUser!, req.user!.uid);
    res.json(data);
  })
);

// Settings: Toggle product photos (any authenticated user)
app.patch(
  '/api/settings/photos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const showProductPhotos = Boolean(req.body?.showProductPhotos);
    await updateSystemSettingsInDb({ showProductPhotos });
    res.json({ ok: true, showProductPhotos });
  })
);

// Settings: Update full settings (Admin only)
app.put(
  '/api/settings',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await updateSystemSettingsInDb(req.body ?? {});
    res.json({ ok: true });
  })
);

// Managed Lists (Admin only)
app.put(
  '/api/lists',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { lists, renameGroup, renameRole } = req.body ?? {};
    if (!lists || !Array.isArray(lists.groups) || !Array.isArray(lists.roles) || !Array.isArray(lists.destinations)) {
      throw new DomainError('Dados de listas inválidos.', 400);
    }
    await updateManagedListsInDb({ lists, renameGroup, renameRole });
    res.json({ ok: true });
  })
);

// Users / App Access (Admin only)
app.post(
  '/api/users',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const created = await createUserInDb(req.body ?? {});
    res.status(201).json(created);
  })
);

app.put(
  '/api/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const updated = await updateUserInDb({ ...(req.body ?? {}), id });
    res.json(updated);
  })
);

app.patch(
  '/api/users/:id/permissions',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await updateUserPermissionsInDb(id, req.body?.permissions ?? {});
    res.json({ ok: true });
  })
);

app.patch(
  '/api/users/:id/delete-permission',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await updateUserDeletePermissionInDb(id, Boolean(req.body?.canDelete));
    res.json({ ok: true });
  })
);

app.delete(
  '/api/users/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await deleteUserInDb(id);
    res.json({ ok: true });
  })
);

// Collaborators (Field workers without app access)
app.post(
  '/api/collaborators',
  requireAuth,
  asyncHandler(async (req, res) => {
    const created = await createCollaboratorInDb({
      ownerUid: req.user!.uid,
      fullName: String(req.body?.fullName ?? ''),
      role: req.body?.role ? String(req.body.role) : '',
      active: req.body?.active !== undefined ? Boolean(req.body.active) : true,
    });
    res.status(201).json(created);
  })
);

app.put(
  '/api/collaborators/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const updated = await updateCollaboratorInDb({
      id,
      fullName: String(req.body?.fullName ?? ''),
      role: req.body?.role ? String(req.body.role) : '',
      active: Boolean(req.body?.active),
    });
    res.json(updated);
  })
);

app.patch(
  '/api/collaborators/:id/toggle',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const updated = await toggleCollaboratorActiveInDb(id);
    res.json(updated);
  })
);

app.delete(
  '/api/collaborators/:id',
  requireAuth,
  requireDirectDelete,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const deletedName = await deleteCollaboratorInDb({
      collaboratorId: id,
      actor: req.dbUser!,
      actorEmail: req.user!.email || req.dbUser!.email,
      actorUid: req.user!.uid,
    });
    res.json({ ok: true, deletedName });
  })
);

// Products
app.post(
  '/api/products',
  requireAuth,
  asyncHandler(async (req, res) => {
    const created = await createProductInDb(req.user!.uid, req.body ?? {});
    res.status(201).json(created);
  })
);

app.put(
  '/api/products/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const updated = await updateProductInDb({ ...(req.body ?? {}), id });
    res.json(updated);
  })
);

app.delete(
  '/api/products/:id',
  requireAuth,
  requireDirectDelete,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const deletedName = await deleteProductInDb({
      productId: id,
      actor: req.dbUser!,
      actorEmail: req.user!.email || req.dbUser!.email,
      actorUid: req.user!.uid,
    });
    res.json({ ok: true, deletedName });
  })
);

// Stock Movements
app.post(
  '/api/movements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await recordMovementInDb({
      id: req.body?.id,
      productId: String(req.body?.productId ?? ''),
      type: req.body?.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
      quantity: Number(req.body?.quantity ?? 0),
      date: req.body?.date ? String(req.body.date) : undefined,
      withdrawnBy: req.body?.withdrawnBy ? String(req.body.withdrawnBy) : undefined,
      collaboratorId: req.body?.collaboratorId ? String(req.body.collaboratorId) : undefined,
      destination: req.body?.destination ? String(req.body.destination) : undefined,
      notes: req.body?.notes ? String(req.body.notes) : undefined,
      isNegativeStockAuthorized:
        req.body?.isNegativeStockAuthorized !== undefined
          ? Boolean(req.body.isNegativeStockAuthorized)
          : undefined,
      authorizedBy: req.body?.authorizedBy ? String(req.body.authorizedBy) : undefined,
      actor: req.dbUser!,
      actorUid: req.user!.uid,
    });
    res.status(201).json(result);
  })
);

app.delete(
  '/api/movements/:id',
  requireAuth,
  requireDirectDelete,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await deleteMovementInDb({
      movementId: id,
      actor: req.dbUser!,
      actorEmail: req.user!.email || req.dbUser!.email,
      actorUid: req.user!.uid,
    });
    res.json({ ok: true, ...result });
  })
);

// Negative Stock Requests
app.post(
  '/api/negative-requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await createNegativeRequestInDb({
      id: req.body?.id,
      productId: String(req.body?.productId ?? ''),
      requestedQuantity: Number(req.body?.requestedQuantity ?? 0),
      withdrawnBy: String(req.body?.withdrawnBy ?? ''),
      collaboratorId: req.body?.collaboratorId ? String(req.body.collaboratorId) : undefined,
      destination: String(req.body?.destination ?? ''),
      reason: String(req.body?.reason ?? ''),
      actor: req.dbUser!,
      actorUid: req.user!.uid,
    });
    res.status(201).json(result);
  })
);

app.post(
  '/api/negative-requests/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await approveNegativeRequestInDb({
      requestId: id,
      admin: req.dbUser!,
      adminUid: req.user!.uid,
    });
    res.json({ ok: true, ...result });
  })
);

app.post(
  '/api/negative-requests/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await rejectNegativeRequestInDb(id, req.dbUser!.name);
    res.json({ ok: true });
  })
);

app.delete(
  '/api/negative-requests/:id',
  requireAuth,
  requireDirectDelete,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await deleteNegativeRequestInDb({
      requestId: id,
      actor: req.dbUser!,
      actorEmail: req.user!.email || req.dbUser!.email,
      actorUid: req.user!.uid,
    });
    res.json({ ok: true });
  })
);

// Deletion Requests & Approval Workflow
app.post(
  '/api/deletion-requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await createDeletionRequestInDb({
      recordType: req.body?.recordType,
      targetId: String(req.body?.targetId ?? ''),
      targetCode: String(req.body?.targetCode ?? ''),
      targetName: String(req.body?.targetName ?? ''),
      targetDetails: String(req.body?.targetDetails ?? ''),
      quantity: Number(req.body?.quantity ?? 0),
      reason: String(req.body?.reason ?? ''),
      actor: req.dbUser!,
      actorEmail: req.user!.email || req.dbUser!.email,
      actorUid: req.user!.uid,
    });
    res.status(201).json(result);
  })
);

app.post(
  '/api/deletion-requests/:id/approve',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await approveDeletionRequestInDb({
      requestId: id,
      admin: req.dbUser!,
      adminEmail: req.user!.email || req.dbUser!.email,
      adminUid: req.user!.uid,
    });
    res.json({ ok: true, ...result });
  })
);

app.post(
  '/api/deletion-requests/:id/reject',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await rejectDeletionRequestInDb({
      requestId: id,
      admin: req.dbUser!,
      adminEmail: req.user!.email || req.dbUser!.email,
    });
    res.json({ ok: true, ...result });
  })
);

// Admin Force Full Supabase Sync
app.post(
  '/api/admin/supabase-sync',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
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
    res.json({ ok: true });
  })
);

// Admin Reset Database
app.post(
  '/api/admin/reset',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await resetAllDataInDb(
      req.user!.uid,
      req.user!.email || req.dbUser!.email,
      req.dbUser!.name
    );
    res.json({ ok: true });
  })
);

// API error handler (Two-layer: sanitized client JSON, full server log)
app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DomainError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('Unhandled API error:', err);
  const message =
    err instanceof Error && err.message
      ? err.message
      : 'Erro interno ao processar operação no servidor.';
  res.status(500).json({ error: message });
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
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`QHS Engenharia server listening on http://0.0.0.0:${PORT}`);
    void ensureInitialSupabaseSync();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
