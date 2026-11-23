import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  createRequireAuth,
  requireAdmin,
  requireDirectDelete,
} from '../middleware/auth.ts';
import type { AuthRequest, ResolveAuthenticatedUserFn } from '../middleware/auth.ts';
import { DomainError, isSqlDatabaseConfigured } from '../db/shared.ts';
import type {
  AccessRequest,
  Collaborator,
  DeletionRecordType,
  ManagedLists,
  Product,
  SystemSettings,
  User,
  UserPermissions,
} from '../types/index.ts';

export interface AppRepository {
  checkEmailInvitationStatus: (email: string) => Promise<{
    authorized: boolean;
    alreadyActivated: boolean;
    message?: string;
  }>;
  resolveAuthenticatedUser: ResolveAuthenticatedUserFn;
  getBootstrapData: (currentUser: User, uid: string, forceSync?: boolean) => Promise<unknown>;
  updateSystemSettingsInDb: (newSettings: Partial<SystemSettings>) => Promise<void>;
  updateManagedListsInDb: (params: {
    lists: ManagedLists;
    renameGroup?: { oldName: string; newName: string };
    renameRole?: { oldName: string; newName: string };
  }) => Promise<void>;
  updateDestinationsInDb: (destinations: string[]) => Promise<void>;
  createUserInDb: (newUser: Omit<User, 'id' | 'createdAt'>) => Promise<User>;
  updateUserInDb: (updatedUser: User) => Promise<User>;
  updateUserPermissionsInDb: (userId: string, permissions: UserPermissions) => Promise<void>;
  updateUserDeletePermissionInDb: (userId: string, canDelete: boolean) => Promise<void>;
  deleteUserInDb: (userId: string) => Promise<void>;
  createAccessRequestInDb: (params: {
    name: string;
    email: string;
    role?: string;
    department?: string;
    reason?: string;
  }) => Promise<{
    request?: AccessRequest;
    alreadyAuthorized?: boolean;
    message: string;
  }>;
  approveAccessRequestInDb: (params: {
    requestId: string;
    admin: User;
    role?: string;
    department?: string;
    canDelete?: boolean;
    permissions?: Partial<UserPermissions>;
  }) => Promise<{ user: User; request: AccessRequest }>;
  rejectAccessRequestInDb: (params: {
    requestId: string;
    admin: User;
  }) => Promise<AccessRequest>;
  createCollaboratorInDb: (params: {
    ownerUid: string;
    fullName: string;
    role?: string;
    active?: boolean;
  }) => Promise<Collaborator>;
  updateCollaboratorInDb: (params: {
    id: string;
    fullName: string;
    role?: string;
    active: boolean;
  }) => Promise<Collaborator>;
  toggleCollaboratorActiveInDb: (collaboratorId: string) => Promise<Collaborator>;
  deleteCollaboratorInDb: (params: {
    collaboratorId: string;
    actor: User;
    actorEmail: string;
    actorUid: string;
  }) => Promise<string>;
  createProductInDb: (
    ownerUid: string,
    prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<Product>;
  updateProductInDb: (updatedProduct: Product) => Promise<Product>;
  deleteProductInDb: (params: {
    productId: string;
    actor: User;
    actorEmail: string;
    actorUid: string;
  }) => Promise<string>;
  recordMovementInDb: (params: {
    id?: string;
    productId: string;
    type: 'ENTRADA' | 'SAIDA';
    quantity: number;
    date?: string;
    withdrawnBy?: string;
    collaboratorId?: string;
    destination?: string;
    notes?: string;
    isNegativeStockAuthorized?: boolean;
    authorizedBy?: string;
    actor: User;
    actorUid: string;
  }) => Promise<{ stockAfter: number; movId: string }>;
  deleteMovementInDb: (params: {
    movementId: string;
    actor: User;
    actorEmail: string;
    actorUid: string;
  }) => Promise<{ productUpdated: boolean; newStock?: number }>;
  createNegativeRequestInDb: (params: {
    id?: string;
    productId: string;
    requestedQuantity: number;
    withdrawnBy: string;
    collaboratorId?: string;
    destination: string;
    reason: string;
    actor: User;
    actorUid: string;
  }) => Promise<{ reqId: string }>;
  approveNegativeRequestInDb: (params: {
    requestId: string;
    admin: User;
    adminUid: string;
  }) => Promise<{ newStock: number; productName: string }>;
  rejectNegativeRequestInDb: (requestId: string, adminName: string) => Promise<void>;
  deleteNegativeRequestInDb: (params: {
    requestId: string;
    actor: User;
    actorEmail: string;
    actorUid: string;
  }) => Promise<void>;
  createDeletionRequestInDb: (params: {
    recordType: DeletionRecordType;
    targetId: string;
    targetCode: string;
    targetName: string;
    targetDetails: string;
    quantity: number;
    reason: string;
    actor: User;
    actorEmail: string;
    actorUid: string;
  }) => Promise<{ reqId: string }>;
  approveDeletionRequestInDb: (params: {
    requestId: string;
    admin: User;
    adminEmail: string;
    adminUid: string;
  }) => Promise<{ targetName: string; stockNote: string }>;
  rejectDeletionRequestInDb: (params: {
    requestId: string;
    admin: User;
    adminEmail: string;
  }) => Promise<{ targetName: string }>;
  resetAllDataInDb: (adminUid: string, adminEmail: string, adminName: string) => Promise<void>;
  forceSupabaseSync?: () => Promise<void>;
}

const asyncHandler =
  (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
  };

export function createApiApp(repo: AppRepository): Express {
  const app = express();
  const requireAuth = createRequireAuth(repo.resolveAuthenticatedUser);

  app.use(express.json({ limit: '5mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    const hasSupabaseUrl = Boolean(
      process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL
    );
    const hasSupabaseKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    );
    res.json({
      ok: true,
      mode: isSqlDatabaseConfigured() ? 'cloudsql' : 'supabase',
      supabaseConfigured: hasSupabaseUrl && hasSupabaseKey,
    });
  });

