import type {
  AccessRequest,
  AccessRequestStatus,
  Collaborator,
  DeletionLog,
  DeletionRecordType,
  DeletionRequest,
  ManagedLists,
  NegativeStockRequest,
  Product,
  StockMovement,
  SystemSettings,
  User,
  UserPermissions,
} from '../types/index.ts';
import { INITIAL_LISTS, INITIAL_SETTINGS } from '../data/initialData.ts';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DomainError,
  FULL_ADMIN_PERMISSIONS,
  ORG_ID,
  formatDateTimeNow,
  formatDateToday,
  normalizePermissions,
} from './shared.ts';

interface SupabaseRestConfig {
  url: string;
  key: string;
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']+|["']+$/g, '').trim();
}

function normalizeUrl(raw: string): string {
  const cleaned = stripQuotes(raw).replace(/\/+$/, '');
  if (!cleaned.startsWith('http')) return '';
  try {
    return new URL(cleaned).origin;
  } catch {
    return cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true;
  if (key.startsWith('eyJ')) {
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
          role?: unknown;
        };
        if (decoded?.role === 'anon') return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

function getRequiredConfig(): SupabaseRestConfig {
  const rawUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  let rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '';

  rawKey = stripQuotes(rawKey);
  if (/^Bearer\s+/i.test(rawKey)) {
    rawKey = rawKey.replace(/^Bearer\s+/i, '').trim();
  }

  const url = normalizeUrl(rawUrl);
  if (!url || !rawKey) {
    throw new DomainError(
      'Backend conectado, mas falta configurar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas Environment Variables da hospedagem (Vercel / servidor) e refazer o deploy.',
      503
    );
  }

  if (isPublicKey(rawKey)) {
    throw new DomainError(
      'A variável SUPABASE_SERVICE_ROLE_KEY está usando uma chave pública (anon/publishable). Substitua pela chave secreta service_role ou sb_secret_ do Supabase.',
      503
    );
  }

  return { url, key: rawKey };
}

function makeHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
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

async function sbRequest<T>(
  pathWithQuery: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    prefer?: string;
    ignoreMissingTable?: boolean;
  } = {}
): Promise<T> {
  const config = getRequiredConfig();
  const headers = makeHeaders(
    config.key,
    options.prefer ? { Prefer: options.prefer } : undefined
  );

  const response = await fetch(`${config.url}/rest/v1/${pathWithQuery}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const isMissingTable =
      response.status === 404 || errorText.includes('PGRST205') || errorText.includes('42P01');

    if (options.ignoreMissingTable && isMissingTable) {
      return [] as unknown as T;
    }

    if (isMissingTable) {
      throw new DomainError(
        `Tabela não encontrada no Supabase (${pathWithQuery.split('?')[0]}). Execute o script SQL em supabase/supabase_migration_completa.sql no SQL Editor do Supabase.`,
        503
      );
    }

    throw new Error(`Supabase REST ${response.status} on ${pathWithQuery}: ${errorText}`);
  }

  if (response.status === 204) {
    return [] as unknown as T;
  }

  const text = await response.text().catch(() => '');
  if (!text) return [] as unknown as T;
  return JSON.parse(text) as T;
}

type DbRow = Record<string, unknown>;

function mapUser(r: DbRow): User {
  const perms = (r.permissions as Partial<UserPermissions> | null) || {};
  return {
    id: String(r.id),
    name: String(r.name || ''),
    email: String(r.email || ''),
    role: String(r.role || ''),
    department: String(r.department || ''),
    isAdmin: Boolean(r.is_admin),
    canDelete: Boolean(r.is_admin || r.can_delete),
    permissions: normalizePermissions(perms),
    active: r.active !== false,
    createdAt: String(r.registration_date || ''),
  };
}

function mapCollaborator(r: DbRow): Collaborator {
  return {
    id: String(r.id),
    fullName: String(r.full_name || ''),
    role: String(r.role || ''),
    active: r.active !== false,
    createdAt: String(r.registration_date || ''),
    updatedAt: String(r.display_updated_at || ''),
  };
}

function mapProduct(r: DbRow): Product {
  return {
    id: String(r.id),
    code: String(r.code || ''),
    name: String(r.name || ''),
    group: String(r.group_name || ''),
    currentStock: Number(r.current_stock ?? 0),
    minStock: Number(r.min_stock ?? 0),
    photoUrl: String(r.photo_url || ''),
    description: String(r.description || ''),
    createdAt: String(r.registration_date || ''),
    updatedAt: String(r.display_updated_at || ''),
  };
}

function mapMovement(r: DbRow): StockMovement {
  return {
    id: String(r.id),
    productId: String(r.product_id || ''),
    productCode: String(r.product_code || ''),
    productName: String(r.product_name || ''),
    group: String(r.group_name || ''),
    type: r.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
    quantity: Number(r.quantity ?? 0),
    stockAfterMovement: Number(r.stock_after_movement ?? 0),
    date: String(r.date || ''),
    withdrawnBy: typeof r.withdrawn_by === 'string' ? r.withdrawn_by : undefined,
    collaboratorId: typeof r.collaborator_id === 'string' ? r.collaborator_id : undefined,
    responsibleUser: String(r.responsible_user || ''),
    destination: typeof r.destination === 'string' ? r.destination : undefined,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    isNegativeStockAuthorized:
      r.is_negative_stock_authorized !== null && r.is_negative_stock_authorized !== undefined
        ? Boolean(r.is_negative_stock_authorized)
        : undefined,
    authorizedBy: typeof r.authorized_by === 'string' ? r.authorized_by : undefined,
  };
}

function mapNegativeRequest(r: DbRow): NegativeStockRequest {
  return {
    id: String(r.id),
    productId: String(r.product_id || ''),
    productCode: String(r.product_code || ''),
    productName: String(r.product_name || ''),
    group: String(r.group_name || ''),
    requestedQuantity: Number(r.requested_quantity ?? 0),
    availableStock: Number(r.available_stock ?? 0),
    deficitQuantity: Number(r.deficit_quantity ?? 0),
    withdrawnBy: String(r.withdrawn_by || ''),
    collaboratorId: typeof r.collaborator_id === 'string' ? r.collaborator_id : undefined,
    destination: String(r.destination || ''),
    requestedBy: String(r.requested_by || ''),
    reason: String(r.reason || ''),
    date: String(r.date || ''),
    status: r.status === 'APROVADO' ? 'APROVADO' : r.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE',
    reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : undefined,
    reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : undefined,
  };
}

function toRecordType(rt: unknown): DeletionRecordType {
  return rt === 'PRODUTO' ||
    rt === 'ENTRADA' ||
    rt === 'SAIDA' ||
    rt === 'SOLICITACAO_NEGATIVA' ||
    rt === 'COLABORADOR'
    ? rt
    : 'PRODUTO';
}

function mapDeletionRequest(r: DbRow): DeletionRequest {
  return {
    id: String(r.id),
    recordType: toRecordType(r.record_type),
    targetId: String(r.target_id || ''),
    targetCode: String(r.target_code || ''),
    targetName: String(r.target_name || ''),
    targetDetails: String(r.target_details || ''),
    quantity: Number(r.quantity ?? 0),
    reason: String(r.reason || ''),
    requestedBy: String(r.requested_by || ''),
    requestedByEmail: String(r.requested_by_email || ''),
    requestedByUid: String(r.requested_by_uid || ''),
    date: String(r.date || ''),
    status: r.status === 'APROVADO' ? 'APROVADO' : r.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE',
    reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : undefined,
    reviewedByEmail: typeof r.reviewed_by_email === 'string' ? r.reviewed_by_email : undefined,
    reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : undefined,
    executedBy: typeof r.executed_by === 'string' ? r.executed_by : undefined,
    executedAt: typeof r.executed_at === 'string' ? r.executed_at : undefined,
  };
}

function mapDeletionLog(r: DbRow): DeletionLog {
  return {
    id: String(r.id),
    origin: r.origin === 'APROVADA' ? 'APROVADA' : 'DIRETA',
    requestId: typeof r.request_id === 'string' ? r.request_id : undefined,
    recordType: toRecordType(r.record_type),
    targetId: String(r.target_id || ''),
    targetCode: String(r.target_code || ''),
    targetName: String(r.target_name || ''),
    targetDetails: String(r.target_details || ''),
    quantity: Number(r.quantity ?? 0),
    reason: String(r.reason || ''),
    requestedBy: String(r.requested_by || ''),
    requestedByDate: String(r.requested_by_date || ''),
    approvedBy: typeof r.approved_by === 'string' ? r.approved_by : undefined,
    approvedAt: typeof r.approved_at === 'string' ? r.approved_at : undefined,
    deletedBy: String(r.deleted_by || ''),
    deletedByEmail: String(r.deleted_by_email || ''),
    deletedByUid: String(r.deleted_by_uid || ''),
    deletedAt: String(r.deleted_at || ''),
  };
}

function mapAccessRequest(r: DbRow): AccessRequest {
  const status: AccessRequestStatus =
    r.status === 'APROVADO' ? 'APROVADO' : r.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE';
  return {
    id: String(r.id),
    name: String(r.name || ''),
    email: String(r.email || ''),
    role: String(r.role || ''),
    department: String(r.department || ''),
    reason: String(r.reason || ''),
    date: String(r.date || ''),
    status,
    reviewedBy: typeof r.reviewed_by === 'string' ? r.reviewed_by : undefined,
    reviewedAt: typeof r.reviewed_at === 'string' ? r.reviewed_at : undefined,
  };
}

async function ensureDefaultsSeededSupabase() {
  const existingSettings = await sbRequest<DbRow[]>('system_settings?id=eq.global&limit=1');
  if (existingSettings.length === 0) {
    await sbRequest('system_settings?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: {
        id: 'global',
        show_product_photos: INITIAL_SETTINGS.showProductPhotos,
        company_name: INITIAL_SETTINGS.companyName,
        company_subtitle: INITIAL_SETTINGS.companySubtitle,
        cnpj: INITIAL_SETTINGS.cnpj,
        contact_email: INITIAL_SETTINGS.contactEmail,
        low_stock_alert_notification: INITIAL_SETTINGS.lowStockAlertNotification,
      },
    });
  }

  const existingLists = await sbRequest<DbRow[]>('managed_lists?id=eq.global&limit=1');
  if (existingLists.length === 0) {
    await sbRequest('managed_lists?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: {
        id: 'global',
        groups: INITIAL_LISTS.groups,
        roles: INITIAL_LISTS.roles,
        destinations: INITIAL_LISTS.destinations,
      },
    });
  }
}

export async function checkEmailInvitationStatusSupabase(email: string) {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower || !emailLower.includes('@')) {
    return {
      authorized: false,
      alreadyActivated: false,
      message: 'Informe um endereço de e-mail válido.',
    };
  }

  await ensureDefaultsSeededSupabase();

  const rows = await sbRequest<DbRow[]>(
    `users?email=eq.${encodeURIComponent(emailLower)}&select=id,active,uid&limit=1`
  );

  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return {
      authorized: true,
      alreadyActivated: Boolean(rows[0]?.uid),
    };
  }

  if (!rows[0]) {
    return {
      authorized: false,
      alreadyActivated: false,
      message: `O e-mail ${email.trim()} ainda não foi autorizado pelo Administrador da QHS Engenharia.`,
    };
  }

  if (rows[0].active === false) {
    return {
      authorized: false,
      alreadyActivated: Boolean(rows[0].uid),
      message: 'Este e-mail está inativo no sistema. Contate o Administrador da QHS Engenharia.',
    };
  }

  return {
    authorized: true,
    alreadyActivated: Boolean(rows[0].uid),
  };
}

export async function resolveAuthenticatedUserSupabase(params: {
  uid: string;
  email: string;
  displayName?: string;
}): Promise<{ authorized: boolean; isRealAdmin: boolean; user?: User; errorMessage?: string }> {
  const emailLower = params.email.trim().toLowerCase();
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  await ensureDefaultsSeededSupabase();

  if (isBootstrapped) {
    const existingByEmail = await sbRequest<DbRow[]>(
      `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
    );

    if (existingByEmail[0]) {
      const updated = await sbRequest<DbRow[]>(
        `users?id=eq.${encodeURIComponent(String(existingByEmail[0].id))}`,
        {
          method: 'PATCH',
          prefer: 'return=representation',
          body: {
            uid: params.uid,
            is_admin: true,
            can_delete: true,
            active: true,
            permissions: FULL_ADMIN_PERMISSIONS,
            updated_at: new Date().toISOString(),
          },
        }
      );
      return {
        authorized: true,
        isRealAdmin: true,
        user: mapUser(updated[0] || existingByEmail[0]),
      };
    }

    const inserted = await sbRequest<DbRow[]>('users?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        id: 'user-owner',
        uid: params.uid,
        name: (params.displayName || 'Welisson Oliveira').slice(0, 120),
        email: emailLower,
        role: 'Diretor de Engenharia & Admin',
        department: 'Diretoria Técnica',
        is_admin: true,
        can_delete: true,
        active: true,
        permissions: FULL_ADMIN_PERMISSIONS,
        registration_date: formatDateToday(),
        updated_at: new Date().toISOString(),
      },
    });

    return {
      authorized: true,
      isRealAdmin: true,
      user: mapUser(inserted[0]),
    };
  }

  const found = await sbRequest<DbRow[]>(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );
  const userRow = found[0];
  if (!userRow) {
    return {
      authorized: false,
      isRealAdmin: false,
      errorMessage: `O e-mail ${params.email} ainda não foi autorizado no sistema da QHS Engenharia.`,
    };
  }

  if (userRow.active === false) {
    return {
      authorized: false,
      isRealAdmin: false,
      errorMessage: 'Seu cadastro está inativo no momento. Contate o Administrador da QHS Engenharia.',
    };
  }

  if (userRow.uid !== params.uid) {
    const updated = await sbRequest<DbRow[]>(
      `users?id=eq.${encodeURIComponent(String(userRow.id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { uid: params.uid, updated_at: new Date().toISOString() },
      }
    );
    const row = updated[0] || userRow;
    return {
      authorized: true,
      isRealAdmin: Boolean(row.is_admin),
      user: mapUser(row),
    };
  }

  return {
    authorized: true,
    isRealAdmin: Boolean(userRow.is_admin),
    user: mapUser(userRow),
  };
}

export async function getBootstrapDataSupabase(currentUser: User, uid: string) {
  await ensureDefaultsSeededSupabase();

  const [
    allUsersRows,
    collabRows,
    prodRows,
    movRows,
    negRows,
    delReqRows,
    delLogRows,
    accessReqRows,
    listsRows,
    settingsRows,
  ] = await Promise.all([
    sbRequest<DbRow[]>('users?select=*'),
    sbRequest<DbRow[]>('collaborators?select=*'),
    sbRequest<DbRow[]>('products?select=*'),
    sbRequest<DbRow[]>('movements?select=*'),
    sbRequest<DbRow[]>('negative_requests?select=*'),
    currentUser.isAdmin
      ? sbRequest<DbRow[]>('deletion_requests?select=*')
      : sbRequest<DbRow[]>(
          `deletion_requests?requested_by_uid=eq.${encodeURIComponent(uid)}&select=*`
        ),
    currentUser.isAdmin ? sbRequest<DbRow[]>('deletion_logs?select=*') : Promise.resolve([]),
    currentUser.isAdmin
      ? sbRequest<DbRow[]>('access_requests?select=*', { ignoreMissingTable: true })
      : Promise.resolve([]),
    sbRequest<DbRow[]>('managed_lists?id=eq.global&limit=1'),
    sbRequest<DbRow[]>('system_settings?id=eq.global&limit=1'),
  ]);

  const mappedUsers = allUsersRows.map(mapUser);
  const visibleUsers = currentUser.isAdmin
    ? mappedUsers
    : [
        currentUser,
        ...mappedUsers
          .filter((u) => u.id !== currentUser.id)
          .map((u) => ({
            ...u,
            email: '',
            permissions: normalizePermissions(),
            canDelete: false,
          })),
      ];

  const listsRow = listsRows[0];
  const lists: ManagedLists = listsRow
    ? {
        groups: Array.isArray(listsRow.groups) ? (listsRow.groups as string[]) : INITIAL_LISTS.groups,
        roles: Array.isArray(listsRow.roles) ? (listsRow.roles as string[]) : INITIAL_LISTS.roles,
        destinations: Array.isArray(listsRow.destinations)
          ? (listsRow.destinations as string[])
          : INITIAL_LISTS.destinations,
      }
    : INITIAL_LISTS;

  const sRow = settingsRows[0];
  const settings: SystemSettings = sRow
    ? {
        showProductPhotos: Boolean(sRow.show_product_photos),
        companyName: String(sRow.company_name || INITIAL_SETTINGS.companyName),
        companySubtitle: String(sRow.company_subtitle || INITIAL_SETTINGS.companySubtitle),
        cnpj: String(sRow.cnpj || INITIAL_SETTINGS.cnpj),
        contactEmail: String(sRow.contact_email || INITIAL_SETTINGS.contactEmail),
        lowStockAlertNotification: Boolean(sRow.low_stock_alert_notification),
      }
    : INITIAL_SETTINGS;

  return {
    currentUser,
    users: visibleUsers,
    collaborators: collabRows
      .map(mapCollaborator)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    products: prodRows.map(mapProduct).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    movements: movRows.map(mapMovement).sort((a, b) => b.date.localeCompare(a.date)),
    negativeRequests: negRows.map(mapNegativeRequest).sort((a, b) => b.date.localeCompare(a.date)),
    deletionRequests: delReqRows.map(mapDeletionRequest).sort((a, b) => b.date.localeCompare(a.date)),
    deletionLogs: delLogRows.map(mapDeletionLog).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    accessRequests: accessReqRows.map(mapAccessRequest).sort((a, b) => b.date.localeCompare(a.date)),
    managedLists: lists,
    settings,
  };
}

export async function updateSystemSettingsSupabase(newSettings: Partial<SystemSettings>) {
  await ensureDefaultsSeededSupabase();
  const payload: DbRow = { updated_at: new Date().toISOString() };
  if (newSettings.showProductPhotos !== undefined) {
    payload.show_product_photos = Boolean(newSettings.showProductPhotos);
  }
  if (newSettings.companyName !== undefined) {
    payload.company_name = newSettings.companyName.trim().slice(0, 120);
  }
  if (newSettings.companySubtitle !== undefined) {
    payload.company_subtitle = newSettings.companySubtitle.trim().slice(0, 200);
  }
  if (newSettings.cnpj !== undefined) {
    payload.cnpj = newSettings.cnpj.trim().slice(0, 30);
  }
  if (newSettings.contactEmail !== undefined) {
    payload.contact_email = newSettings.contactEmail.trim().slice(0, 150);
  }
  if (newSettings.lowStockAlertNotification !== undefined) {
    payload.low_stock_alert_notification = Boolean(newSettings.lowStockAlertNotification);
  }

  await sbRequest('system_settings?id=eq.global', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: payload,
  });
}

export async function updateManagedListsSupabase(params: {
  lists: ManagedLists;
  renameGroup?: { oldName: string; newName: string };
  renameRole?: { oldName: string; newName: string };
}) {
  await sbRequest('managed_lists?id=eq.global', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      groups: params.lists.groups.slice(0, 100),
      roles: params.lists.roles.slice(0, 100),
      destinations: params.lists.destinations.slice(0, 150),
      updated_at: new Date().toISOString(),
    },
  });

  if (params.renameGroup) {
    const { oldName, newName } = params.renameGroup;
    await Promise.all([
      sbRequest(`products?group_name=eq.${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { group_name: newName, updated_at: new Date().toISOString() },
      }),
      sbRequest(`movements?group_name=eq.${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { group_name: newName },
      }),
    ]);
  }

  if (params.renameRole) {
    const { oldName, newName } = params.renameRole;
    await sbRequest(`users?role=eq.${encodeURIComponent(oldName)}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { role: newName, updated_at: new Date().toISOString() },
    });
  }
}

