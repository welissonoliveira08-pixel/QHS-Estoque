import { auth } from '../firebase';
import type {
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
} from '../types';

export interface BootstrapResponse {
  currentUser: User;
  users: User[];
  collaborators: Collaborator[];
  products: Product[];
  movements: StockMovement[];
  negativeRequests: NegativeStockRequest[];
  deletionRequests: DeletionRequest[];
  deletionLogs: DeletionLog[];
  managedLists: ManagedLists;
  settings: SystemSettings;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const currentFbUser = auth.currentUser;
  if (!currentFbUser) {
    throw new ApiError('Usuário não autenticado.', 401);
  }

  const token = await currentFbUser.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    const errorMessage =
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : `Erro HTTP ${response.status} ao comunicar com o servidor.`;
    throw new ApiError(errorMessage, response.status);
  }

  return payload as T;
}

export async function verifyEmailInviteApi(email: string): Promise<{
  authorized: boolean;
  alreadyActivated: boolean;
}> {
  const response = await fetch('/api/auth/verify-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : 'Este e-mail não está autorizado a acessar o sistema.',
      response.status
    );
  }
  return payload as { authorized: boolean; alreadyActivated: boolean };
}

export function fetchBootstrapData(): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/bootstrap', { method: 'GET' });
}

export function patchShowProductPhotosApi(showProductPhotos: boolean): Promise<{ ok: boolean }> {
  return apiFetch('/api/settings/photos', {
    method: 'PATCH',
    body: JSON.stringify({ showProductPhotos }),
  });
}

export function updateSettingsApi(settings: Partial<SystemSettings>): Promise<{ ok: boolean }> {
  return apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function updateManagedListsApi(params: {
  lists: ManagedLists;
  renameGroup?: { oldName: string; newName: string };
  renameRole?: { oldName: string; newName: string };
}): Promise<{ ok: boolean }> {
  return apiFetch('/api/lists', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export function createUserApi(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  return apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export function updateUserApi(user: User): Promise<User> {
  return apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  });
}

export function updateUserPermissionsApi(
  userId: string,
  permissions: UserPermissions
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/users/${encodeURIComponent(userId)}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

export function updateUserDeletePermissionApi(
  userId: string,
  canDelete: boolean
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/users/${encodeURIComponent(userId)}/delete-permission`, {
    method: 'PATCH',
    body: JSON.stringify({ canDelete }),
  });
}

export function deleteUserApi(userId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export function createCollaboratorApi(params: {
  fullName: string;
  role?: string;
  active?: boolean;
}): Promise<Collaborator> {
  return apiFetch('/api/collaborators', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateCollaboratorApi(params: {
  id: string;
  fullName: string;
  role?: string;
  active: boolean;
}): Promise<Collaborator> {
  return apiFetch(`/api/collaborators/${encodeURIComponent(params.id)}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export function toggleCollaboratorActiveApi(collaboratorId: string): Promise<Collaborator> {
  return apiFetch(`/api/collaborators/${encodeURIComponent(collaboratorId)}/toggle`, {
    method: 'PATCH',
  });
}

export function deleteCollaboratorApi(
  collaboratorId: string
): Promise<{ ok: boolean; deletedName: string }> {
  return apiFetch(`/api/collaborators/${encodeURIComponent(collaboratorId)}`, {
    method: 'DELETE',
  });
}

export function createProductApi(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  return apiFetch('/api/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export function updateProductApi(product: Product): Promise<Product> {
  return apiFetch(`/api/products/${encodeURIComponent(product.id)}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });
}

export function deleteProductApi(
  productId: string
): Promise<{ ok: boolean; deletedName: string }> {
  return apiFetch(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  });
}

export function recordMovementApi(params: {
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
}): Promise<{ stockAfter: number; movId: string }> {
  return apiFetch('/api/movements', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function deleteMovementApi(
  movementId: string
): Promise<{ ok: boolean; productUpdated: boolean; newStock?: number }> {
  return apiFetch(`/api/movements/${encodeURIComponent(movementId)}`, {
    method: 'DELETE',
  });
}

export function createNegativeRequestApi(params: {
  id?: string;
  productId: string;
  requestedQuantity: number;
  withdrawnBy: string;
  collaboratorId?: string;
  destination: string;
  reason: string;
}): Promise<{ reqId: string }> {
  return apiFetch('/api/negative-requests', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function approveNegativeRequestApi(
  requestId: string
): Promise<{ ok: boolean; newStock: number; productName: string }> {
  return apiFetch(`/api/negative-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
  });
}

export function rejectNegativeRequestApi(requestId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/negative-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
  });
}

export function deleteNegativeRequestApi(requestId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/negative-requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });
}

export function createDeletionRequestApi(params: {
  recordType: DeletionRecordType;
  targetId: string;
  targetCode: string;
  targetName: string;
  targetDetails: string;
  quantity: number;
  reason: string;
}): Promise<{ reqId: string }> {
  return apiFetch('/api/deletion-requests', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function approveDeletionRequestApi(
  requestId: string
): Promise<{ ok: boolean; targetName: string; stockNote: string }> {
  return apiFetch(`/api/deletion-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
  });
}

export function rejectDeletionRequestApi(
  requestId: string
): Promise<{ ok: boolean; targetName: string }> {
  return apiFetch(`/api/deletion-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
  });
}

export function resetAllDataApi(): Promise<{ ok: boolean }> {
  return apiFetch('/api/admin/reset', {
    method: 'POST',
  });
}