  // Pre-registration check for first access by email
  app.post(
    '/api/auth/verify-invite',
    asyncHandler(async (req, res) => {
      const email = String(req.body?.email ?? '').trim();
      const status = await repo.checkEmailInvitationStatus(email);
      if (!status.authorized) {
        res.status(403).json({ error: status.message || 'E-mail não autorizado.' });
        return;
      }
      res.json(status);
    })
  );

  // Public access request ("Solicitar Acesso / Pedido para entrar no aplicativo")
  app.post(
    '/api/auth/request-access',
    asyncHandler(async (req, res) => {
      const result = await repo.createAccessRequestInDb({
        name: String(req.body?.name ?? ''),
        email: String(req.body?.email ?? ''),
        role: req.body?.role ? String(req.body.role) : '',
        department: req.body?.department ? String(req.body.department) : '',
        reason: req.body?.reason ? String(req.body.reason) : '',
      });
      res.status(result.alreadyAuthorized ? 200 : 201).json(result);
    })
  );

  // Bootstrap all state for authenticated & authorized user
  app.get(
    '/api/bootstrap',
    requireAuth,
    asyncHandler(async (req, res) => {
      const forceSync = req.query.force === '1';
      const data = await repo.getBootstrapData(req.dbUser!, req.user!.uid, forceSync);
      res.json(data);
    })
  );

  // Settings: Toggle product photos (any authenticated user)
  app.patch(
    '/api/settings/photos',
    requireAuth,
    asyncHandler(async (req, res) => {
      const showProductPhotos = Boolean(req.body?.showProductPhotos);
      await repo.updateSystemSettingsInDb({ showProductPhotos });
      res.json({ ok: true, showProductPhotos });
    })
  );