export async function createUserSupabase(newUser: Omit<User, 'id' | 'createdAt'>) {
  const emailLower = newUser.email.trim().toLowerCase();
  if (!emailLower || !newUser.name.trim()) {
    throw new DomainError('Nome e e-mail do usuário são obrigatórios.', 400);
  }
  const inserted = await sbRequest<DbRow[]>('users', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      id: `user-${Date.now()}`,
      name: newUser.name.trim().slice(0, 120),
      email: emailLower.slice(0, 200),
      role: newUser.role.trim().slice(0, 100),
      department: (newUser.department || '').trim().slice(0, 100),
      is_admin: Boolean(newUser.isAdmin),
      can_delete: Boolean(newUser.isAdmin || newUser.canDelete),
      active: Boolean(newUser.active),
      permissions: normalizePermissions(newUser.permissions),
      registration_date: formatDateToday(),
      updated_at: new Date().toISOString(),
    },
  });
  return mapUser(inserted[0]);
}

export async function updateUserSupabase(updatedUser: User) {
  const emailLower = updatedUser.email.trim().toLowerCase();
  const updated = await sbRequest<DbRow[]>(
    `users?id=eq.${encodeURIComponent(updatedUser.id)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        name: updatedUser.name.trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: updatedUser.role.trim().slice(0, 100),
        department: (updatedUser.department || '').trim().slice(0, 100),
        is_admin: Boolean(updatedUser.isAdmin),
        can_delete: Boolean(updatedUser.isAdmin || updatedUser.canDelete),
        active: Boolean(updatedUser.active),
        permissions: normalizePermissions(updatedUser.permissions),
        updated_at: new Date().toISOString(),
      },
    }
  );
  if (!updated[0]) throw new DomainError('Usuário não encontrado.', 404);
  return mapUser(updated[0]);
}

export async function updateUserPermissionsSupabase(userId: string, permissions: UserPermissions) {
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      permissions: normalizePermissions(permissions),
      updated_at: new Date().toISOString(),
    },
  });
}

export async function updateUserDeletePermissionSupabase(userId: string, canDelete: boolean) {
  const existing = await sbRequest<DbRow[]>(
    `users?id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError('Usuário não encontrado.', 404);
  if (existing[0].is_admin) {
    throw new DomainError('O Administrador principal sempre possui permissão total.', 400);
  }
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { can_delete: Boolean(canDelete), updated_at: new Date().toISOString() },
  });
}

