import { and, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';
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
  deleteCollaboratorFromSupabase,
  deleteMovementFromSupabase,
  deleteNegativeRequestFromSupabase,
  deleteProductFromSupabase,
  deleteUserFromSupabase,
  ensureInitialSupabaseSync,
  pullFromSupabaseToCloudSql,
  syncAccessRequestToSupabase,
  syncCollaboratorToSupabase,
  syncDeletionLogToSupabase,
  syncDeletionRequestToSupabase,
  syncManagedListsToSupabase,
  syncMovementsToSupabase,
  syncMovementToSupabase,
  syncNegativeRequestToSupabase,
  syncProductsToSupabase,
  syncProductToSupabase,
  syncResetAllToSupabase,
  syncSystemSettingsToSupabase,
  syncUsersToSupabase,
  syncUserToSupabase,
} from '../lib/supabase-sync.ts';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DomainError,
  FULL_ADMIN_PERMISSIONS,
  ORG_ID,
  formatDateTimeNow,
  formatDateToday,
  isSqlDatabaseConfigured,
  normalizePermissions,
} from './shared.ts';
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
  updateDestinationsSupabase,
  updateManagedListsSupabase,
  updateProductSupabase,
  updateSystemSettingsSupabase,
  updateUserDeletePermissionSupabase,
  updateUserPermissionsSupabase,
  updateUserSupabase,
} from './supabaseRepository.ts';

export {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DomainError,
  ORG_ID,
  formatDateTimeNow,
  formatDateToday,
  normalizePermissions,
};

function mapUserRow(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    isAdmin: row.isAdmin,
    canDelete: Boolean(row.isAdmin || row.canDelete),
    permissions: normalizePermissions(row.permissions),
    active: row.active,
    createdAt: row.registrationDate,
  };
}

function mapCollaboratorRow(row: typeof collaborators.$inferSelect): Collaborator {
  return {
    id: row.id,
    fullName: row.fullName,
    role: row.role || '',
    active: row.active,
    createdAt: row.registrationDate,
    updatedAt: row.displayUpdatedAt,
  };
}

function mapProductRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    group: row.groupName,
    currentStock: Number(row.currentStock),
    minStock: Number(row.minStock),
    photoUrl: row.photoUrl || '',
    description: row.description || '',
    createdAt: row.registrationDate,
    updatedAt: row.displayUpdatedAt,
  };
}

function mapMovementRow(row: typeof movements.$inferSelect): StockMovement {
  return {
    id: row.id,
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    group: row.groupName,
    type: row.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA',
    quantity: Number(row.quantity),
    stockAfterMovement: Number(row.stockAfterMovement),
    date: row.date,
    withdrawnBy: row.withdrawnBy ?? undefined,
    collaboratorId: row.collaboratorId ?? undefined,
    responsibleUser: row.responsibleUser,
    destination: row.destination ?? undefined,
    notes: row.notes ?? undefined,
    isNegativeStockAuthorized:
      row.isNegativeStockAuthorized !== null ? Boolean(row.isNegativeStockAuthorized) : undefined,
    authorizedBy: row.authorizedBy ?? undefined,
  };
}

function mapNegativeRequestRow(row: typeof negativeRequests.$inferSelect): NegativeStockRequest {
  return {
    id: row.id,
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    group: row.groupName,
    requestedQuantity: Number(row.requestedQuantity),
    availableStock: Number(row.availableStock),
    deficitQuantity: Number(row.deficitQuantity),
    withdrawnBy: row.withdrawnBy,
    collaboratorId: row.collaboratorId ?? undefined,
    destination: row.destination,
    requestedBy: row.requestedBy,
    reason: row.reason,
    date: row.date,
    status:
      row.status === 'APROVADO'
        ? 'APROVADO'
        : row.status === 'RECUSADO'
        ? 'RECUSADO'
        : 'PENDENTE',
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
  };
}

function mapDeletionRequestRow(row: typeof deletionRequests.$inferSelect): DeletionRequest {
  const rt = row.recordType;
  const recordType: DeletionRecordType =
    rt === 'PRODUTO' ||
    rt === 'ENTRADA' ||
    rt === 'SAIDA' ||
    rt === 'SOLICITACAO_NEGATIVA' ||
    rt === 'COLABORADOR'
      ? rt
      : 'PRODUTO';

  return {
    id: row.id,
    recordType,
    targetId: row.targetId,
    targetCode: row.targetCode,
    targetName: row.targetName,
    targetDetails: row.targetDetails,
    quantity: Number(row.quantity),
    reason: row.reason,
    requestedBy: row.requestedBy,
    requestedByEmail: row.requestedByEmail,
    requestedByUid: row.requestedByUid,
    date: row.date,
    status:
      row.status === 'APROVADO'
        ? 'APROVADO'
        : row.status === 'RECUSADO'
        ? 'RECUSADO'
        : 'PENDENTE',
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedByEmail: row.reviewedByEmail ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    executedBy: row.executedBy ?? undefined,
    executedAt: row.executedAt ?? undefined,
  };
}

function mapDeletionLogRow(row: typeof deletionLogs.$inferSelect): DeletionLog {
  const rt = row.recordType;
  const recordType: DeletionRecordType =
    rt === 'PRODUTO' ||
    rt === 'ENTRADA' ||
    rt === 'SAIDA' ||
    rt === 'SOLICITACAO_NEGATIVA' ||
    rt === 'COLABORADOR'
      ? rt
      : 'PRODUTO';

  return {
    id: row.id,
    origin: row.origin === 'APROVADA' ? 'APROVADA' : 'DIRETA',
    requestId: row.requestId ?? undefined,
    recordType,
    targetId: row.targetId,
    targetCode: row.targetCode,
    targetName: row.targetName,
    targetDetails: row.targetDetails,
    quantity: Number(row.quantity),
    reason: row.reason,
    requestedBy: row.requestedBy,
    requestedByDate: row.requestedByDate,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    deletedBy: row.deletedBy,
    deletedByEmail: row.deletedByEmail,
    deletedByUid: row.deletedByUid,
    deletedAt: row.deletedAt,
  };
}

function mapAccessRequestRow(row: typeof accessRequests.$inferSelect): AccessRequest {
  const status: AccessRequestStatus =
    row.status === 'APROVADO'
      ? 'APROVADO'
      : row.status === 'RECUSADO'
      ? 'RECUSADO'
      : 'PENDENTE';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || '',
    department: row.department || '',
    reason: row.reason || '',
    date: row.date,
    status,
    reviewedBy: row.reviewedBy ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
  };
}

async function ensureDefaultsSeeded() {
  await db
    .insert(systemSettings)
    .values({
      id: 'global',
      showProductPhotos: INITIAL_SETTINGS.showProductPhotos,
      companyName: INITIAL_SETTINGS.companyName,
      companySubtitle: INITIAL_SETTINGS.companySubtitle,
      cnpj: INITIAL_SETTINGS.cnpj,
      contactEmail: INITIAL_SETTINGS.contactEmail,
      lowStockAlertNotification: INITIAL_SETTINGS.lowStockAlertNotification,
    })
    .onConflictDoNothing({ target: systemSettings.id });

  await db
    .insert(managedLists)
    .values({
      id: 'global',
      groups: INITIAL_LISTS.groups,
      roles: INITIAL_LISTS.roles,
      destinations: INITIAL_LISTS.destinations,
    })
    .onConflictDoNothing({ target: managedLists.id });
}