  // Settings: Update full settings (Admin only)
  app.put(
    '/api/settings',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      await repo.updateSystemSettingsInDb(req.body ?? {});
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
      if (
        !lists ||
        !Array.isArray(lists.groups) ||
        !Array.isArray(lists.roles) ||
        !Array.isArray(lists.destinations)
      ) {
        throw new DomainError('Dados de listas inválidos.', 400);
      }
      await repo.updateManagedListsInDb({ lists, renameGroup, renameRole });
      res.json({ ok: true });
    })
  );

  // Destinations / Clientes e Locais de Destino (any authenticated user with destinos permission)
  app.put(
    '/api/destinations',
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!req.dbUser!.isAdmin && req.dbUser!.permissions?.destinos === false) {
        throw new DomainError('Você não possui permissão para alterar clientes e locais de destino.', 403);
      }
      const { destinations } = req.body ?? {};
      if (!Array.isArray(destinations)) {
        throw new DomainError('Lista de clientes e locais de destino inválida.', 400);
      }
      await repo.updateDestinationsInDb(destinations.map((d) => String(d ?? '')));
      res.json({ ok: true });
    })
  );

  // Users / App Access (Admin only)
  app.post(
    '/api/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const created = await repo.createUserInDb(req.body ?? {});
      res.status(201).json(created);
    })
  );

  app.put(
    '/api/users/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.updateUserInDb({ ...(req.body ?? {}), id });
      res.json(updated);
    })
  );

  app.patch(
    '/api/users/:id/permissions',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.updateUserPermissionsInDb(id, req.body?.permissions ?? {});
      res.json({ ok: true });
    })
  );

  app.patch(
    '/api/users/:id/delete-permission',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.updateUserDeletePermissionInDb(id, Boolean(req.body?.canDelete));
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/users/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.deleteUserInDb(id);
      res.json({ ok: true });
    })
  );

  // App Access Requests (Approve / Reject by Admin)
  app.post(
    '/api/access-requests/:id/approve',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const result = await repo.approveAccessRequestInDb({
        requestId: id,
        admin: req.dbUser!,
        role: req.body?.role ? String(req.body.role) : undefined,
        department: req.body?.department ? String(req.body.department) : undefined,
        canDelete: req.body?.canDelete !== undefined ? Boolean(req.body.canDelete) : undefined,
        permissions: req.body?.permissions,
      });
      res.json({ ok: true, ...result });
    })
  );

  app.post(
    '/api/access-requests/:id/reject',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.rejectAccessRequestInDb({
        requestId: id,
        admin: req.dbUser!,
      });
      res.json({ ok: true, request: updated });
    })
  );

  // Collaborators (Field workers without app access)
  app.post(
    '/api/collaborators',
    requireAuth,
    asyncHandler(async (req, res) => {
      const created = await repo.createCollaboratorInDb({
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
      const updated = await repo.updateCollaboratorInDb({
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
      const updated = await repo.toggleCollaboratorActiveInDb(id);
      res.json(updated);
    })
  );

  app.delete(
    '/api/collaborators/:id',
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const deletedName = await repo.deleteCollaboratorInDb({
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
      const created = await repo.createProductInDb(req.user!.uid, req.body ?? {});
      res.status(201).json(created);
    })
  );

  app.put(
    '/api/products/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const updated = await repo.updateProductInDb({ ...(req.body ?? {}), id });
      res.json(updated);
    })
  );

  app.delete(
    '/api/products/:id',
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      const deletedName = await repo.deleteProductInDb({
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
      const result = await repo.recordMovementInDb({
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
      const result = await repo.deleteMovementInDb({
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
      const result = await repo.createNegativeRequestInDb({
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
      const result = await repo.approveNegativeRequestInDb({
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
      await repo.rejectNegativeRequestInDb(id, req.dbUser!.name);
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/negative-requests/:id',
    requireAuth,
    requireDirectDelete,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      await repo.deleteNegativeRequestInDb({
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
      const result = await repo.createDeletionRequestInDb({
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
      const result = await repo.approveDeletionRequestInDb({
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
      const result = await repo.rejectDeletionRequestInDb({
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
      if (repo.forceSupabaseSync) {
        await repo.forceSupabaseSync();
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
      await repo.resetAllDataInDb(
        req.user!.uid,
        req.user!.email || req.dbUser!.email,
        req.dbUser!.name
      );
      res.json({ ok: true });
    })
  );

  // Unmatched API routes should always return JSON 404
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Rota de API não encontrada.' });
  });

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

  return app;
}