export async function deleteUserSupabase(userId: string) {
  if (userId === 'user-owner') {
    throw new DomainError('Não é permitido excluir o Administrador principal.', 400);
  }
  await sbRequest(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
}

export async function createAccessRequestSupabase(params: {
  name: string;
  email: string;
  role?: string;
  department?: string;
  reason?: string;
}): Promise<{
  request?: AccessRequest;
  alreadyAuthorized?: boolean;
  message: string;
}> {
  const emailLower = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();

  if (!emailLower || !emailLower.includes('@')) {
    throw new DomainError('Informe um endereço de e-mail válido.', 400);
  }
  if (cleanName.length < 2) {
    throw new DomainError('Informe seu nome completo (mínimo 2 caracteres).', 400);
  }

  await ensureDefaultsSeededSupabase();

  if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return {
      alreadyAuthorized: true,
      message:
        'Este e-mail já é o Administrador Principal do sistema. Clique em "Já tenho senha" ou "Continuar com conta Google" para entrar.',
    };
  }

  const existingUsers = await sbRequest<DbRow[]>(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );
  if (existingUsers[0] && existingUsers[0].active !== false) {
    return {
      alreadyAuthorized: true,
      message:
        'Este e-mail já está autorizado! Use a aba "Primeiro Acesso" para criar sua senha ou clique em "Continuar com conta Google".',
    };
  }

  const existingPending = await sbRequest<DbRow[]>(
    `access_requests?email=eq.${encodeURIComponent(emailLower)}&status=eq.PENDENTE&limit=1`
  );

  const nowFormatted = formatDateTimeNow();

  if (existingPending[0]) {
    const updated = await sbRequest<DbRow[]>(
      `access_requests?id=eq.${encodeURIComponent(String(existingPending[0].id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          name: cleanName.slice(0, 120),
          role: (params.role || '').trim().slice(0, 100),
          department: (params.department || '').trim().slice(0, 100),
          reason: (params.reason || '').trim().slice(0, 500),
          date: nowFormatted,
          updated_at: new Date().toISOString(),
        },
      }
    );
    return {
      request: mapAccessRequest(updated[0]),
      message:
        'Seu pedido de acesso foi atualizado e reenviado ao Administrador da QHS Engenharia! Assim que aprovado, você poderá entrar no aplicativo.',
    };
  }

  const inserted = await sbRequest<DbRow[]>('access_requests', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      id: `acc-req-${Date.now()}`,
      org_id: ORG_ID,
      name: cleanName.slice(0, 120),
      email: emailLower.slice(0, 200),
      role: (params.role || '').trim().slice(0, 100),
      department: (params.department || '').trim().slice(0, 100),
      reason: (params.reason || '').trim().slice(0, 500),
      date: nowFormatted,
      status: 'PENDENTE',
      updated_at: new Date().toISOString(),
    },
  });

  return {
    request: mapAccessRequest(inserted[0]),
    message:
      'Pedido enviado com sucesso ao Administrador! Aguarde a aprovação e tente entrar novamente.',
  };
}

export async function approveAccessRequestSupabase(params: {
  requestId: string;
  admin: User;
  role?: string;
  department?: string;
  canDelete?: boolean;
  permissions?: Partial<UserPermissions>;
}) {
  const reqRows = await sbRequest<DbRow[]>(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError('Pedido de acesso não encontrado.', 404);
  if (reqRow.status !== 'PENDENTE') {
    throw new DomainError('Este pedido de acesso já foi analisado.', 400);
  }

  const emailLower = String(reqRow.email || '').trim().toLowerCase();
  const defaultPerms = normalizePermissions(
    params.permissions ?? {
      dashboard: true,
      produtos: true,
      entradas: false,
      saidas: true,
      colaboradores: true,
      relatorios: false,
      estatisticas: false,
      configuracoes: false,
    }
  );
  const resolvedRole = (params.role ?? String(reqRow.role || '')) || 'Operador de Estoque';
  const resolvedDepartment = params.department ?? String(reqRow.department || '');

  const existingUsers = await sbRequest<DbRow[]>(
    `users?email=eq.${encodeURIComponent(emailLower)}&limit=1`
  );

  let savedUserRow: DbRow;
  if (existingUsers[0]) {
    const updatedUsers = await sbRequest<DbRow[]>(
      `users?id=eq.${encodeURIComponent(String(existingUsers[0].id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          name: String(reqRow.name || '').trim().slice(0, 120),
          role: resolvedRole.trim().slice(0, 100),
          department: resolvedDepartment.trim().slice(0, 100),
          can_delete: Boolean(existingUsers[0].is_admin || params.canDelete),
          active: true,
          permissions: existingUsers[0].is_admin ? FULL_ADMIN_PERMISSIONS : defaultPerms,
          updated_at: new Date().toISOString(),
        },
      }
    );
    savedUserRow = updatedUsers[0];
  } else {
    const insertedUsers = await sbRequest<DbRow[]>('users', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        id: `user-${Date.now()}`,
        name: String(reqRow.name || '').trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: resolvedRole.trim().slice(0, 100),
        department: resolvedDepartment.trim().slice(0, 100),
        is_admin: false,
        can_delete: Boolean(params.canDelete),
        active: true,
        permissions: defaultPerms,
        registration_date: formatDateToday(),
        updated_at: new Date().toISOString(),
      },
    });
    savedUserRow = insertedUsers[0];
  }

  const updatedReqs = await sbRequest<DbRow[]>(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        status: 'APROVADO',
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    }
  );

  return {
    user: mapUser(savedUserRow),
    request: mapAccessRequest(updatedReqs[0]),
  };
}

