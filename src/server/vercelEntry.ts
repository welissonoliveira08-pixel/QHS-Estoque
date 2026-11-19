import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from './app.ts';
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

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp({
      checkEmailInvitationStatus: checkEmailInvitationStatusSupabase,
      resolveAuthenticatedUser: resolveAuthenticatedUserSupabase,
      getBootstrapData: getBootstrapDataSupabase,
      updateSystemSettingsInDb: updateSystemSettingsSupabase,
      updateManagedListsInDb: updateManagedListsSupabase,
      createUserInDb: createUserSupabase,
      updateUserInDb: updateUserSupabase,
      updateUserPermissionsInDb: updateUserPermissionsSupabase,
      updateUserDeletePermissionInDb: updateUserDeletePermissionSupabase,
      deleteUserInDb: deleteUserSupabase,
      createAccessRequestInDb: createAccessRequestSupabase,
      approveAccessRequestInDb: approveAccessRequestSupabase,
      rejectAccessRequestInDb: rejectAccessRequestSupabase,
      createCollaboratorInDb: createCollaboratorSupabase,
      updateCollaboratorInDb: updateCollaboratorSupabase,
      toggleCollaboratorActiveInDb: toggleCollaboratorActiveSupabase,
      deleteCollaboratorInDb: deleteCollaboratorSupabase,
      createProductInDb: createProductSupabase,
      updateProductInDb: updateProductSupabase,
      deleteProductInDb: deleteProductSupabase,
      recordMovementInDb: recordMovementSupabase,
      deleteMovementInDb: deleteMovementSupabase,
      createNegativeRequestInDb: createNegativeRequestSupabase,
      approveNegativeRequestInDb: approveNegativeRequestSupabase,
      rejectNegativeRequestInDb: rejectNegativeRequestSupabase,
      deleteNegativeRequestInDb: deleteNegativeRequestSupabase,
      createDeletionRequestInDb: createDeletionRequestSupabase,
      approveDeletionRequestInDb: approveDeletionRequestSupabase,
      rejectDeletionRequestInDb: rejectDeletionRequestSupabase,
      resetAllDataInDb: resetAllDataSupabase,
    });
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const rawUrl = req.url || '/';
    if (rawUrl.startsWith('/api/index')) {
      const parsed = new URL(rawUrl, 'http://localhost');
      const pathParam = parsed.searchParams.get('__path') || '';
      parsed.searchParams.delete('__path');
      const remainingQuery = parsed.searchParams.toString();
      req.url = `/api/${pathParam.replace(/^\/+/, '')}${remainingQuery ? `?${remainingQuery}` : ''}`;
    }
    const app = getApp();
    return app(
      req as unknown as Parameters<typeof app>[0],
      res as unknown as Parameters<typeof app>[1]
    );
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : 'Erro interno ao inicializar servidor da API.',
      })
    );
  }
}
