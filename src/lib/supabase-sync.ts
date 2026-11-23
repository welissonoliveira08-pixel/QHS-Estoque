import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  accessRequests,
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
import { normalizePermissions } from '../db/shared.ts';
import type { UserPermissions } from '../types/index.ts';

type UserRow = typeof users.$inferSelect;
type CollaboratorRow = typeof collaborators.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type MovementRow = typeof movements.$inferSelect;
type NegativeRequestRow = typeof negativeRequests.$inferSelect;
type DeletionRequestRow = typeof deletionRequests.$inferSelect;
type DeletionLogRow = typeof deletionLogs.$inferSelect;
type ManagedListsRow = typeof managedLists.$inferSelect;
type SystemSettingsRow = typeof systemSettings.$inferSelect;
type AccessRequestRow = typeof accessRequests.$inferSelect;

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
let lastPullAt = 0;
let inFlightPull: Promise<boolean> | null = null;
const PULL_THROTTLE_MS = 8000;

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

function toSupabaseAccessRequest(row: AccessRequestRow) {
  return {
    id: row.id,
    org_id: row.orgId,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    reason: row.reason,
    date: row.date,
    status: row.status,
    reviewed_by: row.reviewedBy ?? null,
    reviewed_at: row.reviewedAt ?? null,
    created_at: toIso(row.createdAt),
    updated_at: toIso(row.updatedAt),
  };
}

