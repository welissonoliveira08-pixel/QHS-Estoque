export type TabId = 
  | 'dashboard'
  | 'produtos'
  | 'entradas'
  | 'saidas'
  | 'relatorios'
  | 'estatisticas'
  | 'configuracoes';

export interface UserPermissions {
  dashboard: boolean;
  produtos: boolean;
  entradas: boolean;
  saidas: boolean;
  relatorios: boolean;
  estatisticas: boolean;
  configuracoes: boolean;
}

export type UserRole = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  isAdmin: boolean;
  permissions: UserPermissions;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  group: string; // Ex: Materiais, Extintores, Placas
  currentStock: number;
  minStock: number;
  photoUrl?: string; // Opcional
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'ENTRADA' | 'SAIDA';

export interface StockMovement {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  group: string;
  type: MovementType;
  quantity: number;
  stockAfterMovement: number; // Saldo que ficou disponível após a movimentação
  date: string; // YYYY-MM-DD HH:mm
  withdrawnBy?: string; // Funcionário que retirou o material (obrigatório em saídas)
  responsibleUser: string; // Usuário do sistema que lançou a movimentação
  destination?: string; // Obra / Centro de Custo
  notes?: string;
  isNegativeStockAuthorized?: boolean;
  authorizedBy?: string;
}

export interface NegativeStockRequest {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  group: string;
  requestedQuantity: number;
  availableStock: number;
  deficitQuantity: number;
  withdrawnBy: string; // Funcionário que irá retirar
  destination: string; // Obra
  requestedBy: string; // Colaborador solicitante
  reason: string; // Motivo da necessidade urgente
  date: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ManagedLists {
  groups: string[];
  roles: string[];
  destinations: string[];
}

export interface SystemSettings {
  showProductPhotos: boolean;
  companyName: string;
  companySubtitle: string;
  cnpj: string;
  contactEmail: string;
  lowStockAlertNotification: boolean;
}
