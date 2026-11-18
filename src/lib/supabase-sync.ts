import { db } from '../db/index.ts';
import {
  collaborators,
  deletionLogs,
  deletionRequests,
  managedLists,
  movements,
  negativeRequests,
  products,
  systemSettings,
  users,
} from '../db/schema.ts';

type UserRow = typeof users.$inferSelect;
type CollaboratorRow = typeof collaborators.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type MovementRow = typeof movements.$inferSelect;
type NegativeRequestRow = typeof negativeRequests.$inferSelect;
type DeletionRequestRow = typeof deletionRequests.$inferSelect;
type DeletionLogRow = typeof deletionLogs.$inferSelect;
type ManagedListsRow = typeof managedLists.$inferSelect;
type SystemSettingsRow = typeof systemSettings.$inferSelect;

interface SupabaseConfig {
  url: string;
  key: string;
  keyRole: 'service_role' | 'secret' | 'anon' | 'publishable' | 'unknown';
}

let initialSyncSignature: string | null = null;
let initialSyncPromise: Promise<boolean> | null = null;
let lastWarnedSignature: string | null = null;
let blockedSignature: string | null = null;
let lastBlockReason: string | null = null;

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function detectKeyRole(key: string): SupabaseConfig['keyRole'] {
  if (key.startsWith('sb_secret_')) return 'secret';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('eyJ')) {
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
          role?: unknown;
        };
        if (decoded?.role === 'service_role') return 'service_role';
        if (decoded?.role === 'anon') return 'anon';
      } catch {
        // Ignore malformed JWT inspection; PostgREST will validate.
      }
    }
  }
  return 'unknown';
}

function normalizeSupabaseUrl(raw: string): string {
  const cleaned = stripWrappingQuotes(raw).replace(/\/+$/, '');
  if (!cleaned.startsWith('http')) return '';
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

function getSupabaseConfig(): SupabaseConfig | null {
  const rawUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  let rawKey = stripWrappingQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (/^Bearer\s+/i.test(rawKey)) {
    rawKey = rawKey.replace(/^Bearer\s+/i, '').trim();
  }
  if (!rawUrl || !rawKey || !rawUrl.startsWith('http')) {
    return null;
  }
  return { url: rawUrl, key: rawKey, keyRole: detectKeyRole(rawKey) };
}

function getConfigSignature(config: SupabaseConfig): string {
  return `${config.url}|${config.keyRole}|${config.key.slice(0, 12)}|${config.key.length}`;
}

function warnOnce(config: SupabaseConfig, message: string): void {
  const sig = getConfigSignature(config);
  lastBlockReason = message;
  if (lastWarnedSignature !== sig) {
    lastWarnedSignature = sig;
    console.warn(`[Supabase Sync] ${message}`);
  }
}

function ensureWritableConfig(): SupabaseConfig | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  const sig = getConfigSignature(config);
  if (blockedSignature === sig) {
    return null;
  }

  if (config.keyRole === 'anon' || config.keyRole === 'publishable') {
    blockedSignature = sig;
    warnOnce(
      config,
      'A variável SUPABASE_SERVICE_ROLE_KEY está configurada com a chave pública (anon/publishable), que é bloqueada pelo RLS do Supabase (erro 42501). Atualize o Secret SUPABASE_SERVICE_ROLE_KEY no AI Studio usando a chave secreta "service_role" ou "sb_secret_..." (Supabase -> Project Settings -> API Keys).'
    );
    return null;
  }

  return config;
}

export function isSupabaseSyncEnabled(): boolean {
  return getSupabaseConfig() !== null;
}

export function getSupabaseSyncBlockReason(): string | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  if (config.keyRole === 'anon' || config.keyRole === 'publishable') {
    return 'A variável SUPABASE_SERVICE_ROLE_KEY está configurada com a chave pública (anon/publishable), que é bloqueada pelo RLS do Supabase (erro 42501). Substitua nos Secrets do AI Studio pela chave "service_role" ou "sb_secret_..." (Project Settings -> API Keys).';
  }
  if (blockedSignature === getConfigSignature(config) && lastBlockReason) {
    return lastBlockReason;
  }
  return null;
}

function buildHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (!key.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toSupabaseUser(row: UserRow) {
  return {
    id: row.id,
    uid: row.uid ?? null,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    is_admin: Boolean(row.isAdmin),
    can_delete: Boolean(row.canDelete),
    active: Boolean(row.active),
    permissions: row.permissions,
    registration_date: row.registrationDate,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseCollaborator(row: CollaboratorRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    full_name: row.fullName,
    role: row.role,
    active: Boolean(row.active),
    registration_date: row.registrationDate,
    display_updated_at: row.displayUpdatedAt,
    owner_uid: row.ownerUid,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseProduct(row: ProductRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    code: row.code,
    name: row.name,
    group_name: row.groupName,
    current_stock: Number(row.currentStock),
    min_stock: Number(row.minStock),
    photo_url: row.photoUrl,
    description: row.description,
    registration_date: row.registrationDate,
    display_updated_at: row.displayUpdatedAt,
    owner_uid: row.ownerUid,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseMovement(row: MovementRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    product_id: row.productId,
    product_code: row.productCode,
    product_name: row.productName,
    group_name: row.groupName,
    type: row.type,
    quantity: Number(row.quantity),
    stock_after_movement: Number(row.stockAfterMovement),
    date: row.date,
    withdrawn_by: row.withdrawnBy ?? null,
    collaborator_id: row.collaboratorId ?? null,
    responsible_user: row.responsibleUser,
    destination: row.destination ?? null,
    notes: row.notes ?? null,
    is_negative_stock_authorized:
      row.isNegativeStockAuthorized === null || row.isNegativeStockAuthorized === undefined
        ? null
        : Boolean(row.isNegativeStockAuthorized),
    authorized_by: row.authorizedBy ?? null,
    owner_uid: row.ownerUid,
    created_at: toIso(row.createdAt),
  };
}

function toSupabaseNegativeRequest(row: NegativeRequestRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    product_id: row.productId,
    product_code: row.productCode,
    product_name: row.productName,
    group_name: row.groupName,
    requested_quantity: Number(row.requestedQuantity),
    available_stock: Number(row.availableStock),
    deficit_quantity: Number(row.deficitQuantity),
    withdrawn_by: row.withdrawnBy,
    collaborator_id: row.collaboratorId ?? null,
    destination: row.destination,
    requested_by: row.requestedBy,
    requested_by_uid: row.requestedByUid,
    reason: row.reason,
    date: row.date,
    status: row.status,
    reviewed_by: row.reviewedBy ?? null,
    reviewed_at: row.reviewedAt ?? null,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseDeletionRequest(row: DeletionRequestRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    record_type: row.recordType,
    target_id: row.targetId,
    target_code: row.targetCode,
    target_name: row.targetName,
    target_details: row.targetDetails,
    quantity: Number(row.quantity),
    reason: row.reason,
    requested_by: row.requestedBy,
    requested_by_email: row.requestedByEmail,
    requested_by_uid: row.requestedByUid,
    date: row.date,
    status: row.status,
    reviewed_by: row.reviewedBy ?? null,
    reviewed_by_email: row.reviewedByEmail ?? null,
    reviewed_at: row.reviewedAt ?? null,
    executed_by: row.executedBy ?? null,
    executed_at: row.executedAt ?? null,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseDeletionLog(row: DeletionLogRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    origin: row.origin,
    request_id: row.requestId ?? null,
    record_type: row.recordType,
    target_id: row.targetId,
    target_code: row.targetCode,
    target_name: row.targetName,
    target_details: row.targetDetails,
    quantity: Number(row.quantity),
    reason: row.reason,
    requested_by: row.requestedBy,
    requested_by_date: row.requestedByDate,
    approved_by: row.approvedBy ?? null,
    approved_at: row.approvedAt ?? null,
    deleted_by: row.deletedBy,
    deleted_by_email: row.deletedByEmail,
    deleted_by_uid: row.deletedByUid,
    deleted_at: row.deletedAt,
    created_at: toIso(row.createdAt),
  };
}

function toSupabaseManagedLists(row: ManagedListsRow) {
  return {
    id: row.id,
    groups: row.groups,
    roles: row.roles,
    destinations: row.destinations,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function toSupabaseSystemSettings(row: SystemSettingsRow) {
  return {
    id: row.id,
    show_product_photos: Boolean(row.showProductPhotos),
    company_name: row.companyName,
    company_subtitle: row.companySubtitle,
    cnpj: row.cnpj,
    contact_email: row.contactEmail,
    low_stock_alert_notification: Boolean(row.lowStockAlertNotification),
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function handleHttpFailure(
  config: SupabaseConfig,
  operation: 'Upsert' | 'Delete',
  table: string,
  status: number,
  errorText: string
): void {
  if (
    status === 401 ||
    status === 403 ||
    errorText.includes('42501') ||
    errorText.toLowerCase().includes('row-level security')
  ) {
    blockedSignature = getConfigSignature(config);
    warnOnce(
      config,
      `Sincronização bloqueada pelo Supabase (${status} / RLS) na tabela "${table}". Verifique nos Secrets do AI Studio se SUPABASE_SERVICE_ROLE_KEY contém a chave secreta "service_role" ou "sb_secret_..." (nunca a chave pública anon/publishable).`
    );
    return;
  }

  if (status === 404 || errorText.includes('PGRST205') || errorText.includes('42P01')) {
    warnOnce(
      config,
      `Tabela "${table}" ainda não encontrada neste projeto Supabase. Cole e execute o script supabase/supabase_migration_completa.sql no SQL Editor do Supabase.`
    );
    return;
  }

  console.error(`[Supabase Sync] ${operation} failed on "${table}" (${status}): ${errorText}`);
}

function handleNetworkFailure(config: SupabaseConfig, table: string, error: unknown): void {
  const causeCode =
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof (error as { cause?: { code?: unknown } }).cause?.code === 'string'
      ? (error as { cause: { code: string } }).cause.code
      : '';

  if (causeCode === 'ENOTFOUND') {
    blockedSignature = getConfigSignature(config);
    warnOnce(
      config,
      'A URL configurada em SUPABASE_URL não existe mais ou está incorreta (ENOTFOUND). Atualize o Secret SUPABASE_URL nos Secrets do AI Studio com a URL do seu novo projeto Supabase.'
    );
    return;
  }

  console.error(`[Supabase Sync] Network error on "${table}":`, error);
}

async function upsertSupabaseRows<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 100
): Promise<boolean> {
  if (rows.length === 0) return true;
  const config = ensureWritableConfig();
  if (!config) return false;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    try {
      const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=id`, {
        method: 'POST',
        headers: buildHeaders(config.key, {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        handleHttpFailure(config, 'Upsert', table, response.status, errorText);
        return false;
      }
    } catch (error) {
      handleNetworkFailure(config, table, error);
      return false;
    }
  }

  return true;
}

async function deleteSupabaseWhere(table: string, filterQuery: string): Promise<boolean> {
  const config = ensureWritableConfig();
  if (!config) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${filterQuery}`, {
      method: 'DELETE',
      headers: buildHeaders(config.key, {
        Prefer: 'return=minimal',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      handleHttpFailure(config, 'Delete', table, response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    handleNetworkFailure(config, table, error);
    return false;
  }
}

async function deleteSupabaseRow(table: string, id: string): Promise<boolean> {
  return deleteSupabaseWhere(table, `id=eq.${encodeURIComponent(id)}`);
}

export async function syncUserToSupabase(row: UserRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('users', [toSupabaseUser(row)]);
}

export async function syncUsersToSupabase(rows: UserRow[]): Promise<void> {
  if (rows.length === 0) return;
  await upsertSupabaseRows('users', rows.map(toSupabaseUser));
}

export async function deleteUserFromSupabase(id: string): Promise<void> {
  await deleteSupabaseRow('users', id);
}

export async function syncCollaboratorToSupabase(row: CollaboratorRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('collaborators', [toSupabaseCollaborator(row)]);
}

export async function deleteCollaboratorFromSupabase(id: string): Promise<void> {
  await deleteSupabaseRow('collaborators', id);
}

export async function syncProductToSupabase(row: ProductRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('products', [toSupabaseProduct(row)], 10);
}

export async function syncProductsToSupabase(rows: ProductRow[]): Promise<void> {
  if (rows.length === 0) return;
  await upsertSupabaseRows('products', rows.map(toSupabaseProduct), 10);
}

export async function deleteProductFromSupabase(id: string): Promise<void> {
  await deleteSupabaseRow('products', id);
}

export async function syncMovementToSupabase(row: MovementRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('movements', [toSupabaseMovement(row)]);
}

export async function syncMovementsToSupabase(rows: MovementRow[]): Promise<void> {
  if (rows.length === 0) return;
  await upsertSupabaseRows('movements', rows.map(toSupabaseMovement));
}

export async function deleteMovementFromSupabase(id: string): Promise<void> {
  await deleteSupabaseRow('movements', id);
}

export async function syncNegativeRequestToSupabase(
  row: NegativeRequestRow | undefined
): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('negative_requests', [toSupabaseNegativeRequest(row)]);
}

export async function deleteNegativeRequestFromSupabase(id: string): Promise<void> {
  await deleteSupabaseRow('negative_requests', id);
}

export async function syncDeletionRequestToSupabase(
  row: DeletionRequestRow | undefined
): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('deletion_requests', [toSupabaseDeletionRequest(row)]);
}

export async function syncDeletionLogToSupabase(row: DeletionLogRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('deletion_logs', [toSupabaseDeletionLog(row)]);
}

export async function syncManagedListsToSupabase(row: ManagedListsRow | undefined): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('managed_lists', [toSupabaseManagedLists(row)]);
}

export async function syncSystemSettingsToSupabase(
  row: SystemSettingsRow | undefined
): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('system_settings', [toSupabaseSystemSettings(row)]);
}

export async function syncAllTablesToSupabase(): Promise<boolean> {
  const config = ensureWritableConfig();
  if (!config) return false;

  try {
    const [
      settingsRows,
      listsRows,
      userRows,
      collabRows,
      prodRows,
      movRows,
      negRows,
      delReqRows,
      delLogRows,
    ] = await Promise.all([
      db.select().from(systemSettings),
      db.select().from(managedLists),
      db.select().from(users),
      db.select().from(collaborators),
      db.select().from(products),
      db.select().from(movements),
      db.select().from(negativeRequests),
      db.select().from(deletionRequests),
      db.select().from(deletionLogs),
    ]);

    const probeOk = await upsertSupabaseRows(
      'system_settings',
      settingsRows.map(toSupabaseSystemSettings)
    );
    if (!probeOk) {
      return false;
    }

    const parentResults = await Promise.all([
      upsertSupabaseRows('managed_lists', listsRows.map(toSupabaseManagedLists)),
      upsertSupabaseRows('users', userRows.map(toSupabaseUser)),
      upsertSupabaseRows('collaborators', collabRows.map(toSupabaseCollaborator)),
      upsertSupabaseRows('products', prodRows.map(toSupabaseProduct), 10),
    ]);

    if (parentResults.some((ok) => !ok)) {
      return false;
    }

    const childResults = await Promise.all([
      upsertSupabaseRows('movements', movRows.map(toSupabaseMovement)),
      upsertSupabaseRows('negative_requests', negRows.map(toSupabaseNegativeRequest)),
      upsertSupabaseRows('deletion_requests', delReqRows.map(toSupabaseDeletionRequest)),
      upsertSupabaseRows('deletion_logs', delLogRows.map(toSupabaseDeletionLog)),
    ]);

    return childResults.every(Boolean);
  } catch (error) {
    console.error('[Supabase Sync] Failed full sync:', error);
    return false;
  }
}

export async function ensureInitialSupabaseSync(): Promise<boolean> {
  const config = ensureWritableConfig();
  if (!config) return false;
  const sig = getConfigSignature(config);
  if (initialSyncSignature === sig) return true;
  if (initialSyncPromise) return initialSyncPromise;

  initialSyncPromise = syncAllTablesToSupabase()
    .then((ok) => {
      if (ok) {
        initialSyncSignature = sig;
        console.log('[Supabase Sync] Sincronização inicial concluída com sucesso.');
      } else {
        initialSyncPromise = null;
      }
      return ok;
    })
    .catch(() => {
      initialSyncPromise = null;
      return false;
    });

  return initialSyncPromise;
}

export async function syncResetAllToSupabase(params: {
  listsRow?: ManagedListsRow;
  settingsRow?: SystemSettingsRow;
  ownerRow?: UserRow;
}): Promise<void> {
  const config = ensureWritableConfig();
  if (!config) return;

  await deleteSupabaseWhere('movements', 'id=not.is.null');
  await deleteSupabaseWhere('negative_requests', 'id=not.is.null');
  await deleteSupabaseWhere('deletion_requests', 'id=not.is.null');
  await deleteSupabaseWhere('deletion_logs', 'id=not.is.null');
  await deleteSupabaseWhere('collaborators', 'id=not.is.null');
  await deleteSupabaseWhere('products', 'id=not.is.null');
  await deleteSupabaseWhere('users', 'id=neq.user-owner');

  await Promise.all([
    syncManagedListsToSupabase(params.listsRow),
    syncSystemSettingsToSupabase(params.settingsRow),
    syncUserToSupabase(params.ownerRow),
  ]);

  initialSyncSignature = getConfigSignature(config);
}