export async function checkEmailInvitationStatus(email: string): Promise<{
  authorized: boolean;
  alreadyActivated: boolean;
  message?: string;
}> {
  if (!isSqlDatabaseConfigured()) {
    return checkEmailInvitationStatusSupabase(email);
  }
  const emailLower = email.trim().toLowerCase();
  if (!emailLower || !emailLower.includes('@')) {
    return {
      authorized: false,
      alreadyActivated: false,
      message: 'Informe um endereço de e-mail válido.',
    };
  }

  try {
    await ensureDefaultsSeeded();
    await ensureInitialSupabaseSync();
    await pullFromSupabaseToCloudSql();

    if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      const ownerRows = await db
        .select({ uid: users.uid })
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);
      return {
        authorized: true,
        alreadyActivated: Boolean(ownerRows[0]?.uid),
      };
    }

    const found = await db
      .select({ id: users.id, active: users.active, uid: users.uid })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (!found[0]) {
      return {
        authorized: false,
        alreadyActivated: false,
        message: `O e-mail ${email.trim()} ainda não foi autorizado pelo Administrador da QHS Engenharia.`,
      };
    }

    if (!found[0].active) {
      return {
        authorized: false,
        alreadyActivated: Boolean(found[0].uid),
        message:
          'Este e-mail está inativo no sistema. Contate o Administrador da QHS Engenharia.',
      };
    }

    return {
      authorized: true,
      alreadyActivated: Boolean(found[0].uid),
    };
  } catch (error) {
    console.error('Database query failed in checkEmailInvitationStatus:', error);
    throw new Error('Falha ao verificar autorização do e-mail.', { cause: error });
  }
}

export async function resolveAuthenticatedUser(params: {
  uid: string;
  email: string;
  displayName?: string;
}): Promise<{ authorized: boolean; isRealAdmin: boolean; user?: User; errorMessage?: string }> {
  if (!isSqlDatabaseConfigured()) {
    return resolveAuthenticatedUserSupabase(params);
  }
  const emailLower = params.email.trim().toLowerCase();
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  try {
    await ensureDefaultsSeeded();
    await ensureInitialSupabaseSync();
    await pullFromSupabaseToCloudSql();

    if (isBootstrapped) {
      const today = formatDateToday();
      const upserted = await db
        .insert(users)
        .values({
          id: 'user-owner',
          uid: params.uid,
          name: (params.displayName || 'Welisson Oliveira').slice(0, 120),
          email: emailLower,
          role: 'Diretor de Engenharia & Admin',
          department: 'Diretoria Técnica',
          isAdmin: true,
          canDelete: true,
          active: true,
          permissions: FULL_ADMIN_PERMISSIONS,
          registrationDate: today,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            uid: params.uid,
            isAdmin: true,
            canDelete: true,
            active: true,
            permissions: FULL_ADMIN_PERMISSIONS,
            updatedAt: new Date(),
          },
        })
        .returning();

      await syncUserToSupabase(upserted[0]);

      return {
        authorized: true,
        isRealAdmin: true,
        user: mapUserRow(upserted[0]),
      };
    }

    const foundByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    const userRow = foundByEmail[0];
    if (!userRow) {
      return {
        authorized: false,
        isRealAdmin: false,
        errorMessage: `O e-mail ${params.email} ainda não foi autorizado no sistema da QHS Engenharia.`,
      };
    }

    if (!userRow.active) {
      return {
        authorized: false,
        isRealAdmin: false,
        errorMessage:
          'Seu cadastro está inativo no momento. Contate o Administrador da QHS Engenharia.',
      };
    }

    if (userRow.uid !== params.uid) {
      const updated = await db
        .update(users)
        .set({ uid: params.uid, updatedAt: new Date() })
        .where(eq(users.id, userRow.id))
        .returning();
      await syncUserToSupabase(updated[0]);
      return {
        authorized: true,
        isRealAdmin: Boolean(updated[0].isAdmin),
        user: mapUserRow(updated[0]),
      };
    }

    return {
      authorized: true,
      isRealAdmin: Boolean(userRow.isAdmin),
      user: mapUserRow(userRow),
    };
  } catch (error) {
    console.error('Database query failed in resolveAuthenticatedUser:', error);
    throw new Error('Falha ao autenticar usuário no banco de dados.', { cause: error });
  }
}

export async function getBootstrapData(currentUser: User, uid: string, forceSync = false) {
  if (!isSqlDatabaseConfigured()) {
    return getBootstrapDataSupabase(currentUser, uid);
  }
  try {
    await ensureDefaultsSeeded();
    await ensureInitialSupabaseSync();
    await pullFromSupabaseToCloudSql({ force: forceSync });

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
      db.select().from(users),
      db.select().from(collaborators),
      db.select().from(products),
      db.select().from(movements),
      db.select().from(negativeRequests),
      currentUser.isAdmin
        ? db.select().from(deletionRequests)
        : db
            .select()
            .from(deletionRequests)
            .where(eq(deletionRequests.requestedByUid, uid)),
      currentUser.isAdmin ? db.select().from(deletionLogs) : Promise.resolve([]),
      currentUser.isAdmin ? db.select().from(accessRequests) : Promise.resolve([]),
      db.select().from(managedLists).where(eq(managedLists.id, 'global')).limit(1),
      db.select().from(systemSettings).where(eq(systemSettings.id, 'global')).limit(1),
    ]);

    const mappedUsers = allUsersRows.map(mapUserRow);
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

    const mappedCollaborators = collabRows
      .map(mapCollaboratorRow)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));

    const mappedProducts = prodRows
      .map(mapProductRow)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const mappedMovements = movRows
      .map(mapMovementRow)
      .sort((a, b) => b.date.localeCompare(a.date));

    const mappedNegRequests = negRows
      .map(mapNegativeRequestRow)
      .sort((a, b) => b.date.localeCompare(a.date));

    const mappedDelRequests = delReqRows
      .map(mapDeletionRequestRow)
      .sort((a, b) => b.date.localeCompare(a.date));

    const mappedDelLogs = delLogRows
      .map(mapDeletionLogRow)
      .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

    const mappedAccessRequests = accessReqRows
      .map(mapAccessRequestRow)
      .sort((a, b) => b.date.localeCompare(a.date));

    const lists: ManagedLists = listsRows[0]
      ? {
          groups: Array.isArray(listsRows[0].groups) ? listsRows[0].groups : INITIAL_LISTS.groups,
          roles: Array.isArray(listsRows[0].roles) ? listsRows[0].roles : INITIAL_LISTS.roles,
          destinations: Array.isArray(listsRows[0].destinations)
            ? listsRows[0].destinations
            : INITIAL_LISTS.destinations,
        }
      : INITIAL_LISTS;

    const settings: SystemSettings = settingsRows[0]
      ? {
          showProductPhotos: settingsRows[0].showProductPhotos,
          companyName: settingsRows[0].companyName,
          companySubtitle: settingsRows[0].companySubtitle,
          cnpj: settingsRows[0].cnpj,
          contactEmail: settingsRows[0].contactEmail,
          lowStockAlertNotification: settingsRows[0].lowStockAlertNotification,
        }
      : INITIAL_SETTINGS;

    return {
      currentUser,
      users: visibleUsers,
      collaborators: mappedCollaborators,
      products: mappedProducts,
      movements: mappedMovements,
      negativeRequests: mappedNegRequests,
      deletionRequests: mappedDelRequests,
      deletionLogs: mappedDelLogs,
      accessRequests: mappedAccessRequests,
      managedLists: lists,
      settings,
    };
  } catch (error) {
    console.error('Database query failed in getBootstrapData:', error);
    throw new Error('Falha ao carregar dados do banco de dados.', { cause: error });
  }
}

export async function updateSystemSettingsInDb(newSettings: Partial<SystemSettings>) {
  if (!isSqlDatabaseConfigured()) {
    return updateSystemSettingsSupabase(newSettings);
  }
  try {
    await ensureDefaultsSeeded();
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (newSettings.showProductPhotos !== undefined) {
      updatePayload.showProductPhotos = Boolean(newSettings.showProductPhotos);
    }
    if (newSettings.companyName !== undefined) {
      updatePayload.companyName = newSettings.companyName.trim().slice(0, 120);
    }
    if (newSettings.companySubtitle !== undefined) {
      updatePayload.companySubtitle = newSettings.companySubtitle.trim().slice(0, 200);
    }
    if (newSettings.cnpj !== undefined) {
      updatePayload.cnpj = newSettings.cnpj.trim().slice(0, 30);
    }
    if (newSettings.contactEmail !== undefined) {
      updatePayload.contactEmail = newSettings.contactEmail.trim().slice(0, 150);
    }
    if (newSettings.lowStockAlertNotification !== undefined) {
      updatePayload.lowStockAlertNotification = Boolean(newSettings.lowStockAlertNotification);
    }

    const updatedSettings = await db
      .update(systemSettings)
      .set(updatePayload)
      .where(eq(systemSettings.id, 'global'))
      .returning();

    await syncSystemSettingsToSupabase(updatedSettings[0]);
  } catch (error) {
    console.error('Database query failed in updateSystemSettingsInDb:', error);
    throw new Error('Falha ao atualizar configurações no banco de dados.', { cause: error });
  }
}