export async function rejectAccessRequestSupabase(params: { requestId: string; admin: User }) {
  const reqRows = await sbRequest<DbRow[]>(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError('Pedido de acesso não encontrado.', 404);
  if (reqRow.status !== 'PENDENTE') {
    throw new DomainError('Este pedido de acesso já foi analisado.', 400);
  }

  const updated = await sbRequest<DbRow[]>(
    `access_requests?id=eq.${encodeURIComponent(params.requestId)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        status: 'RECUSADO',
        reviewed_by: params.admin.name.slice(0, 120),
        reviewed_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    }
  );
  return mapAccessRequest(updated[0]);
}

export async function createCollaboratorSupabase(params: {
  ownerUid: string;
  fullName: string;
  role?: string;
  active?: boolean;
}) {
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError('Informe o nome completo do colaborador (mínimo 2 caracteres).', 400);
  }

  const allColabs = await sbRequest<DbRow[]>('collaborators?select=id,full_name');
  if (
    allColabs.some(
      (c) => String(c.full_name || '').trim().toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    throw new DomainError(
      `Já existe um colaborador cadastrado com o nome "${trimmedName}".`,
      409
    );
  }

  const inserted = await sbRequest<DbRow[]>('collaborators', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      id: `colab-${Date.now()}`,
      org_id: ORG_ID,
      full_name: trimmedName.slice(0, 120),
      role: (params.role || '').trim().slice(0, 100),
      active: params.active ?? true,
      registration_date: formatDateToday(),
      display_updated_at: formatDateTimeNow(),
      owner_uid: params.ownerUid,
      updated_at: new Date().toISOString(),
    },
  });
  return mapCollaborator(inserted[0]);
}

export async function updateCollaboratorSupabase(params: {
  id: string;
  fullName: string;
  role?: string;
  active: boolean;
}) {
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError('Informe o nome completo do colaborador (mínimo 2 caracteres).', 400);
  }

  const allColabs = await sbRequest<DbRow[]>('collaborators?select=id,full_name');
  if (
    allColabs.some(
      (c) =>
        String(c.id) !== params.id &&
        String(c.full_name || '').trim().toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    throw new DomainError(
      `Já existe outro colaborador cadastrado com o nome "${trimmedName}".`,
      409
    );
  }

  const updated = await sbRequest<DbRow[]>(
    `collaborators?id=eq.${encodeURIComponent(params.id)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        full_name: trimmedName.slice(0, 120),
        role: (params.role || '').trim().slice(0, 100),
        active: Boolean(params.active),
        display_updated_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    }
  );
  if (!updated[0]) throw new DomainError('Colaborador não encontrado.', 404);
  return mapCollaborator(updated[0]);
}

export async function toggleCollaboratorActiveSupabase(collaboratorId: string) {
  const existing = await sbRequest<DbRow[]>(
    `collaborators?id=eq.${encodeURIComponent(collaboratorId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError('Colaborador não encontrado.', 404);

  const updated = await sbRequest<DbRow[]>(
    `collaborators?id=eq.${encodeURIComponent(collaboratorId)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        active: existing[0].active === false,
        display_updated_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    }
  );
  return mapCollaborator(updated[0]);
}

export async function deleteCollaboratorSupabase(params: {
  collaboratorId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  const targets = await sbRequest<DbRow[]>(
    `collaborators?id=eq.${encodeURIComponent(params.collaboratorId)}&limit=1`
  );
  const target = targets[0];
  if (!target) throw new DomainError('Colaborador não encontrado.', 404);

  const movRows = await sbRequest<DbRow[]>('movements?type=eq.SAIDA&select=collaborator_id,withdrawn_by');
  const fullNameLower = String(target.full_name || '').trim().toLowerCase();
  const relatedExitsCount = movRows.filter((m) =>
    m.collaborator_id
      ? String(m.collaborator_id) === String(target.id)
      : String(m.withdrawn_by || '').trim().toLowerCase() === fullNameLower
  ).length;

  await sbRequest(`collaborators?id=eq.${encodeURIComponent(params.collaboratorId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });

  const now = formatDateTimeNow();
  await sbRequest('deletion_logs', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: 'DIRETA',
      record_type: 'COLABORADOR',
      target_id: String(target.id),
      target_code: '',
      target_name: String(target.full_name),
      target_details: target.role
        ? `Função: ${target.role} · Status: ${target.active !== false ? 'Ativo' : 'Inativo'}`
        : `Colaborador de obra · Status: ${target.active !== false ? 'Ativo' : 'Inativo'}`,
      quantity: relatedExitsCount,
      reason: 'Exclusão direta por usuário autorizado',
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now,
    },
  });

  return String(target.full_name);
}

export async function createProductSupabase(
  ownerUid: string,
  prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
) {
  const inserted = await sbRequest<DbRow[]>('products', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      id: `prod-${Date.now()}`,
      org_id: ORG_ID,
      code: prodData.code.trim().slice(0, 60),
      name: prodData.name.trim().slice(0, 200),
      group_name: prodData.group.trim().slice(0, 80),
      current_stock: Math.max(0, Number(prodData.currentStock)),
      min_stock: Math.max(0, Number(prodData.minStock)),
      photo_url: (prodData.photoUrl || '').slice(0, 300000),
      description: (prodData.description || '').slice(0, 1000),
      registration_date: formatDateToday(),
      display_updated_at: formatDateTimeNow(),
      owner_uid: ownerUid,
      updated_at: new Date().toISOString(),
    },
  });
  return mapProduct(inserted[0]);
}

export async function updateProductSupabase(updatedProduct: Product) {
  const updated = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(updatedProduct.id)}`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        code: updatedProduct.code.trim().slice(0, 60),
        name: updatedProduct.name.trim().slice(0, 200),
        group_name: updatedProduct.group.trim().slice(0, 80),
        current_stock: Number(updatedProduct.currentStock),
        min_stock: Math.max(0, Number(updatedProduct.minStock)),
        photo_url: (updatedProduct.photoUrl || '').slice(0, 300000),
        description: (updatedProduct.description || '').slice(0, 1000),
        display_updated_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    }
  );
  if (!updated[0]) throw new DomainError('Produto não encontrado.', 404);
  return mapProduct(updated[0]);
}

export async function deleteProductSupabase(params: {
  productId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  const targets = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const target = targets[0];
  if (!target) throw new DomainError('Produto não encontrado.', 404);

  await sbRequest(`products?id=eq.${encodeURIComponent(params.productId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });

  const now = formatDateTimeNow();
  await sbRequest('deletion_logs', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: 'DIRETA',
      record_type: 'PRODUTO',
      target_id: String(target.id),
      target_code: String(target.code || ''),
      target_name: String(target.name || ''),
      target_details: `Grupo: ${target.group_name} · Estoque no momento da exclusão: ${target.current_stock} un`,
      quantity: Number(target.current_stock ?? 0),
      reason: 'Exclusão direta por usuário autorizado',
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now,
    },
  });

  return String(target.name);
}

export async function recordMovementSupabase(params: {
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
}) {
  const qty = Number(params.quantity);
  if (Number.isNaN(qty) || qty <= 0) {
    throw new DomainError('Quantidade deve ser maior que zero.', 400);
  }

  const prodRows = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError('Produto não encontrado.', 404);

  const currentStock = Number(prod.current_stock ?? 0);
  if (params.type === 'SAIDA' && !params.isNegativeStockAuthorized && currentStock < qty) {
    throw new DomainError(
      `Saldo insuficiente! Estoque disponível: ${currentStock} un. Necessário solicitar autorização ao Administrador.`,
      400
    );
  }
  if (params.type === 'SAIDA' && params.isNegativeStockAuthorized && !params.actor.isAdmin) {
    throw new DomainError('Somente o Administrador pode autorizar saída com saldo negativo.', 403);
  }

  let resolvedWithdrawnBy = params.withdrawnBy?.trim() || '';
  let resolvedCollaboratorId = params.collaboratorId || undefined;
  if (resolvedCollaboratorId) {
    const colabRows = await sbRequest<DbRow[]>(
      `collaborators?id=eq.${encodeURIComponent(resolvedCollaboratorId)}&limit=1`
    );
    if (colabRows[0]) {
      resolvedWithdrawnBy = String(colabRows[0].full_name || resolvedWithdrawnBy);
    } else {
      resolvedCollaboratorId = undefined;
    }
  }

  const newStock = params.type === 'ENTRADA' ? currentStock + qty : currentStock - qty;
  const formattedDate = params.date?.trim() || formatDateTimeNow();
  const movId = params.id || `mov-${Date.now()}`;

  await sbRequest('movements', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: movId,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      type: params.type,
      quantity: qty,
      stock_after_movement: newStock,
      date: formattedDate.slice(0, 30),
      withdrawn_by: resolvedWithdrawnBy ? resolvedWithdrawnBy.slice(0, 120) : null,
      collaborator_id: resolvedCollaboratorId ?? null,
      responsible_user: params.actor.name.slice(0, 120),
      destination: params.destination ? params.destination.slice(0, 150) : null,
      notes: params.notes ? params.notes.slice(0, 1000) : null,
      is_negative_stock_authorized: params.isNegativeStockAuthorized ?? null,
      authorized_by: params.authorizedBy ? params.authorizedBy.slice(0, 120) : null,
      owner_uid: params.actorUid,
    },
  });

  await sbRequest(`products?id=eq.${encodeURIComponent(String(prod.id))}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      current_stock: newStock,
      display_updated_at: formattedDate.slice(0, 30),
      updated_at: new Date().toISOString(),
    },
  });

  return { stockAfter: newStock, movId };
}

