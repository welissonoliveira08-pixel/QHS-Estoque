import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyFirebaseIdToken } from '../lib/verifyFirebaseJwt.ts';
import type { VerifiedFirebaseToken } from '../lib/verifyFirebaseJwt.ts';
import { DomainError } from '../db/shared.ts';
import type { DeletionRecordType, ManagedLists, User } from '../types/index.ts';
import {
  approveAccessRequestSupabase,
  approveDeletionRequestSupabase,
  approveNegativeRequestSupabase,
  checkEmailInvitationStatusSupabase,
  createAccessRequestSupabase,
  createCollaboratorSupabase,
  createDeletionRequestSupabase,
  createNegativeRequestSupabase,
  createProductSupabase,
  createUserSupabase,
  deleteCollaboratorSupabase,
  deleteMovementSupabase,
  deleteNegativeRequestSupabase,
  deleteProductSupabase,
  deleteUserSupabase,
  getBootstrapDataSupabase,
  recordMovementSupabase,
  rejectAccessRequestSupabase,
  rejectDeletionRequestSupabase,
  rejectNegativeRequestSupabase,
  resetAllDataSupabase,
  resolveAuthenticatedUserSupabase,
  toggleCollaboratorActiveSupabase,
  updateCollaboratorSupabase,
  updateManagedListsSupabase,
  updateProductSupabase,
  updateSystemSettingsSupabase,
  updateUserDeletePermissionSupabase,
  updateUserPermissionsSupabase,
  updateUserSupabase,
} from '../db/supabaseRepository.ts';

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const existingBody = (req as unknown as { body?: unknown }).body;
  if (existingBody && typeof existingBody === 'object' && !Buffer.isBuffer(existingBody)) {
    return existingBody as Record<string, unknown>;
  }
  if (typeof existingBody === 'string') {
    return existingBody.trim() ? (JSON.parse(existingBody) as Record<string, unknown>) : {};
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const maxBytes = 5 * 1024 * 1024;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new DomainError('Tamanho máximo da requisição excedido (5 MB).', 413);
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function resolveApiPath(rawUrl: string): string {
  const parsed = new URL(rawUrl || '/', 'http://localhost');
  if (parsed.pathname === '/api/index' && parsed.searchParams.has('__path')) {
    const p = parsed.searchParams.get('__path') || '';
    return `/api/${p.replace(/^\/+/, '')}`;
  }
  return parsed.pathname;
}

interface AuthSession {
  token: VerifiedFirebaseToken;
  dbUser: User;
  isRealAdmin: boolean;
}

async function authenticateRequest(req: IncomingMessage): Promise<AuthSession> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new DomainError('Não autenticado: token ausente.', 401);
  }

  const tokenStr = authHeader.slice('Bearer '.length).trim();
  if (!tokenStr) {
    throw new DomainError('Não autenticado: token inválido.', 401);
  }

  let decoded: VerifiedFirebaseToken;
  try {
    decoded = await verifyFirebaseIdToken(tokenStr);
  } catch (err) {
    console.error('Firebase token verification error:', err);
    throw new DomainError('Sessão inválida ou expirada. Faça login novamente.', 401);
  }

  if (!decoded.email || decoded.email_verified !== true) {
    throw new DomainError(
      'Acesso negado: confirme o link de verificação enviado para o seu e-mail antes de acessar o sistema.',
      403
    );
  }

  const authResult = await resolveAuthenticatedUserSupabase({
    uid: decoded.uid,
    email: decoded.email,
    displayName: decoded.name,
  });

  if (!authResult.authorized || !authResult.user) {
    throw new DomainError(authResult.errorMessage || 'Acesso não autorizado.', 403);
  }

  return {
    token: decoded,
    dbUser: authResult.user,
    isRealAdmin: authResult.isRealAdmin,
  };
}

function assertAdmin(session: AuthSession): void {
  if (!session.isRealAdmin || !session.dbUser.isAdmin) {
    throw new DomainError('Acesso restrito ao Administrador principal.', 403);
  }
}

function assertDirectDelete(session: AuthSession): void {
  if (!session.dbUser.isAdmin && !session.dbUser.canDelete) {
    throw new DomainError(
      'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
      403
    );
  }
}