export async function updateManagedListsInDb(params: {
  lists: ManagedLists;
  renameGroup?: { oldName: string; newName: string };
  renameRole?: { oldName: string; newName: string };
}) {
  if (!isSqlDatabaseConfigured()) {
    return updateManagedListsSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const updatedLists = await tx
        .update(managedLists)
        .set({
          groups: params.lists.groups.slice(0, 100),
          roles: params.lists.roles.slice(0, 100),
          destinations: params.lists.destinations.slice(0, 150),
          updatedAt: new Date(),
        })
        .where(eq(managedLists.id, 'global'))
        .returning();

      let updatedProducts: (typeof products.$inferSelect)[] = [];
      let updatedMovements: (typeof movements.$inferSelect)[] = [];
      let updatedUsers: (typeof users.$inferSelect)[] = [];

      if (params.renameGroup) {
        const { oldName, newName } = params.renameGroup;
        updatedProducts = await tx
          .update(products)
          .set({ groupName: newName, updatedAt: new Date() })
          .where(eq(products.groupName, oldName))
          .returning();
        updatedMovements = await tx
          .update(movements)
          .set({ groupName: newName })
          .where(eq(movements.groupName, oldName))
          .returning();
      }

      if (params.renameRole) {
        const { oldName, newName } = params.renameRole;
        updatedUsers = await tx
          .update(users)
          .set({ role: newName, updatedAt: new Date() })
          .where(eq(users.role, oldName))
          .returning();
      }

      return {
        listsRow: updatedLists[0],
        updatedProducts,
        updatedMovements,
        updatedUsers,
      };
    });

    await syncManagedListsToSupabase(result.listsRow);
    await syncProductsToSupabase(result.updatedProducts);
    await syncMovementsToSupabase(result.updatedMovements);
    await syncUsersToSupabase(result.updatedUsers);
  } catch (error) {
    console.error('Database query failed in updateManagedListsInDb:', error);
    throw new Error('Falha ao atualizar listas gerenciáveis.', { cause: error });
  }
}

export async function updateDestinationsInDb(destinations: string[]) {
  if (!isSqlDatabaseConfigured()) {
    return updateDestinationsSupabase(destinations);
  }
  const cleanDestinations = destinations
    .map((d) => String(d || '').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 150);
  try {
    await ensureDefaultsSeeded();
    const updatedLists = await db
      .update(managedLists)
      .set({
        destinations: cleanDestinations,
        updatedAt: new Date(),
      })
      .where(eq(managedLists.id, 'global'))
      .returning();

    await syncManagedListsToSupabase(updatedLists[0]);
  } catch (error) {
    console.error('Database query failed in updateDestinationsInDb:', error);
    throw new Error('Falha ao atualizar clientes e locais de destino.', { cause: error });
  }
}

export async function createUserInDb(newUser: Omit<User, 'id' | 'createdAt'>) {
  if (!isSqlDatabaseConfigured()) {
    return createUserSupabase(newUser);
  }
  const emailLower = newUser.email.trim().toLowerCase();
  if (!emailLower || !newUser.name.trim()) {
    throw new DomainError('Nome e e-mail do usuário são obrigatórios.', 400);
  }
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);
    if (existing[0]) {
      throw new DomainError('Já existe um usuário cadastrado com este e-mail.', 409);
    }

    const id = `user-${Date.now()}`;
    const today = formatDateToday();
    const inserted = await db
      .insert(users)
      .values({
        id,
        name: newUser.name.trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: newUser.role.trim().slice(0, 100),
        department: (newUser.department || '').trim().slice(0, 100),
        isAdmin: Boolean(newUser.isAdmin),
        canDelete: Boolean(newUser.isAdmin || newUser.canDelete),
        active: Boolean(newUser.active),
        permissions: normalizePermissions(newUser.permissions),
        registrationDate: today,
      })
      .returning();

    await syncUserToSupabase(inserted[0]);
    return mapUserRow(inserted[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    const msg = error instanceof Error ? error.message : String(error || '');
    if (msg.includes('users_email_key') || msg.includes('23505')) {
      throw new DomainError('Já existe um usuário cadastrado com este e-mail.', 409);
    }
    console.error('Database query failed in createUserInDb:', error);
    throw new Error('Falha ao cadastrar usuário no banco de dados.', { cause: error });
  }
}

export async function updateUserInDb(updatedUser: User) {
  if (!isSqlDatabaseConfigured()) {
    return updateUserSupabase(updatedUser);
  }
  const emailLower = updatedUser.email.trim().toLowerCase();
  try {
    const duplicate = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== updatedUser.id) {
      throw new DomainError('Já existe outro usuário cadastrado com este e-mail.', 409);
    }

    const updated = await db
      .update(users)
      .set({
        name: updatedUser.name.trim().slice(0, 120),
        email: emailLower.slice(0, 200),
        role: updatedUser.role.trim().slice(0, 100),
        department: (updatedUser.department || '').trim().slice(0, 100),
        isAdmin: Boolean(updatedUser.isAdmin),
        canDelete: Boolean(updatedUser.isAdmin || updatedUser.canDelete),
        active: Boolean(updatedUser.active),
        permissions: normalizePermissions(updatedUser.permissions),
        updatedAt: new Date(),
      })
      .where(eq(users.id, updatedUser.id))
      .returning();

    if (!updated[0]) {
      throw new DomainError('Usuário não encontrado.', 404);
    }
    await syncUserToSupabase(updated[0]);
    return mapUserRow(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    const msg = error instanceof Error ? error.message : String(error || '');
    if (msg.includes('users_email_key') || msg.includes('23505')) {
      throw new DomainError('Já existe outro usuário cadastrado com este e-mail.', 409);
    }
    console.error('Database query failed in updateUserInDb:', error);
    throw new Error('Falha ao atualizar usuário no banco de dados.', { cause: error });
  }
}

