import type {
  ManagedLists,
  NegativeStockRequest,
  Product,
  StockMovement,
  SystemSettings,
  User,
} from '../types/index.ts';

export const INITIAL_SETTINGS: SystemSettings = {
  showProductPhotos: true,
  companyName: 'QHS ENGENHARIA',
  companySubtitle: 'Sistema de Controle de Almoxarifado e Estoque de Materiais',
  cnpj: '18.492.831/0001-50',
  contactEmail: 'almoxarifado@qhsengenharia.com.br',
  lowStockAlertNotification: true,
};

export const INITIAL_LISTS: ManagedLists = {
  groups: ['Materiais', 'Extintores', 'Placas'],
  roles: [],
  destinations: [],
};

export const INITIAL_USERS: User[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_MOVEMENTS: StockMovement[] = [];

export const INITIAL_NEGATIVE_REQUESTS: NegativeStockRequest[] = [];