function matchPath(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.replace(/\/+$/, '').split('/');
  const patternParts = pattern.replace(/\/+$/, '').split('/');
  if (pathParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const pat = patternParts[i];
    const actual = pathParts[i];
    if (pat.startsWith(':')) {
      params[pat.slice(1)] = decodeURIComponent(actual);
    } else if (pat !== actual) {
      return null;
    }
  }
  return params;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const method = (req.method || 'GET').toUpperCase();
    const pathname = resolveApiPath(req.url || '/');

    if (method === 'GET' && pathname === '/api/health') {
      const hasSupabaseUrl = Boolean(
        process.env.SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL
      );
      const hasSupabaseKey = Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
      );
      sendJson(res, 200, {
        ok: true,
        mode: 'supabase',
        supabaseConfigured: hasSupabaseUrl && hasSupabaseKey,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/verify-invite') {
      const body = await readJsonBody(req);
      const email = String(body.email ?? '').trim();
      const status = await checkEmailInvitationStatusSupabase(email);
      if (!status.authorized) {
        sendJson(res, 403, { error: status.message || 'E-mail não autorizado.' });
        return;
      }
      sendJson(res, 200, status);
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/request-access') {
      const body = await readJsonBody(req);
      const result = await createAccessRequestSupabase({
        name: String(body.name ?? ''),
        email: String(body.email ?? ''),
        role: body.role ? String(body.role) : '',
        department: body.department ? String(body.department) : '',
        reason: body.reason ? String(body.reason) : '',
      });
      sendJson(res, result.alreadyAuthorized ? 200 : 201, result);
      return;
    }

    // All remaining routes require authentication
    const session = await authenticateRequest(req);

    if (method === 'GET' && pathname === '/api/bootstrap') {
      const data = await getBootstrapDataSupabase(session.dbUser, session.token.uid);
      sendJson(res, 200, data);
      return;
    }

    if (method === 'PATCH' && pathname === '/api/settings/photos') {
      const body = await readJsonBody(req);
      const showProductPhotos = Boolean(body.showProductPhotos);
      await updateSystemSettingsSupabase({ showProductPhotos });
      sendJson(res, 200, { ok: true, showProductPhotos });
      return;
    }

    if (method === 'PUT' && pathname === '/api/settings') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateSystemSettingsSupabase(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'PUT' && pathname === '/api/lists') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const lists = body.lists as ManagedLists | undefined;
      if (
        !lists ||
        !Array.isArray(lists.groups) ||
        !Array.isArray(lists.roles) ||
        !Array.isArray(lists.destinations)
      ) {
        throw new DomainError('Dados de listas inválidos.', 400);
      }
      await updateManagedListsSupabase({
        lists,
        renameGroup: body.renameGroup as { oldName: string; newName: string } | undefined,
        renameRole: body.renameRole as { oldName: string; newName: string } | undefined,
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/users') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const created = await createUserSupabase(body as unknown as Omit<User, 'id' | 'createdAt'>);
      sendJson(res, 201, created);
      return;
    }

    let params = matchPath(pathname, '/api/users/:id');
    if (params && method === 'PUT') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const updated = await updateUserSupabase({ ...(body as unknown as User), id: params.id });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === 'DELETE') {
      assertAdmin(session);
      await deleteUserSupabase(params.id);
      sendJson(res, 200, { ok: true });
      return;
    }

    params = matchPath(pathname, '/api/users/:id/permissions');
    if (params && method === 'PATCH') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateUserPermissionsSupabase(
        params.id,
        (body.permissions ?? {}) as User['permissions']
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    params = matchPath(pathname, '/api/users/:id/delete-permission');
    if (params && method === 'PATCH') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      await updateUserDeletePermissionSupabase(params.id, Boolean(body.canDelete));
      sendJson(res, 200, { ok: true });
      return;
    }

    params = matchPath(pathname, '/api/access-requests/:id/approve');
    if (params && method === 'POST') {
      assertAdmin(session);
      const body = await readJsonBody(req);
      const result = await approveAccessRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        role: body.role ? String(body.role) : undefined,
        department: body.department ? String(body.department) : undefined,
        canDelete: body.canDelete !== undefined ? Boolean(body.canDelete) : undefined,
        permissions: body.permissions as Partial<User['permissions']> | undefined,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    params = matchPath(pathname, '/api/access-requests/:id/reject');
    if (params && method === 'POST') {
      assertAdmin(session);
      const updated = await rejectAccessRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
      });
      sendJson(res, 200, { ok: true, request: updated });
      return;
    }

    if (method === 'POST' && pathname === '/api/collaborators') {
      const body = await readJsonBody(req);
      const created = await createCollaboratorSupabase({
        ownerUid: session.token.uid,
        fullName: String(body.fullName ?? ''),
        role: body.role ? String(body.role) : '',
        active: body.active !== undefined ? Boolean(body.active) : true,
      });
      sendJson(res, 201, created);
      return;
    }

    params = matchPath(pathname, '/api/collaborators/:id');
    if (params && method === 'PUT') {
      const body = await readJsonBody(req);
      const updated = await updateCollaboratorSupabase({
        id: params.id,
        fullName: String(body.fullName ?? ''),
        role: body.role ? String(body.role) : '',
        active: Boolean(body.active),
      });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === 'DELETE') {
      assertDirectDelete(session);
      const deletedName = await deleteCollaboratorSupabase({
        collaboratorId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true, deletedName });
      return;
    }

    params = matchPath(pathname, '/api/collaborators/:id/toggle');
    if (params && method === 'PATCH') {
      const updated = await toggleCollaboratorActiveSupabase(params.id);
      sendJson(res, 200, updated);
      return;
    }

    if (method === 'POST' && pathname === '/api/products') {
      const body = await readJsonBody(req);
      const created = await createProductSupabase(
        session.token.uid,
        body as unknown as Parameters<typeof createProductSupabase>[1]
      );
      sendJson(res, 201, created);
      return;
    }

    params = matchPath(pathname, '/api/products/:id');
    if (params && method === 'PUT') {
      const body = await readJsonBody(req);
      const updated = await updateProductSupabase({
        ...(body as unknown as Parameters<typeof updateProductSupabase>[0]),
        id: params.id,
      });
      sendJson(res, 200, updated);
      return;
    }
    if (params && method === 'DELETE') {
      assertDirectDelete(session);
      const deletedName = await deleteProductSupabase({
        productId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true, deletedName });
      return;
    }

    if (method === 'POST' && pathname === '/api/movements') {
      const body = await readJsonBody(req);
      const result = await recordMovementSupabase({
        id: body.id ? String(body.id) : undefined,
        productId: String(body.productId ?? ''),
        type: body.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
        quantity: Number(body.quantity ?? 0),
        date: body.date ? String(body.date) : undefined,
        withdrawnBy: body.withdrawnBy ? String(body.withdrawnBy) : undefined,
        collaboratorId: body.collaboratorId ? String(body.collaboratorId) : undefined,
        destination: body.destination ? String(body.destination) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
        isNegativeStockAuthorized:
          body.isNegativeStockAuthorized !== undefined
            ? Boolean(body.isNegativeStockAuthorized)
            : undefined,
        authorizedBy: body.authorizedBy ? String(body.authorizedBy) : undefined,
        actor: session.dbUser,
        actorUid: session.token.uid,
      });
      sendJson(res, 201, result);
      return;
    }

    params = matchPath(pathname, '/api/movements/:id');
    if (params && method === 'DELETE') {
      assertDirectDelete(session);
      const result = await deleteMovementSupabase({
        movementId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === 'POST' && pathname === '/api/negative-requests') {
      const body = await readJsonBody(req);
      const result = await createNegativeRequestSupabase({
        id: body.id ? String(body.id) : undefined,
        productId: String(body.productId ?? ''),
        requestedQuantity: Number(body.requestedQuantity ?? 0),
        withdrawnBy: String(body.withdrawnBy ?? ''),
        collaboratorId: body.collaboratorId ? String(body.collaboratorId) : undefined,
        destination: String(body.destination ?? ''),
        reason: String(body.reason ?? ''),
        actor: session.dbUser,
        actorUid: session.token.uid,
      });
      sendJson(res, 201, result);
      return;
    }

    params = matchPath(pathname, '/api/negative-requests/:id/approve');
    if (params && method === 'POST') {
      assertAdmin(session);
      const result = await approveNegativeRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    params = matchPath(pathname, '/api/negative-requests/:id/reject');
    if (params && method === 'POST') {
      assertAdmin(session);
      await rejectNegativeRequestSupabase(params.id, session.dbUser.name);
      sendJson(res, 200, { ok: true });
      return;
    }

    params = matchPath(pathname, '/api/negative-requests/:id');
    if (params && method === 'DELETE') {
      assertDirectDelete(session);
      await deleteNegativeRequestSupabase({
        requestId: params.id,
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/deletion-requests') {
      const body = await readJsonBody(req);
      const result = await createDeletionRequestSupabase({
        recordType: body.recordType as DeletionRecordType,
        targetId: String(body.targetId ?? ''),
        targetCode: String(body.targetCode ?? ''),
        targetName: String(body.targetName ?? ''),
        targetDetails: String(body.targetDetails ?? ''),
        quantity: Number(body.quantity ?? 0),
        reason: String(body.reason ?? ''),
        actor: session.dbUser,
        actorEmail: session.token.email || session.dbUser.email,
        actorUid: session.token.uid,
      });
      sendJson(res, 201, result);
      return;
    }

    params = matchPath(pathname, '/api/deletion-requests/:id/approve');
    if (params && method === 'POST') {
      assertAdmin(session);
      const result = await approveDeletionRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminEmail: session.token.email || session.dbUser.email,
        adminUid: session.token.uid,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    params = matchPath(pathname, '/api/deletion-requests/:id/reject');
    if (params && method === 'POST') {
      assertAdmin(session);
      const result = await rejectDeletionRequestSupabase({
        requestId: params.id,
        admin: session.dbUser,
        adminEmail: session.token.email || session.dbUser.email,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === 'POST' && pathname === '/api/admin/supabase-sync') {
      assertAdmin(session);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'POST' && pathname === '/api/admin/reset') {
      assertAdmin(session);
      await resetAllDataSupabase(
        session.token.uid,
        session.token.email || session.dbUser.email,
        session.dbUser.name
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Rota de API não encontrada.' });
  } catch (err) {
    if (err instanceof DomainError) {
      sendJson(res, err.statusCode, { error: err.message });
      return;
    }
    console.error('Vercel API unhandled error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Erro interno ao processar operação no servidor.',
    });
  }
}