export async function updateUserPermissionsInDb(userId: string, permissions: UserPermissions) {
  if (!isSqlDatabaseConfigured()) {
    return updateUserPermissionsSupabase(userId, permissions);
  }
  try {
    const updated = await db
      .update(users)
      .set({ permissions: normalizePermissions(permissions), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    await syncUserToSupabase(updated[0]);
  } catch (error) {
    console.error('Database query failed in updateUserPermissionsInDb:', error);
    throw new Error('Falha ao atualizar permissões.', { cause: error });
  }
}

export async function updateUserDeletePermissionInDb(userId: string, canDelete: boolean) {
  if (!isSqlDatabaseConfigured()) {
    return updateUserDeletePermissionSupabase(userId, canDelete);
  }
  try {
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing[0]) throw new DomainError('Usuário não encontrado.', 404);
    if (existing[0].isAdmin) {
      throw new DomainError('O Administrador principal sempre possui permissão total.', 400);
    }
    const updated = await db
      .update(users)
      .set({ canDelete: Boolean(canDelete), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    await syncUserToSupabase(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in updateUserDeletePermissionInDb:', error);
    throw new Error('Falha ao atualizar permissão de exclusão.', { cause: error });
  }
}

export async function deleteUserInDb(userId: string) {
  if (!isSqlDatabaseConfigured()) {
    return deleteUserSupabase(userId);
  }
  if (userId === 'user-owner') {
    throw new DomainError('Não é permitido excluir o Administrador principal.', 400);
  }
  try {
    const existing = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    await db.delete(users).where(eq(users.id, userId));
    await deleteUserFromSupabase(userId, existing[0]?.email);
  } catch (error) {
    console.error('Database query failed in deleteUserInDb:', error);
    throw new Error('Falha ao excluir usuário.', { cause: error });
  }
}

export async function createAccessRequestInDb(params: {
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
  if (!isSqlDatabaseConfigured()) {
    return createAccessRequestSupabase(params);
  }
  const emailLower = params.email.trim().toLowerCase();
  const cleanName = params.name.trim();

  if (!emailLower || !emailLower.includes('@')) {
    throw new DomainError('Informe um endereço de e-mail válido.', 400);
  }
  if (cleanName.length < 2) {
    throw new DomainError('Informe seu nome completo (mínimo 2 caracteres).', 400);
  }

  try {
    await ensureDefaultsSeeded();

    if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      return {
        alreadyAuthorized: true,
        message:
          'Este e-mail já é o Administrador Principal do sistema. Clique em "Já tenho senha" ou "Continuar com conta Google" para entrar.',
      };
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existingUser[0] && existingUser[0].active) {
      return {
        alreadyAuthorized: true,
        message:
          'Este e-mail já está autorizado! Use a aba "1º Acesso" para criar sua senha ou clique em "Continuar com conta Google".',
      };
    }

    const existingPending = await db
      .select()
      .from(accessRequests)
      .where(and(eq(accessRequests.email, emailLower), eq(accessRequests.status, 'PENDENTE')))
      .limit(1);

    const nowFormatted = formatDateTimeNow();

    if (existingPending[0]) {
      const updated = await db
        .update(accessRequests)
        .set({
          name: cleanName.slice(0, 120),
          role: (params.role || '').trim().slice(0, 100),
          department: (params.department || '').trim().slice(0, 100),
          reason: (params.reason || '').trim().slice(0, 500),
          date: nowFormatted,
          updatedAt: new Date(),
        })
        .where(eq(accessRequests.id, existingPending[0].id))
        .returning();

      await syncAccessRequestToSupabase(updated[0]);
      return {
        request: mapAccessRequestRow(updated[0]),
        message:
          'Seu pedido de acesso foi atualizado e reenviado ao Administrador da QHS Engenharia! Assim que aprovado, você poderá entrar no aplicativo.',
      };
    }

    const inserted = await db
      .insert(accessRequests)
      .values({
        id: `acc-req-${Date.now()}`,
        orgId: ORG_ID,
        name: cleanName.slice(0, 120),
        email: emailLower.slice(0, 200),
        role: (params.role || '').trim().slice(0, 100),
        department: (params.department || '').trim().slice(0, 100),
        reason: (params.reason || '').trim().slice(0, 500),
        date: nowFormatted,
        status: 'PENDENTE',
      })
      .returning();

    await syncAccessRequestToSupabase(inserted[0]);
    return {
      request: mapAccessRequestRow(inserted[0]),
      message:
        'Pedido enviado com sucesso ao Administrador! Aguarde a aprovação e tente entrar novamente.',
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in createAccessRequestInDb:', error);
    throw new Error('Falha ao registrar pedido de acesso no banco de dados.', { cause: error });
  }
}

export async function approveAccessRequestInDb(params: {
  requestId: string;
  admin: User;
  role?: string;
  department?: string;
  canDelete?: boolean;
  permissions?: Partial<UserPermissions>;
}) {
  if (!isSqlDatabaseConfigured()) {
    return approveAccessRequestSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const reqRows = await tx
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, params.requestId))
        .limit(1);

      const reqRow = reqRows[0];
      if (!reqRow) {
        throw new DomainError('Pedido de acesso não encontrado.', 404);
      }
      if (reqRow.status !== 'PENDENTE') {
        throw new DomainError('Este pedido de acesso já foi analisado.', 400);
      }

      const emailLower = reqRow.email.trim().toLowerCase();
      const defaultPerms = normalizePermissions(
        params.permissions ?? {
          dashboard: true,
          produtos: true,
          entradas: false,
          saidas: true,
          colaboradores: true,
          destinos: true,
          relatorios: false,
          estatisticas: false,
          configuracoes: false,
        }
      );

      const resolvedRole = (params.role ?? reqRow.role) || 'Operador de Estoque';
      const resolvedDepartment = params.department ?? reqRow.department ?? '';

      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      let userRow: typeof users.$inferSelect;
      if (existingUsers[0]) {
        const updatedUsers = await tx
          .update(users)
          .set({
            name: reqRow.name.trim().slice(0, 120),
            role: resolvedRole.trim().slice(0, 100),
            department: resolvedDepartment.trim().slice(0, 100),
            canDelete: Boolean(existingUsers[0].isAdmin || params.canDelete),
            active: true,
            permissions: existingUsers[0].isAdmin ? FULL_ADMIN_PERMISSIONS : defaultPerms,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUsers[0].id))
          .returning();
        userRow = updatedUsers[0];
      } else {
        const insertedUsers = await tx
          .insert(users)
          .values({
            id: `user-${Date.now()}`,
            name: reqRow.name.trim().slice(0, 120),
            email: emailLower.slice(0, 200),
            role: resolvedRole.trim().slice(0, 100),
            department: resolvedDepartment.trim().slice(0, 100),
            isAdmin: false,
            canDelete: Boolean(params.canDelete),
            active: true,
            permissions: defaultPerms,
            registrationDate: formatDateToday(),
          })
          .returning();
        userRow = insertedUsers[0];
      }

      const updatedReqs = await tx
        .update(accessRequests)
        .set({
          status: 'APROVADO',
          reviewedBy: params.admin.name.slice(0, 120),
          reviewedAt: formatDateTimeNow(),
          updatedAt: new Date(),
        })
        .where(eq(accessRequests.id, params.requestId))
        .returning();

      return { userRow, reqRow: updatedReqs[0] };
    });

    await syncUserToSupabase(result.userRow);
    await syncAccessRequestToSupabase(result.reqRow);

    return {
      user: mapUserRow(result.userRow),
      request: mapAccessRequestRow(result.reqRow),
    };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in approveAccessRequestInDb:', error);
    throw new Error('Falha ao aprovar pedido de acesso.', { cause: error });
  }
}

export async function rejectAccessRequestInDb(params: { requestId: string; admin: User }) {
  if (!isSqlDatabaseConfigured()) {
    return rejectAccessRequestSupabase(params);
  }
  try {
    const reqRows = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, params.requestId))
      .limit(1);

    const reqRow = reqRows[0];
    if (!reqRow) {
      throw new DomainError('Pedido de acesso não encontrado.', 404);
    }
    if (reqRow.status !== 'PENDENTE') {
      throw new DomainError('Este pedido de acesso já foi analisado.', 400);
    }

    const updated = await db
      .update(accessRequests)
      .set({
        status: 'RECUSADO',
        reviewedBy: params.admin.name.slice(0, 120),
        reviewedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(accessRequests.id, params.requestId))
      .returning();

    await syncAccessRequestToSupabase(updated[0]);
    return mapAccessRequestRow(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in rejectAccessRequestInDb:', error);
    throw new Error('Falha ao recusar pedido de acesso.', { cause: error });
  }
}

export async function createCollaboratorInDb(params: {
  ownerUid: string;
  fullName: string;
  role?: string;
  active?: boolean;
}) {
  if (!isSqlDatabaseConfigured()) {
    return createCollaboratorSupabase(params);
  }
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError('Informe o nome completo do colaborador (mínimo 2 caracteres).', 400);
  }

  try {
    const existing = await db
      .select()
      .from(collaborators)
      .where(sql`lower(${collaborators.fullName}) = lower(${trimmedName})`)
      .limit(1);

    if (existing[0]) {
      throw new DomainError(
        `Já existe um colaborador cadastrado com o nome "${trimmedName}".`,
        409
      );
    }

    const id = `colab-${Date.now()}`;
    const today = formatDateToday();
    const nowFormatted = formatDateTimeNow();

    const inserted = await db
      .insert(collaborators)
      .values({
        id,
        orgId: ORG_ID,
        fullName: trimmedName.slice(0, 120),
        role: (params.role || '').trim().slice(0, 100),
        active: params.active ?? true,
        registrationDate: today,
        displayUpdatedAt: nowFormatted,
        ownerUid: params.ownerUid,
      })
      .returning();

    await syncCollaboratorToSupabase(inserted[0]);
    return mapCollaboratorRow(inserted[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in createCollaboratorInDb:', error);
    throw new Error('Falha ao cadastrar colaborador no banco de dados.', { cause: error });
  }
}

export async function updateCollaboratorInDb(params: {
  id: string;
  fullName: string;
  role?: string;
  active: boolean;
}) {
  if (!isSqlDatabaseConfigured()) {
    return updateCollaboratorSupabase(params);
  }
  const trimmedName = params.fullName.trim();
  if (trimmedName.length < 2) {
    throw new DomainError('Informe o nome completo do colaborador (mínimo 2 caracteres).', 400);
  }

  try {
    const duplicate = await db
      .select()
      .from(collaborators)
      .where(
        and(
          sql`${collaborators.id} <> ${params.id}`,
          sql`lower(${collaborators.fullName}) = lower(${trimmedName})`
        )
      )
      .limit(1);

    if (duplicate[0]) {
      throw new DomainError(
        `Já existe outro colaborador cadastrado com o nome "${trimmedName}".`,
        409
      );
    }

    const updated = await db
      .update(collaborators)
      .set({
        fullName: trimmedName.slice(0, 120),
        role: (params.role || '').trim().slice(0, 100),
        active: Boolean(params.active),
        displayUpdatedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(collaborators.id, params.id))
      .returning();

    if (!updated[0]) {
      throw new DomainError('Colaborador não encontrado.', 404);
    }
    await syncCollaboratorToSupabase(updated[0]);
    return mapCollaboratorRow(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in updateCollaboratorInDb:', error);
    throw new Error('Falha ao atualizar colaborador.', { cause: error });
  }
}

export async function toggleCollaboratorActiveInDb(collaboratorId: string) {
  if (!isSqlDatabaseConfigured()) {
    return toggleCollaboratorActiveSupabase(collaboratorId);
  }
  try {
    const existing = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, collaboratorId))
      .limit(1);

    if (!existing[0]) {
      throw new DomainError('Colaborador não encontrado.', 404);
    }

    const nextActive = !existing[0].active;
    const updated = await db
      .update(collaborators)
      .set({
        active: nextActive,
        displayUpdatedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(collaborators.id, collaboratorId))
      .returning();

    await syncCollaboratorToSupabase(updated[0]);
    return mapCollaboratorRow(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in toggleCollaboratorActiveInDb:', error);
    throw new Error('Falha ao alterar status do colaborador.', { cause: error });
  }
}

export async function deleteCollaboratorInDb(params: {
  collaboratorId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return deleteCollaboratorSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const targetRows = await tx
        .select()
        .from(collaborators)
        .where(eq(collaborators.id, params.collaboratorId))
        .limit(1);

      const target = targetRows[0];
      if (!target) {
        throw new DomainError('Colaborador não encontrado.', 404);
      }

      const movRows = await tx
        .select()
        .from(movements)
        .where(eq(movements.type, 'SAIDA'));

      const relatedExitsCount = movRows.filter((m) =>
        m.collaboratorId
          ? m.collaboratorId === target.id
          : (m.withdrawnBy || '').trim().toLowerCase() === target.fullName.trim().toLowerCase()
      ).length;

      await tx.delete(collaborators).where(eq(collaborators.id, params.collaboratorId));

      const now = formatDateTimeNow();
      const insertedLogs = await tx
        .insert(deletionLogs)
        .values({
          id: `del-log-${Date.now()}`,
          orgId: ORG_ID,
          origin: 'DIRETA',
          recordType: 'COLABORADOR',
          targetId: target.id,
          targetCode: '',
          targetName: target.fullName,
          targetDetails: target.role
            ? `Função: ${target.role} · Status: ${target.active ? 'Ativo' : 'Inativo'}`
            : `Colaborador de obra · Status: ${target.active ? 'Ativo' : 'Inativo'}`,
          quantity: relatedExitsCount,
          reason: 'Exclusão direta por usuário autorizado',
          requestedBy: params.actor.name,
          requestedByDate: now,
          deletedBy: params.actor.name,
          deletedByEmail: params.actorEmail.toLowerCase(),
          deletedByUid: params.actorUid,
          deletedAt: now,
        })
        .returning();

      return {
        fullName: target.fullName,
        deletedId: target.id,
        logRow: insertedLogs[0],
      };
    });

    await deleteCollaboratorFromSupabase(result.deletedId);
    await syncDeletionLogToSupabase(result.logRow);
    return result.fullName;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in deleteCollaboratorInDb:', error);
    throw new Error('Falha ao excluir colaborador no banco de dados.', { cause: error });
  }
}

export async function createProductInDb(
  ownerUid: string,
  prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
) {
  if (!isSqlDatabaseConfigured()) {
    return createProductSupabase(ownerUid, prodData);
  }
  try {
    const id = `prod-${Date.now()}`;
    const today = formatDateToday();
    const nowFormatted = formatDateTimeNow();
    const inserted = await db
      .insert(products)
      .values({
        id,
        orgId: ORG_ID,
        code: prodData.code.trim().slice(0, 60),
        name: prodData.name.trim().slice(0, 200),
        groupName: prodData.group.trim().slice(0, 80),
        currentStock: Math.max(0, Number(prodData.currentStock)),
        minStock: Math.max(0, Number(prodData.minStock)),
        photoUrl: (prodData.photoUrl || '').slice(0, 300000),
        description: (prodData.description || '').slice(0, 1000),
        registrationDate: today,
        displayUpdatedAt: nowFormatted,
        ownerUid,
      })
      .returning();

    await syncProductToSupabase(inserted[0]);
    return mapProductRow(inserted[0]);
  } catch (error) {
    console.error('Database query failed in createProductInDb:', error);
    throw new Error('Falha ao cadastrar produto.', { cause: error });
  }
}

export async function updateProductInDb(updatedProduct: Product) {
  if (!isSqlDatabaseConfigured()) {
    return updateProductSupabase(updatedProduct);
  }
  try {
    const updated = await db
      .update(products)
      .set({
        code: updatedProduct.code.trim().slice(0, 60),
        name: updatedProduct.name.trim().slice(0, 200),
        groupName: updatedProduct.group.trim().slice(0, 80),
        currentStock: Number(updatedProduct.currentStock),
        minStock: Math.max(0, Number(updatedProduct.minStock)),
        photoUrl: (updatedProduct.photoUrl || '').slice(0, 300000),
        description: (updatedProduct.description || '').slice(0, 1000),
        displayUpdatedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(products.id, updatedProduct.id))
      .returning();

    if (!updated[0]) {
      throw new DomainError('Produto não encontrado.', 404);
    }
    await syncProductToSupabase(updated[0]);
    return mapProductRow(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in updateProductInDb:', error);
    throw new Error('Falha ao atualizar produto.', { cause: error });
  }
}

export async function deleteProductInDb(params: {
  productId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return deleteProductSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const targetRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, params.productId))
        .limit(1);

      const target = targetRows[0];
      if (!target) {
        throw new DomainError('Produto não encontrado.', 404);
      }

      await tx.delete(products).where(eq(products.id, params.productId));

      const now = formatDateTimeNow();
      const insertedLogs = await tx
        .insert(deletionLogs)
        .values({
          id: `del-log-${Date.now()}`,
          orgId: ORG_ID,
          origin: 'DIRETA',
          recordType: 'PRODUTO',
          targetId: target.id,
          targetCode: target.code,
          targetName: target.name,
          targetDetails: `Grupo: ${target.groupName} · Estoque no momento da exclusão: ${target.currentStock} un`,
          quantity: Number(target.currentStock),
          reason: 'Exclusão direta por usuário autorizado',
          requestedBy: params.actor.name,
          requestedByDate: now,
          deletedBy: params.actor.name,
          deletedByEmail: params.actorEmail.toLowerCase(),
          deletedByUid: params.actorUid,
          deletedAt: now,
        })
        .returning();

      return {
        name: target.name,
        deletedId: target.id,
        logRow: insertedLogs[0],
      };
    });

    await deleteProductFromSupabase(result.deletedId);
    await syncDeletionLogToSupabase(result.logRow);
    return result.name;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in deleteProductInDb:', error);
    throw new Error('Falha ao excluir produto.', { cause: error });
  }
}