export async function deleteMovementSupabase(params: {
  movementId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  const movRows = await sbRequest<DbRow[]>(
    `movements?id=eq.${encodeURIComponent(params.movementId)}&limit=1`
  );
  const mov = movRows[0];
  if (!mov) throw new DomainError('Movimentação não encontrada.', 404);

  const movType: 'ENTRADA' | 'SAIDA' = mov.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
  const qty = Number(mov.quantity ?? 0);
  let productUpdated = false;
  let newStock: number | undefined;

  const prodRows = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(String(mov.product_id))}&limit=1`
  );
  if (prodRows[0]) {
    const currentStock = Number(prodRows[0].current_stock ?? 0);
    newStock = movType === 'ENTRADA' ? currentStock - qty : currentStock + qty;
    await sbRequest(`products?id=eq.${encodeURIComponent(String(mov.product_id))}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        current_stock: newStock,
        display_updated_at: formatDateTimeNow(),
        updated_at: new Date().toISOString(),
      },
    });
    productUpdated = true;
  }

  await sbRequest(`movements?id=eq.${encodeURIComponent(params.movementId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });

  const now = formatDateTimeNow();
  await sbRequest('deletion_logs', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: 'DIRETA',
      record_type: movType,
      target_id: String(mov.id),
      target_code: String(mov.product_code || ''),
      target_name: String(mov.product_name || ''),
      target_details: `${movType === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada em ${mov.date}${mov.destination ? ` · Obra: ${mov.destination}` : ''}${mov.withdrawn_by ? ` · Retirada: ${mov.withdrawn_by}` : ''}`,
      quantity: qty,
      reason: 'Exclusão direta por usuário autorizado',
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now,
    },
  });

  return { productUpdated, newStock };
}

export async function createNegativeRequestSupabase(params: {
  id?: string;
  productId: string;
  requestedQuantity: number;
  withdrawnBy: string;
  collaboratorId?: string;
  destination: string;
  reason: string;
  actor: User;
  actorUid: string;
}) {
  const prodRows = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(params.productId)}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError('Produto não encontrado.', 404);

  let resolvedWithdrawnBy = params.withdrawnBy.trim();
  let resolvedCollaboratorId = params.collaboratorId || undefined;
  if (resolvedCollaboratorId) {
    const colabRows = await sbRequest<DbRow[]>(
      `collaborators?id=eq.${encodeURIComponent(resolvedCollaboratorId)}&limit=1`
    );
    if (colabRows[0]) {
      resolvedWithdrawnBy = String(colabRows[0].full_name || resolvedWithdrawnBy);
    } else {
      resolvedCollaboratorId = undefined;
    }
  }

  const reqId = params.id || `req-neg-${Date.now()}`;
  const availableStock = Number(prod.current_stock ?? 0);
  const deficit = Math.max(0, Number(params.requestedQuantity) - availableStock);

  await sbRequest('negative_requests', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: reqId,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      requested_quantity: Number(params.requestedQuantity),
      available_stock: availableStock,
      deficit_quantity: deficit,
      withdrawn_by: resolvedWithdrawnBy.slice(0, 120),
      collaborator_id: resolvedCollaboratorId ?? null,
      destination: params.destination.slice(0, 150),
      requested_by: params.actor.name.slice(0, 120),
      requested_by_uid: params.actorUid,
      reason: (params.reason || 'Necessidade operacional urgente.').slice(0, 1000),
      date: formatDateTimeNow(),
      status: 'PENDENTE',
      updated_at: new Date().toISOString(),
    },
  });

  return { reqId };
}

export async function approveNegativeRequestSupabase(params: {
  requestId: string;
  admin: User;
  adminUid: string;
}) {
  const reqRows = await sbRequest<DbRow[]>(
    `negative_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError('Solicitação não encontrada.', 404);
  if (reqRow.status !== 'PENDENTE') {
    throw new DomainError('Solicitação já analisada anteriormente.', 400);
  }

  const prodRows = await sbRequest<DbRow[]>(
    `products?id=eq.${encodeURIComponent(String(reqRow.product_id))}&limit=1`
  );
  const prod = prodRows[0];
  if (!prod) throw new DomainError('Produto não encontrado.', 404);

  const newStock = Number(prod.current_stock ?? 0) - Number(reqRow.requested_quantity ?? 0);
  const formattedDate = formatDateTimeNow();

  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      status: 'APROVADO',
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_at: formattedDate,
      updated_at: new Date().toISOString(),
    },
  });

  await sbRequest('movements', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `mov-${Date.now()}`,
      org_id: ORG_ID,
      product_id: String(prod.id),
      product_code: String(prod.code),
      product_name: String(prod.name),
      group_name: String(prod.group_name),
      type: 'SAIDA',
      quantity: Number(reqRow.requested_quantity),
      stock_after_movement: newStock,
      date: formattedDate,
      withdrawn_by: String(reqRow.withdrawn_by || ''),
      collaborator_id: reqRow.collaborator_id ?? null,
      responsible_user: params.admin.name.slice(0, 120),
      destination: String(reqRow.destination || ''),
      notes: `[AUTORIZAÇÃO EXCEPCIONAL ADMINISTRADOR: ${params.admin.name}] Motivo: ${reqRow.reason}`.slice(
        0,
        1000
      ),
      is_negative_stock_authorized: true,
      authorized_by: params.admin.name.slice(0, 120),
      owner_uid: params.adminUid,
    },
  });

  await sbRequest(`products?id=eq.${encodeURIComponent(String(prod.id))}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      current_stock: newStock,
      display_updated_at: formattedDate,
      updated_at: new Date().toISOString(),
    },
  });

  return { newStock, productName: String(prod.name) };
}

export async function rejectNegativeRequestSupabase(requestId: string, adminName: string) {
  const existing = await sbRequest<DbRow[]>(
    `negative_requests?id=eq.${encodeURIComponent(requestId)}&limit=1`
  );
  if (!existing[0]) throw new DomainError('Solicitação não encontrada.', 404);

  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      status: 'RECUSADO',
      reviewed_by: adminName.slice(0, 120),
      reviewed_at: formatDateTimeNow(),
      updated_at: new Date().toISOString(),
    },
  });
}

export async function deleteNegativeRequestSupabase(params: {
  requestId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  const reqRows = await sbRequest<DbRow[]>(
    `negative_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const target = reqRows[0];
  if (!target) throw new DomainError('Solicitação não encontrada.', 404);

  await sbRequest(`negative_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });

  const now = formatDateTimeNow();
  await sbRequest('deletion_logs', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: 'DIRETA',
      record_type: 'SOLICITACAO_NEGATIVA',
      target_id: String(target.id),
      target_code: String(target.product_code || ''),
      target_name: String(target.product_name || ''),
      target_details: `Retirada: ${target.withdrawn_by} · Obra: ${target.destination}`,
      quantity: Number(target.requested_quantity ?? 0),
      reason: 'Exclusão direta por usuário autorizado',
      requested_by: params.actor.name,
      requested_by_date: now,
      deleted_by: params.actor.name,
      deleted_by_email: params.actorEmail.toLowerCase(),
      deleted_by_uid: params.actorUid,
      deleted_at: now,
    },
  });
}

export async function createDeletionRequestSupabase(params: {
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
}) {
  const trimmedReason = params.reason.trim();
  if (trimmedReason.length < 3) {
    throw new DomainError(
      'Informe uma justificativa com pelo menos 3 caracteres explicando o motivo da exclusão.',
      400
    );
  }

  const existingPending = await sbRequest<DbRow[]>(
    `deletion_requests?target_id=eq.${encodeURIComponent(params.targetId)}&requested_by_uid=eq.${encodeURIComponent(params.actorUid)}&status=eq.PENDENTE&limit=1`
  );
  if (existingPending[0]) {
    throw new DomainError(
      'Já existe uma solicitação de exclusão pendente aguardando aprovação para este registro.',
      409
    );
  }

  const reqId = `del-req-${Date.now()}`;
  await sbRequest('deletion_requests', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: reqId,
      org_id: ORG_ID,
      record_type: params.recordType,
      target_id: params.targetId,
      target_code: params.targetCode.slice(0, 60),
      target_name: params.targetName.slice(0, 200),
      target_details: params.targetDetails.slice(0, 400),
      quantity: Number(params.quantity),
      reason: trimmedReason.slice(0, 1000),
      requested_by: params.actor.name.slice(0, 120),
      requested_by_email: params.actorEmail.toLowerCase().slice(0, 200),
      requested_by_uid: params.actorUid,
      date: formatDateTimeNow(),
      status: 'PENDENTE',
      updated_at: new Date().toISOString(),
    },
  });

  return { reqId };
}

export async function approveDeletionRequestSupabase(params: {
  requestId: string;
  admin: User;
  adminEmail: string;
  adminUid: string;
}) {
  const reqRows = await sbRequest<DbRow[]>(
    `deletion_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError('Solicitação de exclusão não encontrada.', 404);
  if (reqRow.status !== 'PENDENTE') {
    throw new DomainError('Esta solicitação já foi analisada anteriormente.', 400);
  }

  const targetId = String(reqRow.target_id);
  const recordType = toRecordType(reqRow.record_type);
  let stockNote = '';

  if (recordType === 'PRODUTO') {
    await sbRequest(`products?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  } else if (recordType === 'ENTRADA' || recordType === 'SAIDA') {
    const movRows = await sbRequest<DbRow[]>(`movements?id=eq.${encodeURIComponent(targetId)}&limit=1`);
    const mov = movRows[0];
    if (mov) {
      const prodRows = await sbRequest<DbRow[]>(
        `products?id=eq.${encodeURIComponent(String(mov.product_id))}&limit=1`
      );
      if (prodRows[0]) {
        const currentStock = Number(prodRows[0].current_stock ?? 0);
        const qty = Number(mov.quantity ?? 0);
        const newStock = mov.type === 'ENTRADA' ? currentStock - qty : currentStock + qty;
        await sbRequest(`products?id=eq.${encodeURIComponent(String(mov.product_id))}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: {
            current_stock: newStock,
            display_updated_at: formatDateTimeNow(),
            updated_at: new Date().toISOString(),
          },
        });
        stockNote = ` Estoque atualizado de "${reqRow.target_name}": ${newStock} un.`;
      }
      await sbRequest(`movements?id=eq.${encodeURIComponent(String(mov.id))}`, {
        method: 'DELETE',
        prefer: 'return=minimal',
      });
    }
  } else if (recordType === 'SOLICITACAO_NEGATIVA') {
    await sbRequest(`negative_requests?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  } else if (recordType === 'COLABORADOR') {
    await sbRequest(`collaborators?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
  }

  const now = formatDateTimeNow();
  await sbRequest(`deletion_requests?id=eq.${encodeURIComponent(String(reqRow.id))}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      status: 'APROVADO',
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      reviewed_at: now,
      executed_by: params.admin.name.slice(0, 120),
      executed_at: now,
      updated_at: new Date().toISOString(),
    },
  });

  await sbRequest('deletion_logs', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      id: `del-log-${Date.now()}`,
      org_id: ORG_ID,
      origin: 'APROVADA',
      request_id: String(reqRow.id),
      record_type: recordType,
      target_id: targetId,
      target_code: String(reqRow.target_code || ''),
      target_name: String(reqRow.target_name || ''),
      target_details: String(reqRow.target_details || ''),
      quantity: Number(reqRow.quantity ?? 0),
      reason: String(reqRow.reason || ''),
      requested_by: String(reqRow.requested_by || ''),
      requested_by_date: String(reqRow.date || ''),
      approved_by: params.admin.name.slice(0, 120),
      approved_at: now,
      deleted_by: params.admin.name.slice(0, 120),
      deleted_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      deleted_by_uid: params.adminUid,
      deleted_at: now,
    },
  });

  return { targetName: String(reqRow.target_name || ''), stockNote };
}

export async function rejectDeletionRequestSupabase(params: {
  requestId: string;
  admin: User;
  adminEmail: string;
}) {
  const reqRows = await sbRequest<DbRow[]>(
    `deletion_requests?id=eq.${encodeURIComponent(params.requestId)}&limit=1`
  );
  const reqRow = reqRows[0];
  if (!reqRow) throw new DomainError('Solicitação de exclusão não encontrada.', 404);
  if (reqRow.status !== 'PENDENTE') {
    throw new DomainError('Esta solicitação já foi analisada anteriormente.', 400);
  }

  await sbRequest(`deletion_requests?id=eq.${encodeURIComponent(params.requestId)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      status: 'RECUSADO',
      reviewed_by: params.admin.name.slice(0, 120),
      reviewed_by_email: params.adminEmail.toLowerCase().slice(0, 200),
      reviewed_at: formatDateTimeNow(),
      updated_at: new Date().toISOString(),
    },
  });

  return { targetName: String(reqRow.target_name || '') };
}