function handleHttpFailure(
  config: SupabaseConfig,
  operation: 'Upsert' | 'Delete' | 'Select',
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

export async function syncAccessRequestToSupabase(
  row: AccessRequestRow | undefined
): Promise<void> {
  if (!row) return;
  await upsertSupabaseRows('access_requests', [toSupabaseAccessRequest(row)]);
}

export interface RemotePendingAccessRequest {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  reason: string;
  date: string;
  status: string;
}

export async function pullPendingAccessRequestsFromSupabase(): Promise<RemotePendingAccessRequest[]> {
  const config = ensureWritableConfig();
  if (!config) return [];

  try {
    const response = await fetch(
      `${config.url}/rest/v1/access_requests?status=eq.PENDENTE&select=id,org_id,name,email,role,department,reason,date,status`,
      {
        method: 'GET',
        headers: buildHeaders(config.key),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return [];
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return [];

    return rows
      .filter((r) => typeof r.id === 'string' && typeof r.email === 'string' && typeof r.name === 'string')
      .map((r) => ({
        id: String(r.id),
        orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
        name: String(r.name),
        email: String(r.email).trim().toLowerCase(),
        role: typeof r.role === 'string' ? r.role : '',
        department: typeof r.department === 'string' ? r.department : '',
        reason: typeof r.reason === 'string' ? r.reason : '',
        date: typeof r.date === 'string' ? r.date : '',
        status: typeof r.status === 'string' ? r.status : 'PENDENTE',
      }));
  } catch {
    return [];
  }
}

function parseDateValue(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function toMillis(value: unknown): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

function shouldUpdateSeedAwareRow(
  localCreatedAt: Date,
  localUpdatedAt: Date,
  remoteCreatedAt: unknown,
  remoteUpdatedAt: unknown
): boolean {
  const remoteUpdMs = toMillis(remoteUpdatedAt);
  const localUpdMs = toMillis(localUpdatedAt);
  if (remoteUpdMs > localUpdMs) return true;

  const localIsUntouchedSeed = Math.abs(localUpdMs - toMillis(localCreatedAt)) < 2000;
  const remoteWasEdited = remoteUpdMs > toMillis(remoteCreatedAt) + 2000;
  return localIsUntouchedSeed && remoteWasEdited;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

async function fetchSupabaseTable(
  config: SupabaseConfig,
  table: string,
  ignoreMissing = false
): Promise<{ ok: boolean; rows: Array<Record<string, unknown>> }> {
  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?select=*&limit=10000`, {
      method: 'GET',
      headers: buildHeaders(config.key, { Range: '0-9999' }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const isMissingTable =
        response.status === 404 || errorText.includes('PGRST205') || errorText.includes('42P01');
      if (ignoreMissing && isMissingTable) {
        return { ok: true, rows: [] };
      }
      handleHttpFailure(config, 'Select', table, response.status, errorText);
      return { ok: false, rows: [] };
    }

    const parsed = (await response.json().catch(() => [])) as unknown;
    return {
      ok: true,
      rows: Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [],
    };
  } catch (error) {
    handleNetworkFailure(config, table, error);
    return { ok: false, rows: [] };
  }
}

async function runPullFromSupabaseToCloudSql(config: SupabaseConfig): Promise<boolean> {
  try {
    const [
      delLogsRes,
      settingsRes,
      listsRes,
      usersRes,
      collabsRes,
      prodsRes,
      movsRes,
      negReqsRes,
      delReqsRes,
      accReqsRes,
    ] = await Promise.all([
      fetchSupabaseTable(config, 'deletion_logs'),
      fetchSupabaseTable(config, 'system_settings'),
      fetchSupabaseTable(config, 'managed_lists'),
      fetchSupabaseTable(config, 'users'),
      fetchSupabaseTable(config, 'collaborators'),
      fetchSupabaseTable(config, 'products'),
      fetchSupabaseTable(config, 'movements'),
      fetchSupabaseTable(config, 'negative_requests'),
      fetchSupabaseTable(config, 'deletion_requests'),
      fetchSupabaseTable(config, 'access_requests', true),
    ]);

    if (
      !delLogsRes.ok ||
      !settingsRes.ok ||
      !listsRes.ok ||
      !usersRes.ok ||
      !collabsRes.ok ||
      !prodsRes.ok ||
      !movsRes.ok ||
      !negReqsRes.ok ||
      !delReqsRes.ok
    ) {
      return false;
    }

    await db.transaction(async (tx) => {
      // 1. Deletion logs + deletion propagation
      const existingDelLogs = await tx.select({ id: deletionLogs.id }).from(deletionLogs);
      const existingDelLogIds = new Set(existingDelLogs.map((l) => l.id));

      const deletedProductIds = new Set<string>();
      const deletedCollaboratorIds = new Set<string>();
      const deletedMovementIds = new Set<string>();
      const deletedNegativeRequestIds = new Set<string>();

      for (const r of delLogsRes.rows) {
        if (typeof r.id !== 'string' || typeof r.target_id !== 'string') continue;
        const recordType = String(r.record_type || 'PRODUTO');
        if (recordType === 'PRODUTO') deletedProductIds.add(r.target_id);
        else if (recordType === 'COLABORADOR') deletedCollaboratorIds.add(r.target_id);
        else if (recordType === 'ENTRADA' || recordType === 'SAIDA') {
          deletedMovementIds.add(r.target_id);
        } else if (recordType === 'SOLICITACAO_NEGATIVA') {
          deletedNegativeRequestIds.add(r.target_id);
        }

        if (!existingDelLogIds.has(r.id)) {
          await tx
            .insert(deletionLogs)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              origin: typeof r.origin === 'string' ? r.origin : 'DIRETA',
              requestId: typeof r.request_id === 'string' ? r.request_id : null,
              recordType,
              targetId: r.target_id,
              targetCode: typeof r.target_code === 'string' ? r.target_code : '',
              targetName: typeof r.target_name === 'string' ? r.target_name : '',
              targetDetails: typeof r.target_details === 'string' ? r.target_details : '',
              quantity: Number(r.quantity ?? 0),
              reason: typeof r.reason === 'string' ? r.reason : '',
              requestedBy: typeof r.requested_by === 'string' ? r.requested_by : '',
              requestedByDate: typeof r.requested_by_date === 'string' ? r.requested_by_date : '',
              approvedBy: typeof r.approved_by === 'string' ? r.approved_by : null,
              approvedAt: typeof r.approved_at === 'string' ? r.approved_at : null,
              deletedBy: typeof r.deleted_by === 'string' ? r.deleted_by : '',
              deletedByEmail: typeof r.deleted_by_email === 'string' ? r.deleted_by_email : '',
              deletedByUid: typeof r.deleted_by_uid === 'string' ? r.deleted_by_uid : '',
              deletedAt: typeof r.deleted_at === 'string' ? r.deleted_at : '',
              createdAt: parseDateValue(r.created_at),
            })
            .onConflictDoNothing({ target: deletionLogs.id });
          existingDelLogIds.add(r.id);
        }
      }

      if (deletedMovementIds.size > 0) {
        await tx.delete(movements).where(inArray(movements.id, [...deletedMovementIds]));
      }
      if (deletedNegativeRequestIds.size > 0) {
        await tx
          .delete(negativeRequests)
          .where(inArray(negativeRequests.id, [...deletedNegativeRequestIds]));
      }
      if (deletedCollaboratorIds.size > 0) {
        await tx
          .delete(collaborators)
          .where(inArray(collaborators.id, [...deletedCollaboratorIds]));
      }
      if (deletedProductIds.size > 0) {
        await tx.delete(products).where(inArray(products.id, [...deletedProductIds]));
      }

      // 2. System settings
      const localSettings = await tx.select().from(systemSettings);
      const settingsById = new Map(localSettings.map((s) => [s.id, s]));
      for (const r of settingsRes.rows) {
        if (typeof r.id !== 'string') continue;
        const local = settingsById.get(r.id);
        if (!local) {
          await tx
            .insert(systemSettings)
            .values({
              id: r.id,
              showProductPhotos: Boolean(r.show_product_photos ?? true),
              companyName: typeof r.company_name === 'string' ? r.company_name : 'QHS Engenharia',
              companySubtitle:
                typeof r.company_subtitle === 'string' ? r.company_subtitle : '',
              cnpj: typeof r.cnpj === 'string' ? r.cnpj : '',
              contactEmail: typeof r.contact_email === 'string' ? r.contact_email : '',
              lowStockAlertNotification: Boolean(r.low_stock_alert_notification ?? true),
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: systemSettings.id });
        } else if (
          shouldUpdateSeedAwareRow(local.createdAt, local.updatedAt, r.created_at, r.updated_at)
        ) {
          await tx
            .update(systemSettings)
            .set({
              showProductPhotos: Boolean(r.show_product_photos ?? local.showProductPhotos),
              companyName:
                typeof r.company_name === 'string' ? r.company_name : local.companyName,
              companySubtitle:
                typeof r.company_subtitle === 'string'
                  ? r.company_subtitle
                  : local.companySubtitle,
              cnpj: typeof r.cnpj === 'string' ? r.cnpj : local.cnpj,
              contactEmail:
                typeof r.contact_email === 'string' ? r.contact_email : local.contactEmail,
              lowStockAlertNotification: Boolean(
                r.low_stock_alert_notification ?? local.lowStockAlertNotification
              ),
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(systemSettings.id, local.id));
        }
      }

      // 3. Managed lists
      const localLists = await tx.select().from(managedLists);
      const listsById = new Map(localLists.map((l) => [l.id, l]));
      for (const r of listsRes.rows) {
        if (typeof r.id !== 'string') continue;
        const local = listsById.get(r.id);
        const groups = toStringArray(r.groups);
        const roles = toStringArray(r.roles);
        const destinations = toStringArray(r.destinations);
        if (!local) {
          await tx
            .insert(managedLists)
            .values({
              id: r.id,
              groups,
              roles,
              destinations,
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: managedLists.id });
        } else if (
          shouldUpdateSeedAwareRow(local.createdAt, local.updatedAt, r.created_at, r.updated_at)
        ) {
          await tx
            .update(managedLists)
            .set({
              groups,
              roles,
              destinations,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(managedLists.id, local.id));
        }
      }

      // 4. Users
      const localUsers = await tx.select().from(users);
      const userById = new Map(localUsers.map((u) => [u.id, u]));
      const userByEmail = new Map(localUsers.map((u) => [u.email.toLowerCase(), u]));
      const userByUid = new Map(
        localUsers.filter((u) => Boolean(u.uid)).map((u) => [String(u.uid), u])
      );

      for (const r of usersRes.rows) {
        if (typeof r.id !== 'string' || typeof r.email !== 'string') continue;
        const emailLower = r.email.trim().toLowerCase();
        if (!emailLower) continue;

        const local = userById.get(r.id) ?? userByEmail.get(emailLower);
        const rawUid = typeof r.uid === 'string' && r.uid.trim() ? r.uid.trim() : null;
        const conflictingUidOwner = rawUid ? userByUid.get(rawUid) : undefined;
        const safeUid =
          rawUid && (!conflictingUidOwner || conflictingUidOwner.id === (local?.id ?? r.id))
            ? rawUid
            : null;
        const perms = normalizePermissions(
          (r.permissions as Partial<UserPermissions> | null) || undefined
        );

        if (!local) {
          const inserted = await tx
            .insert(users)
            .values({
              id: r.id,
              uid: safeUid,
              name: typeof r.name === 'string' ? r.name : emailLower,
              email: emailLower,
              role: typeof r.role === 'string' ? r.role : 'Operador de Estoque',
              department: typeof r.department === 'string' ? r.department : '',
              isAdmin: Boolean(r.is_admin),
              canDelete: Boolean(r.is_admin || r.can_delete),
              active: r.active !== false,
              permissions: perms,
              registrationDate:
                typeof r.registration_date === 'string' ? r.registration_date : '',
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: users.id })
            .returning();
          if (inserted[0]) {
            userById.set(inserted[0].id, inserted[0]);
            userByEmail.set(inserted[0].email.toLowerCase(), inserted[0]);
            if (inserted[0].uid) userByUid.set(inserted[0].uid, inserted[0]);
          }
        } else if (
          toMillis(r.updated_at) > toMillis(local.updatedAt) ||
          (!local.uid && Boolean(safeUid))
        ) {
          const nextUid = safeUid ?? local.uid ?? null;
          const updated = await tx
            .update(users)
            .set({
              uid: nextUid,
              name: typeof r.name === 'string' ? r.name : local.name,
              role: typeof r.role === 'string' ? r.role : local.role,
              department: typeof r.department === 'string' ? r.department : local.department,
              isAdmin: Boolean(r.is_admin),
              canDelete: Boolean(r.is_admin || r.can_delete),
              active: r.active !== false,
              permissions: perms,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(users.id, local.id))
            .returning();
          if (updated[0]) {
            userById.set(updated[0].id, updated[0]);
            userByEmail.set(updated[0].email.toLowerCase(), updated[0]);
            if (updated[0].uid) userByUid.set(updated[0].uid, updated[0]);
          }
        }
      }

      // 5. Collaborators
      const localCollabs = await tx.select().from(collaborators);
      const collabMap = new Map(localCollabs.map((c) => [c.id, c]));
      for (const r of collabsRes.rows) {
        if (typeof r.id !== 'string' || deletedCollaboratorIds.has(r.id)) continue;
        const local = collabMap.get(r.id);
        if (!local) {
          const inserted = await tx
            .insert(collaborators)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              fullName: typeof r.full_name === 'string' ? r.full_name : '',
              role: typeof r.role === 'string' ? r.role : '',
              active: r.active !== false,
              registrationDate:
                typeof r.registration_date === 'string' ? r.registration_date : '',
              displayUpdatedAt:
                typeof r.display_updated_at === 'string' ? r.display_updated_at : '',
              ownerUid: typeof r.owner_uid === 'string' ? r.owner_uid : '',
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: collaborators.id })
            .returning();
          if (inserted[0]) collabMap.set(inserted[0].id, inserted[0]);
        } else if (toMillis(r.updated_at) > toMillis(local.updatedAt)) {
          const updated = await tx
            .update(collaborators)
            .set({
              fullName: typeof r.full_name === 'string' ? r.full_name : local.fullName,
              role: typeof r.role === 'string' ? r.role : local.role,
              active: r.active !== false,
              displayUpdatedAt:
                typeof r.display_updated_at === 'string'
                  ? r.display_updated_at
                  : local.displayUpdatedAt,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(collaborators.id, local.id))
            .returning();
          if (updated[0]) collabMap.set(updated[0].id, updated[0]);
        }
      }

      // 6. Products
      const localProducts = await tx.select().from(products);
      const productMap = new Map(localProducts.map((p) => [p.id, p]));
      for (const r of prodsRes.rows) {
        if (typeof r.id !== 'string' || deletedProductIds.has(r.id)) continue;
        const local = productMap.get(r.id);
        if (!local) {
          const inserted = await tx
            .insert(products)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              code: typeof r.code === 'string' ? r.code : '',
              name: typeof r.name === 'string' ? r.name : '',
              groupName: typeof r.group_name === 'string' ? r.group_name : '',
              currentStock: Number(r.current_stock ?? 0),
              minStock: Number(r.min_stock ?? 0),
              photoUrl: typeof r.photo_url === 'string' ? r.photo_url : '',
              description: typeof r.description === 'string' ? r.description : '',
              registrationDate:
                typeof r.registration_date === 'string' ? r.registration_date : '',
              displayUpdatedAt:
                typeof r.display_updated_at === 'string' ? r.display_updated_at : '',
              ownerUid: typeof r.owner_uid === 'string' ? r.owner_uid : '',
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: products.id })
            .returning();
          if (inserted[0]) productMap.set(inserted[0].id, inserted[0]);
        } else if (toMillis(r.updated_at) > toMillis(local.updatedAt)) {
          const updated = await tx
            .update(products)
            .set({
              code: typeof r.code === 'string' ? r.code : local.code,
              name: typeof r.name === 'string' ? r.name : local.name,
              groupName: typeof r.group_name === 'string' ? r.group_name : local.groupName,
              currentStock: Number(r.current_stock ?? local.currentStock),
              minStock: Number(r.min_stock ?? local.minStock),
              photoUrl: typeof r.photo_url === 'string' ? r.photo_url : local.photoUrl,
              description:
                typeof r.description === 'string' ? r.description : local.description,
              displayUpdatedAt:
                typeof r.display_updated_at === 'string'
                  ? r.display_updated_at
                  : local.displayUpdatedAt,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(products.id, local.id))
            .returning();
          if (updated[0]) productMap.set(updated[0].id, updated[0]);
        }
      }

      // 7. Movements
      const localMovs = await tx.select().from(movements);
      const movMap = new Map(localMovs.map((m) => [m.id, m]));
      for (const r of movsRes.rows) {
        if (typeof r.id !== 'string' || typeof r.product_id !== 'string') continue;
        if (
          deletedMovementIds.has(r.id) ||
          deletedProductIds.has(r.product_id) ||
          !productMap.has(r.product_id)
        ) {
          continue;
        }
        const safeCollabId =
          typeof r.collaborator_id === 'string' && collabMap.has(r.collaborator_id)
            ? r.collaborator_id
            : null;
        const local = movMap.get(r.id);
        if (!local) {
          await tx
            .insert(movements)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              productId: r.product_id,
              productCode: typeof r.product_code === 'string' ? r.product_code : '',
              productName: typeof r.product_name === 'string' ? r.product_name : '',
              groupName: typeof r.group_name === 'string' ? r.group_name : '',
              type: r.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
              quantity: Number(r.quantity ?? 0),
              stockAfterMovement: Number(r.stock_after_movement ?? 0),
              date: typeof r.date === 'string' ? r.date : '',
              withdrawnBy: typeof r.withdrawn_by === 'string' ? r.withdrawn_by : null,
              collaboratorId: safeCollabId,
              responsibleUser:
                typeof r.responsible_user === 'string' ? r.responsible_user : '',
              destination: typeof r.destination === 'string' ? r.destination : null,
              notes: typeof r.notes === 'string' ? r.notes : null,
              isNegativeStockAuthorized:
                r.is_negative_stock_authorized === null ||
                r.is_negative_stock_authorized === undefined
                  ? null
                  : Boolean(r.is_negative_stock_authorized),
              authorizedBy: typeof r.authorized_by === 'string' ? r.authorized_by : null,
              ownerUid: typeof r.owner_uid === 'string' ? r.owner_uid : '',
              createdAt: parseDateValue(r.created_at),
            })
            .onConflictDoNothing({ target: movements.id });
        } else if (typeof r.group_name === 'string' && r.group_name !== local.groupName) {
          await tx
            .update(movements)
            .set({ groupName: r.group_name })
            .where(eq(movements.id, local.id));
        }
      }

      // 8. Negative requests
      const localNegReqs = await tx.select().from(negativeRequests);
      const negMap = new Map(localNegReqs.map((n) => [n.id, n]));
      for (const r of negReqsRes.rows) {
        if (typeof r.id !== 'string' || typeof r.product_id !== 'string') continue;
        if (
          deletedNegativeRequestIds.has(r.id) ||
          deletedProductIds.has(r.product_id) ||
          !productMap.has(r.product_id)
        ) {
          continue;
        }
        const safeCollabId =
          typeof r.collaborator_id === 'string' && collabMap.has(r.collaborator_id)
            ? r.collaborator_id
            : null;
        const local = negMap.get(r.id);
        if (!local) {
          await tx
            .insert(negativeRequests)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              productId: r.product_id,
              productCode: typeof r.product_code === 'string' ? r.product_code : '',
              productName: typeof r.product_name === 'string' ? r.product_name : '',
              groupName: typeof r.group_name === 'string' ? r.group_name : '',
              requestedQuantity: Number(r.requested_quantity ?? 0),
              availableStock: Number(r.available_stock ?? 0),
              deficitQuantity: Number(r.deficit_quantity ?? 0),
              withdrawnBy: typeof r.withdrawn_by === 'string' ? r.withdrawn_by : '',
              collaboratorId: safeCollabId,
              destination: typeof r.destination === 'string' ? r.destination : '',
              requestedBy: typeof r.requested_by === 'string' ? r.requested_by : '',
              requestedByUid: typeof r.requested_by_uid === 'string' ? r.requested_by_uid : '',
              reason: typeof r.reason === 'string' ? r.reason : '',
              date: typeof r.date === 'string' ? r.date : '',
              status: typeof r.status === 'string' ? r.status : 'PENDENTE',
              reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
              reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: negativeRequests.id });
        } else if (toMillis(r.updated_at) > toMillis(local.updatedAt)) {
          await tx
            .update(negativeRequests)
            .set({
              status: typeof r.status === 'string' ? r.status : local.status,
              reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
              reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(negativeRequests.id, local.id));
        }
      }

      // 9. Deletion requests
      const localDelReqs = await tx.select().from(deletionRequests);
      const delReqMap = new Map(localDelReqs.map((d) => [d.id, d]));
      for (const r of delReqsRes.rows) {
        if (typeof r.id !== 'string' || typeof r.target_id !== 'string') continue;
        const local = delReqMap.get(r.id);
        if (!local) {
          await tx
            .insert(deletionRequests)
            .values({
              id: r.id,
              orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
              recordType: typeof r.record_type === 'string' ? r.record_type : 'PRODUTO',
              targetId: r.target_id,
              targetCode: typeof r.target_code === 'string' ? r.target_code : '',
              targetName: typeof r.target_name === 'string' ? r.target_name : '',
              targetDetails: typeof r.target_details === 'string' ? r.target_details : '',
              quantity: Number(r.quantity ?? 0),
              reason: typeof r.reason === 'string' ? r.reason : '',
              requestedBy: typeof r.requested_by === 'string' ? r.requested_by : '',
              requestedByEmail:
                typeof r.requested_by_email === 'string' ? r.requested_by_email : '',
              requestedByUid: typeof r.requested_by_uid === 'string' ? r.requested_by_uid : '',
              date: typeof r.date === 'string' ? r.date : '',
              status: typeof r.status === 'string' ? r.status : 'PENDENTE',
              reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
              reviewedByEmail:
                typeof r.reviewed_by_email === 'string' ? r.reviewed_by_email : null,
              reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
              executedBy: typeof r.executed_by === 'string' ? r.executed_by : null,
              executedAt: typeof r.executed_at === 'string' ? r.executed_at : null,
              createdAt: parseDateValue(r.created_at),
              updatedAt: parseDateValue(r.updated_at),
            })
            .onConflictDoNothing({ target: deletionRequests.id });
        } else if (toMillis(r.updated_at) > toMillis(local.updatedAt)) {
          await tx
            .update(deletionRequests)
            .set({
              status: typeof r.status === 'string' ? r.status : local.status,
              reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
              reviewedByEmail:
                typeof r.reviewed_by_email === 'string' ? r.reviewed_by_email : null,
              reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
              executedBy: typeof r.executed_by === 'string' ? r.executed_by : null,
              executedAt: typeof r.executed_at === 'string' ? r.executed_at : null,
              updatedAt: parseDateValue(r.updated_at),
            })
            .where(eq(deletionRequests.id, local.id));
        }
      }

      // 10. Access requests
      if (accReqsRes.rows.length > 0) {
        const localAccReqs = await tx.select().from(accessRequests);
        const accReqMap = new Map(localAccReqs.map((a) => [a.id, a]));
        for (const r of accReqsRes.rows) {
          if (typeof r.id !== 'string' || typeof r.email !== 'string') continue;
          const emailLower = r.email.trim().toLowerCase();
          const local = accReqMap.get(r.id);
          if (!local) {
            await tx
              .insert(accessRequests)
              .values({
                id: r.id,
                orgId: typeof r.org_id === 'string' ? r.org_id : 'qhs-engenharia',
                name: typeof r.name === 'string' ? r.name : emailLower,
                email: emailLower,
                role: typeof r.role === 'string' ? r.role : '',
                department: typeof r.department === 'string' ? r.department : '',
                reason: typeof r.reason === 'string' ? r.reason : '',
                date: typeof r.date === 'string' ? r.date : '',
                status: typeof r.status === 'string' ? r.status : 'PENDENTE',
                reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
                reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
                createdAt: parseDateValue(r.created_at),
                updatedAt: parseDateValue(r.updated_at),
              })
              .onConflictDoNothing({ target: accessRequests.id });
          } else if (toMillis(r.updated_at) > toMillis(local.updatedAt)) {
            await tx
              .update(accessRequests)
              .set({
                name: typeof r.name === 'string' ? r.name : local.name,
                role: typeof r.role === 'string' ? r.role : local.role,
                department: typeof r.department === 'string' ? r.department : local.department,
                reason: typeof r.reason === 'string' ? r.reason : local.reason,
                date: typeof r.date === 'string' ? r.date : local.date,
                status: typeof r.status === 'string' ? r.status : local.status,
                reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : null,
                reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : null,
                updatedAt: parseDateValue(r.updated_at),
              })
              .where(eq(accessRequests.id, local.id));
          }
        }
      }
    });

    lastPullAt = Date.now();
    return true;
  } catch (error) {
    console.error('[Supabase Sync] Failed pulling from Supabase to Cloud SQL:', error);
    return false;
  }
}

export async function pullFromSupabaseToCloudSql(options?: { force?: boolean }): Promise<boolean> {
  const config = ensureWritableConfig();
  if (!config) return false;

  const force = Boolean(options?.force);
  if (!force && Date.now() - lastPullAt < PULL_THROTTLE_MS) {
    return true;
  }

  if (inFlightPull) {
    return inFlightPull;
  }

  inFlightPull = runPullFromSupabaseToCloudSql(config).finally(() => {
    inFlightPull = null;
  });

  return inFlightPull;
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
      accessReqRows,
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
      db.select().from(accessRequests),
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

    // Sync access_requests without blocking core 9 tables if user hasn't run updated DDL yet
    await upsertSupabaseRows('access_requests', accessReqRows.map(toSupabaseAccessRequest));

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

  initialSyncPromise = (async () => {
    const pulled = await pullFromSupabaseToCloudSql({ force: true });
    if (!pulled) return false;
    return syncAllTablesToSupabase();
  })()
    .then((ok) => {
      if (ok) {
        initialSyncSignature = sig;
        console.log('[Supabase Sync] Sincronização bidirecional inicial concluída com sucesso.');
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
  await deleteSupabaseWhere('access_requests', 'id=not.is.null');
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