export async function recordMovementInDb(params: {
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
  if (!isSqlDatabaseConfigured()) {
    return recordMovementSupabase(params);
  }
  const qty = Number(params.quantity);
  if (Number.isNaN(qty) || qty <= 0) {
    throw new DomainError('Quantidade deve ser maior que zero.', 400);
  }

  try {
    const result = await db.transaction(async (tx) => {
      const prodRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, params.productId))
        .limit(1);

      const prod = prodRows[0];
      if (!prod) {
        throw new DomainError('Produto não encontrado.', 404);
      }

      if (params.type === 'SAIDA' && !params.isNegativeStockAuthorized && prod.currentStock < qty) {
        throw new DomainError(
          `Saldo insuficiente! Estoque disponível: ${prod.currentStock} un. Necessário solicitar autorização ao Administrador.`,
          400
        );
      }

      if (params.type === 'SAIDA' && params.isNegativeStockAuthorized && !params.actor.isAdmin) {
        throw new DomainError(
          'Somente o Administrador pode autorizar saída com saldo negativo.',
          403
        );
      }

      let resolvedWithdrawnBy = params.withdrawnBy?.trim() || '';
      let resolvedCollaboratorId = params.collaboratorId || undefined;
      let resolvedColabRow: typeof collaborators.$inferSelect | undefined;

      if (resolvedCollaboratorId) {
        const colabRows = await tx
          .select()
          .from(collaborators)
          .where(eq(collaborators.id, resolvedCollaboratorId))
          .limit(1);
        if (colabRows[0]) {
          resolvedWithdrawnBy = colabRows[0].fullName;
          resolvedColabRow = colabRows[0];
        } else {
          resolvedCollaboratorId = undefined;
        }
      }

      const newStock =
        params.type === 'ENTRADA' ? prod.currentStock + qty : prod.currentStock - qty;
      const formattedDate = params.date?.trim() || formatDateTimeNow();
      const movId = params.id || `mov-${Date.now()}`;

      const insertedMovs = await tx
        .insert(movements)
        .values({
          id: movId,
          orgId: ORG_ID,
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          groupName: prod.groupName,
          type: params.type,
          quantity: qty,
          stockAfterMovement: newStock,
          date: formattedDate.slice(0, 30),
          withdrawnBy: resolvedWithdrawnBy ? resolvedWithdrawnBy.slice(0, 120) : null,
          collaboratorId: resolvedCollaboratorId ?? null,
          responsibleUser: params.actor.name.slice(0, 120),
          destination: params.destination ? params.destination.slice(0, 150) : null,
          notes: params.notes ? params.notes.slice(0, 1000) : null,
          isNegativeStockAuthorized: params.isNegativeStockAuthorized ?? null,
          authorizedBy: params.authorizedBy ? params.authorizedBy.slice(0, 120) : null,
          ownerUid: params.actorUid,
        })
        .returning();

      const updatedProds = await tx
        .update(products)
        .set({
          currentStock: newStock,
          displayUpdatedAt: formattedDate.slice(0, 30),
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id))
        .returning();

      return {
        stockAfter: newStock,
        movId,
        movRow: insertedMovs[0],
        prodRow: updatedProds[0],
        colabRow: resolvedColabRow,
      };
    });

    await syncProductToSupabase(result.prodRow);
    if (result.colabRow) {
      await syncCollaboratorToSupabase(result.colabRow);
    }
    await syncMovementToSupabase(result.movRow);

    return { stockAfter: result.stockAfter, movId: result.movId };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in recordMovementInDb:', error);
    throw new Error('Falha ao registrar movimentação.', { cause: error });
  }
}