export async function resetAllDataSupabase(
  adminUid: string,
  adminEmail: string,
  adminName: string
) {
  await sbRequest('movements?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('negative_requests?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('deletion_requests?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('deletion_logs?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('access_requests?id=not.is.null', {
    method: 'DELETE',
    prefer: 'return=minimal',
    ignoreMissingTable: true,
  });
  await sbRequest('collaborators?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('products?id=not.is.null', { method: 'DELETE', prefer: 'return=minimal' });
  await sbRequest('users?id=neq.user-owner', { method: 'DELETE', prefer: 'return=minimal' });

  await sbRequest('managed_lists?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      id: 'global',
      groups: INITIAL_LISTS.groups,
      roles: INITIAL_LISTS.roles,
      destinations: INITIAL_LISTS.destinations,
      updated_at: new Date().toISOString(),
    },
  });

  await sbRequest('system_settings?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      id: 'global',
      show_product_photos: INITIAL_SETTINGS.showProductPhotos,
      company_name: INITIAL_SETTINGS.companyName,
      company_subtitle: INITIAL_SETTINGS.companySubtitle,
      cnpj: INITIAL_SETTINGS.cnpj,
      contact_email: INITIAL_SETTINGS.contactEmail,
      low_stock_alert_notification: INITIAL_SETTINGS.lowStockAlertNotification,
      updated_at: new Date().toISOString(),
    },
  });

  await sbRequest('users?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      id: 'user-owner',
      uid: adminUid,
      name: adminName.slice(0, 120),
      email: adminEmail.toLowerCase(),
      role: 'Diretor de Engenharia & Admin',
      department: 'Diretoria Técnica',
      is_admin: true,
      can_delete: true,
      active: true,
      permissions: FULL_ADMIN_PERMISSIONS,
      registration_date: formatDateToday(),
      updated_at: new Date().toISOString(),
    },
  });
}