export async function deleteMovementInDb(params: {
  movementId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return deleteMovementSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const movRows = await tx
        .select()
        .from(movements)
        .where(eq(movements.id, params.movementId))
        .limit(1);

      const mov = movRows[0];
      if (!mov) {
        throw new DomainError('Movimentação não encontrada.', 404);
      }

      const movType: 'ENTRADA' | 'SAIDA' = mov.type === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
      const qty = Number(mov.quantity);
      let productUpdated = false;
      let newStock: number | undefined;
      let updatedProdRow: typeof products.$inferSelect | undefined;

      const prodRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, mov.productId))
        .limit(1);

      if (prodRows[0]) {
        const currentStock = Number(prodRows[0].currentStock);
        newStock = movType === 'ENTRADA' ? currentStock - qty : currentStock + qty;
        const updatedProds = await tx
          .update(products)
          .set({
            currentStock: newStock,
            displayUpdatedAt: formatDateTimeNow(),
            updatedAt: new Date(),
          })
          .where(eq(products.id, mov.productId))
          .returning();
        updatedProdRow = updatedProds[0];
        productUpdated = true;
      }

      await tx.delete(movements).where(eq(movements.id, params.movementId));

      const now = formatDateTimeNow();
      const insertedLogs = await tx
        .insert(deletionLogs)
        .values({
          id: `del-log-${Date.now()}`,
          orgId: ORG_ID,
          origin: 'DIRETA',
          recordType: movType,
          targetId: mov.id,
          targetCode: mov.productCode,
          targetName: mov.productName,
          targetDetails: `${movType === 'ENTRADA' ? 'Entrada' : 'Saída'} registrada em ${mov.date}${mov.destination ? ` · Obra: ${mov.destination}` : ''}${mov.withdrawnBy ? ` · Retirada: ${mov.withdrawnBy}` : ''}`,
          quantity: qty,
          reason: 'Exclusão direta por usuário autorizado',
          requestedBy: params.actor.name,
          requestedByDate: now,
          deletedBy: params.actor.name,
          deletedByEmail: params.actorEmail.toLowerCase(),
          deletedByUid: params.actorUid,
          deletedAt: now,
        })
        .returning();

      return {
        productUpdated,
        newStock,
        deletedId: mov.id,
        updatedProdRow,
        logRow: insertedLogs[0],
      };
    });

    await deleteMovementFromSupabase(result.deletedId);
    if (result.updatedProdRow) {
      await syncProductToSupabase(result.updatedProdRow);
    }
    await syncDeletionLogToSupabase(result.logRow);

    return { productUpdated: result.productUpdated, newStock: result.newStock };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in deleteMovementInDb:', error);
    throw new Error('Falha ao excluir movimentação.', { cause: error });
  }
}

export async function createNegativeRequestInDb(params: {
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
  if (!isSqlDatabaseConfigured()) {
    return createNegativeRequestSupabase(params);
  }
  try {
    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, params.productId))
      .limit(1);

    const prod = prodRows[0];
    if (!prod) throw new DomainError('Produto não encontrado.', 404);

    let resolvedWithdrawnBy = params.withdrawnBy.trim();
    let resolvedCollaboratorId = params.collaboratorId || undefined;
    let resolvedColabRow: typeof collaborators.$inferSelect | undefined;
    if (resolvedCollaboratorId) {
      const colabRows = await db
        .select()
        .from(collaborators)
        .where(eq(collaborators.id, resolvedCollaboratorId))
        .limit(1);
      if (colabRows[0]) {
        resolvedWithdrawnBy = colabRows[0].fullName;
        resolvedColabRow = colabRows[0];
      } else {
        resolvedCollaboratorId = undefined;
      }
    }

    const reqId = params.id || `req-neg-${Date.now()}`;
    const deficit = Math.max(0, Number(params.requestedQuantity) - Number(prod.currentStock));
    const formattedDate = formatDateTimeNow();

    const inserted = await db
      .insert(negativeRequests)
      .values({
        id: reqId,
        orgId: ORG_ID,
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        groupName: prod.groupName,
        requestedQuantity: Number(params.requestedQuantity),
        availableStock: Number(prod.currentStock),
        deficitQuantity: deficit,
        withdrawnBy: resolvedWithdrawnBy.slice(0, 120),
        collaboratorId: resolvedCollaboratorId ?? null,
        destination: params.destination.slice(0, 150),
        requestedBy: params.actor.name.slice(0, 120),
        requestedByUid: params.actorUid,
        reason: (params.reason || 'Necessidade operacional urgente.').slice(0, 1000),
        date: formattedDate,
        status: 'PENDENTE',
      })
      .returning();

    await syncProductToSupabase(prod);
    if (resolvedColabRow) {
      await syncCollaboratorToSupabase(resolvedColabRow);
    }
    await syncNegativeRequestToSupabase(inserted[0]);

    return { reqId };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in createNegativeRequestInDb:', error);
    throw new Error('Falha ao criar solicitação de estoque negativo.', { cause: error });
  }
}

export async function approveNegativeRequestInDb(params: {
  requestId: string;
  admin: User;
  adminUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return approveNegativeRequestSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const reqRows = await tx
        .select()
        .from(negativeRequests)
        .where(eq(negativeRequests.id, params.requestId))
        .limit(1);

      const reqRow = reqRows[0];
      if (!reqRow) throw new DomainError('Solicitação não encontrada.', 404);
      if (reqRow.status !== 'PENDENTE') {
        throw new DomainError('Solicitação já analisada anteriormente.', 400);
      }

      const prodRows = await tx
        .select()
        .from(products)
        .where(eq(products.id, reqRow.productId))
        .limit(1);

      const prod = prodRows[0];
      if (!prod) throw new DomainError('Produto não encontrado.', 404);

      const newStock = Number(prod.currentStock) - Number(reqRow.requestedQuantity);
      const formattedDate = formatDateTimeNow();
      const movId = `mov-${Date.now()}`;

      const updatedReqs = await tx
        .update(negativeRequests)
        .set({
          status: 'APROVADO',
          reviewedBy: params.admin.name.slice(0, 120),
          reviewedAt: formattedDate,
          updatedAt: new Date(),
        })
        .where(eq(negativeRequests.id, params.requestId))
        .returning();

      const insertedMovs = await tx
        .insert(movements)
        .values({
          id: movId,
          orgId: ORG_ID,
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          groupName: prod.groupName,
          type: 'SAIDA',
          quantity: Number(reqRow.requestedQuantity),
          stockAfterMovement: newStock,
          date: formattedDate,
          withdrawnBy: reqRow.withdrawnBy,
          collaboratorId: reqRow.collaboratorId ?? null,
          responsibleUser: params.admin.name.slice(0, 120),
          destination: reqRow.destination,
          notes: `[AUTORIZAÇÃO EXCEPCIONAL ADMINISTRADOR: ${params.admin.name}] Motivo: ${reqRow.reason}`.slice(
            0,
            1000
          ),
          isNegativeStockAuthorized: true,
          authorizedBy: params.admin.name.slice(0, 120),
          ownerUid: params.adminUid,
        })
        .returning();

      const updatedProds = await tx
        .update(products)
        .set({
          currentStock: newStock,
          displayUpdatedAt: formattedDate,
          updatedAt: new Date(),
        })
        .where(eq(products.id, prod.id))
        .returning();

      return {
        newStock,
        productName: prod.name,
        updatedReqRow: updatedReqs[0],
        insertedMovRow: insertedMovs[0],
        updatedProdRow: updatedProds[0],
      };
    });

    await syncProductToSupabase(result.updatedProdRow);
    await syncNegativeRequestToSupabase(result.updatedReqRow);
    await syncMovementToSupabase(result.insertedMovRow);

    return { newStock: result.newStock, productName: result.productName };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in approveNegativeRequestInDb:', error);
    throw new Error('Falha ao aprovar solicitação de estoque negativo.', { cause: error });
  }
}

export async function rejectNegativeRequestInDb(requestId: string, adminName: string) {
  if (!isSqlDatabaseConfigured()) {
    return rejectNegativeRequestSupabase(requestId, adminName);
  }
  try {
    const updated = await db
      .update(negativeRequests)
      .set({
        status: 'RECUSADO',
        reviewedBy: adminName.slice(0, 120),
        reviewedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(negativeRequests.id, requestId))
      .returning();

    if (!updated[0]) throw new DomainError('Solicitação não encontrada.', 404);
    await syncNegativeRequestToSupabase(updated[0]);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in rejectNegativeRequestInDb:', error);
    throw new Error('Falha ao recusar solicitação de estoque negativo.', { cause: error });
  }
}

export async function deleteNegativeRequestInDb(params: {
  requestId: string;
  actor: User;
  actorEmail: string;
  actorUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return deleteNegativeRequestSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const targetRows = await tx
        .select()
        .from(negativeRequests)
        .where(eq(negativeRequests.id, params.requestId))
        .limit(1);

      const target = targetRows[0];
      if (!target) throw new DomainError('Solicitação não encontrada.', 404);

      await tx.delete(negativeRequests).where(eq(negativeRequests.id, params.requestId));

      const now = formatDateTimeNow();
      const insertedLogs = await tx
        .insert(deletionLogs)
        .values({
          id: `del-log-${Date.now()}`,
          orgId: ORG_ID,
          origin: 'DIRETA',
          recordType: 'SOLICITACAO_NEGATIVA',
          targetId: target.id,
          targetCode: target.productCode,
          targetName: target.productName,
          targetDetails: `Retirada: ${target.withdrawnBy} · Obra: ${target.destination}`,
          quantity: Number(target.requestedQuantity),
          reason: 'Exclusão direta por usuário autorizado',
          requestedBy: params.actor.name,
          requestedByDate: now,
          deletedBy: params.actor.name,
          deletedByEmail: params.actorEmail.toLowerCase(),
          deletedByUid: params.actorUid,
          deletedAt: now,
        })
        .returning();

      return {
        deletedId: target.id,
        logRow: insertedLogs[0],
      };
    });

    await deleteNegativeRequestFromSupabase(result.deletedId);
    await syncDeletionLogToSupabase(result.logRow);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in deleteNegativeRequestInDb:', error);
    throw new Error('Falha ao excluir solicitação de estoque negativo.', { cause: error });
  }
}

export async function createDeletionRequestInDb(params: {
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
  if (!isSqlDatabaseConfigured()) {
    return createDeletionRequestSupabase(params);
  }
  const trimmedReason = params.reason.trim();
  if (trimmedReason.length < 3) {
    throw new DomainError(
      'Informe uma justificativa com pelo menos 3 caracteres explicando o motivo da exclusão.',
      400
    );
  }

  try {
    const existingPending = await db
      .select()
      .from(deletionRequests)
      .where(
        and(
          eq(deletionRequests.targetId, params.targetId),
          eq(deletionRequests.requestedByUid, params.actorUid),
          eq(deletionRequests.status, 'PENDENTE')
        )
      )
      .limit(1);

    if (existingPending[0]) {
      throw new DomainError(
        'Já existe uma solicitação de exclusão pendente aguardando aprovação para este registro.',
        409
      );
    }

    const reqId = `del-req-${Date.now()}`;
    const formattedDate = formatDateTimeNow();

    const inserted = await db
      .insert(deletionRequests)
      .values({
        id: reqId,
        orgId: ORG_ID,
        recordType: params.recordType,
        targetId: params.targetId,
        targetCode: params.targetCode.slice(0, 60),
        targetName: params.targetName.slice(0, 200),
        targetDetails: params.targetDetails.slice(0, 400),
        quantity: Number(params.quantity),
        reason: trimmedReason.slice(0, 1000),
        requestedBy: params.actor.name.slice(0, 120),
        requestedByEmail: params.actorEmail.toLowerCase().slice(0, 200),
        requestedByUid: params.actorUid,
        date: formattedDate,
        status: 'PENDENTE',
      })
      .returning();

    await syncDeletionRequestToSupabase(inserted[0]);

    return { reqId };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in createDeletionRequestInDb:', error);
    throw new Error('Falha ao criar solicitação de exclusão.', { cause: error });
  }
}

export async function approveDeletionRequestInDb(params: {
  requestId: string;
  admin: User;
  adminEmail: string;
  adminUid: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return approveDeletionRequestSupabase(params);
  }
  try {
    const result = await db.transaction(async (tx) => {
      const reqRows = await tx
        .select()
        .from(deletionRequests)
        .where(eq(deletionRequests.id, params.requestId))
        .limit(1);

      const reqRow = reqRows[0];
      if (!reqRow) throw new DomainError('Solicitação de exclusão não encontrada.', 404);
      if (reqRow.status !== 'PENDENTE') {
        throw new DomainError('Esta solicitação já foi analisada anteriormente.', 400);
      }

      let stockNote = '';
      let deletedKind:
        | 'PRODUTO'
        | 'MOVIMENTACAO'
        | 'SOLICITACAO_NEGATIVA'
        | 'COLABORADOR'
        | null = null;
      let deletedTargetId = '';
      let updatedProdRow: typeof products.$inferSelect | undefined;

      if (reqRow.recordType === 'PRODUTO') {
        await tx.delete(products).where(eq(products.id, reqRow.targetId));
        deletedKind = 'PRODUTO';
        deletedTargetId = reqRow.targetId;
      } else if (reqRow.recordType === 'ENTRADA' || reqRow.recordType === 'SAIDA') {
        const movRows = await tx
          .select()
          .from(movements)
          .where(eq(movements.id, reqRow.targetId))
          .limit(1);
        const mov = movRows[0];
        if (mov) {
          const prodRows = await tx
            .select()
            .from(products)
            .where(eq(products.id, mov.productId))
            .limit(1);
          if (prodRows[0]) {
            const currentStock = Number(prodRows[0].currentStock);
            const qty = Number(mov.quantity);
            const newStock = mov.type === 'ENTRADA' ? currentStock - qty : currentStock + qty;
            const updatedProds = await tx
              .update(products)
              .set({
                currentStock: newStock,
                displayUpdatedAt: formatDateTimeNow(),
                updatedAt: new Date(),
              })
              .where(eq(products.id, mov.productId))
              .returning();
            updatedProdRow = updatedProds[0];
            stockNote = ` Estoque atualizado de "${reqRow.targetName}": ${newStock} un.`;
          }
          await tx.delete(movements).where(eq(movements.id, mov.id));
          deletedKind = 'MOVIMENTACAO';
          deletedTargetId = mov.id;
        }
      } else if (reqRow.recordType === 'SOLICITACAO_NEGATIVA') {
        await tx.delete(negativeRequests).where(eq(negativeRequests.id, reqRow.targetId));
        deletedKind = 'SOLICITACAO_NEGATIVA';
        deletedTargetId = reqRow.targetId;
      } else if (reqRow.recordType === 'COLABORADOR') {
        await tx.delete(collaborators).where(eq(collaborators.id, reqRow.targetId));
        deletedKind = 'COLABORADOR';
        deletedTargetId = reqRow.targetId;
      }

      const now = formatDateTimeNow();
      const updatedReqs = await tx
        .update(deletionRequests)
        .set({
          status: 'APROVADO',
          reviewedBy: params.admin.name.slice(0, 120),
          reviewedByEmail: params.adminEmail.toLowerCase().slice(0, 200),
          reviewedAt: now,
          executedBy: params.admin.name.slice(0, 120),
          executedAt: now,
          updatedAt: new Date(),
        })
        .where(eq(deletionRequests.id, reqRow.id))
        .returning();

      const insertedLogs = await tx
        .insert(deletionLogs)
        .values({
          id: `del-log-${Date.now()}`,
          orgId: ORG_ID,
          origin: 'APROVADA',
          requestId: reqRow.id,
          recordType: reqRow.recordType,
          targetId: reqRow.targetId,
          targetCode: reqRow.targetCode,
          targetName: reqRow.targetName,
          targetDetails: reqRow.targetDetails,
          quantity: Number(reqRow.quantity),
          reason: reqRow.reason,
          requestedBy: reqRow.requestedBy,
          requestedByDate: reqRow.date,
          approvedBy: params.admin.name.slice(0, 120),
          approvedAt: now,
          deletedBy: params.admin.name.slice(0, 120),
          deletedByEmail: params.adminEmail.toLowerCase().slice(0, 200),
          deletedByUid: params.adminUid,
          deletedAt: now,
        })
        .returning();

      return {
        targetName: reqRow.targetName,
        stockNote,
        deletedKind,
        deletedTargetId,
        updatedProdRow,
        updatedReqRow: updatedReqs[0],
        logRow: insertedLogs[0],
      };
    });

    if (result.deletedKind === 'PRODUTO') {
      await deleteProductFromSupabase(result.deletedTargetId);
    } else if (result.deletedKind === 'MOVIMENTACAO') {
      await deleteMovementFromSupabase(result.deletedTargetId);
    } else if (result.deletedKind === 'SOLICITACAO_NEGATIVA') {
      await deleteNegativeRequestFromSupabase(result.deletedTargetId);
    } else if (result.deletedKind === 'COLABORADOR') {
      await deleteCollaboratorFromSupabase(result.deletedTargetId);
    }

    if (result.updatedProdRow) {
      await syncProductToSupabase(result.updatedProdRow);
    }
    await syncDeletionRequestToSupabase(result.updatedReqRow);
    await syncDeletionLogToSupabase(result.logRow);

    return { targetName: result.targetName, stockNote: result.stockNote };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in approveDeletionRequestInDb:', error);
    throw new Error('Erro ao executar exclusão após aprovação.', { cause: error });
  }
}

export async function rejectDeletionRequestInDb(params: {
  requestId: string;
  admin: User;
  adminEmail: string;
}) {
  if (!isSqlDatabaseConfigured()) {
    return rejectDeletionRequestSupabase(params);
  }
  try {
    const reqRows = await db
      .select()
      .from(deletionRequests)
      .where(eq(deletionRequests.id, params.requestId))
      .limit(1);

    const reqRow = reqRows[0];
    if (!reqRow) throw new DomainError('Solicitação de exclusão não encontrada.', 404);
    if (reqRow.status !== 'PENDENTE') {
      throw new DomainError('Esta solicitação já foi analisada anteriormente.', 400);
    }

    const updated = await db
      .update(deletionRequests)
      .set({
        status: 'RECUSADO',
        reviewedBy: params.admin.name.slice(0, 120),
        reviewedByEmail: params.adminEmail.toLowerCase().slice(0, 200),
        reviewedAt: formatDateTimeNow(),
        updatedAt: new Date(),
      })
      .where(eq(deletionRequests.id, params.requestId))
      .returning();

    await syncDeletionRequestToSupabase(updated[0]);

    return { targetName: reqRow.targetName };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error('Database query failed in rejectDeletionRequestInDb:', error);
    throw new Error('Falha ao recusar solicitação de exclusão.', { cause: error });
  }
}

export async function resetAllDataInDb(adminUid: string, adminEmail: string, adminName: string) {
  if (!isSqlDatabaseConfigured()) {
    return resetAllDataSupabase(adminUid, adminEmail, adminName);
  }
  try {
    const result = await db.transaction(async (tx) => {
      await tx.delete(movements);
      await tx.delete(negativeRequests);
      await tx.delete(deletionRequests);
      await tx.delete(deletionLogs);
      await tx.delete(accessRequests);
      await tx.delete(collaborators);
      await tx.delete(products);
      await tx.delete(users).where(sql`${users.id} <> 'user-owner'`);

      const updatedLists = await tx
        .update(managedLists)
        .set({
          groups: INITIAL_LISTS.groups,
          roles: INITIAL_LISTS.roles,
          destinations: INITIAL_LISTS.destinations,
          updatedAt: new Date(),
        })
        .where(eq(managedLists.id, 'global'))
        .returning();

      const updatedSettings = await tx
        .update(systemSettings)
        .set({
          showProductPhotos: INITIAL_SETTINGS.showProductPhotos,
          companyName: INITIAL_SETTINGS.companyName,
          companySubtitle: INITIAL_SETTINGS.companySubtitle,
          cnpj: INITIAL_SETTINGS.cnpj,
          contactEmail: INITIAL_SETTINGS.contactEmail,
          lowStockAlertNotification: INITIAL_SETTINGS.lowStockAlertNotification,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, 'global'))
        .returning();

      await tx
        .insert(users)
        .values({
          id: 'user-owner',
          uid: adminUid,
          name: adminName.slice(0, 120),
          email: adminEmail.toLowerCase(),
          role: 'Diretor de Engenharia & Admin',
          department: 'Diretoria Técnica',
          isAdmin: true,
          canDelete: true,
          active: true,
          permissions: FULL_ADMIN_PERMISSIONS,
          registrationDate: formatDateToday(),
        })
        .onConflictDoNothing({ target: users.id });

      const ownerRows = await tx
        .select()
        .from(users)
        .where(eq(users.id, 'user-owner'))
        .limit(1);

      return {
        listsRow: updatedLists[0],
        settingsRow: updatedSettings[0],
        ownerRow: ownerRows[0],
      };
    });

    await syncResetAllToSupabase(result);
  } catch (error) {
    console.error('Database query failed in resetAllDataInDb:', error);
    throw new Error('Falha ao zerar dados no banco de dados.', { cause: error });
  }
}
