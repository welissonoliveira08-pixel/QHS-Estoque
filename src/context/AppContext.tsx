import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ManagedLists, NegativeStockRequest, Product, StockMovement, SystemSettings, TabId, User, UserPermissions } from '../types';
import { INITIAL_LISTS, INITIAL_MOVEMENTS, INITIAL_NEGATIVE_REQUESTS, INITIAL_PRODUCTS, INITIAL_SETTINGS, INITIAL_USERS } from '../data/initialData';

interface AppContextType {
  currentUser: User;
  users: User[];
  setCurrentUserId: (id: string) => void;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
  updateUser: (user: User) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  deleteUser: (userId: string) => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  movements: StockMovement[];
  addMovement: (params: {
    productId: string;
    type: 'ENTRADA' | 'SAIDA';
    quantity: number;
    date?: string;
    withdrawnBy?: string;
    destination?: string;
    notes?: string;
    isNegativeStockAuthorized?: boolean;
    authorizedBy?: string;
  }) => { success: boolean; message?: string; stockAfter?: number };
  negativeRequests: NegativeStockRequest[];
  createNegativeStockRequest: (req: {
    productId: string;
    requestedQuantity: number;
    withdrawnBy: string;
    destination: string;
    reason: string;
  }) => { success: boolean; message?: string };
  approveNegativeStockRequest: (requestId: string) => { success: boolean; message?: string };
  rejectNegativeStockRequest: (requestId: string) => { success: boolean; message?: string };
  managedLists: ManagedLists;
  addGroup: (name: string) => boolean;
  editGroup: (oldName: string, newName: string) => boolean;
  deleteGroup: (name: string) => { success: boolean; message?: string };
  addRole: (name: string) => boolean;
  editRole: (oldName: string, newName: string) => boolean;
  deleteRole: (name: string) => boolean;
  addDestination: (name: string) => boolean;
  editDestination: (oldName: string, newName: string) => boolean;
  deleteDestination: (name: string) => boolean;
  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  canAccessTab: (tab: TabId, targetUser?: User) => boolean;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (product: Product | null) => void;
  resetAllData: () => void;
  availableTabsForCurrentUser: TabId[];
  pendingNegativeRequestsCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_USERS = 'qhs_engenharia_users_v3';
const STORAGE_KEY_PRODUCTS = 'qhs_engenharia_products_v3';
const STORAGE_KEY_MOVEMENTS = 'qhs_engenharia_movements_v3';
const STORAGE_KEY_SETTINGS = 'qhs_engenharia_settings_v3';
const STORAGE_KEY_CURRENT_USER = 'qhs_engenharia_current_user_v3';
const STORAGE_KEY_LISTS = 'qhs_engenharia_lists_v3';
const STORAGE_KEY_NEGATIVE_REQ = 'qhs_engenharia_neg_req_v3';

const ALL_TAB_IDS: TabId[] = [
  'dashboard',
  'produtos',
  'entradas',
  'saidas',
  'relatorios',
  'estatisticas',
  'configuracoes',
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Settings
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_SETTINGS;
  });

  // 2. Managed Lists (Grupos, Cargos, Destinos)
  const [managedLists, setManagedLists] = useState<ManagedLists>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LISTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_LISTS;
  });

  // 3. Users
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_USERS;
  });

  // 4. Current User ID
  const [currentUserId, setCurrentUserIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'user-admin';
  });

  // 5. Products
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_PRODUCTS;
  });

  // 6. Movements
  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_MOVEMENTS;
  });

  // 7. Negative Stock Requests
  const [negativeRequests, setNegativeRequests] = useState<NegativeStockRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NEGATIVE_REQ);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_NEGATIVE_REQUESTS;
  });

  // 8. Active Tab & Modals
  const [activeTab, setActiveTabState] = useState<TabId>('dashboard');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(managedLists));
    } catch {}
  }, [managedLists]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, currentUserId);
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(movements));
    } catch {}
  }, [movements]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NEGATIVE_REQ, JSON.stringify(negativeRequests));
    } catch {}
  }, [negativeRequests]);

  // Derived current user
  const currentUser: User = useMemo(() => {
    const found = users.find((u) => u.id === currentUserId);
    if (found) return found;
    return users[0] || INITIAL_USERS[0];
  }, [users, currentUserId]);

  // Check if a user can access a tab
  const canAccessTab = useCallback(
    (tab: TabId, targetUser?: User): boolean => {
      const user = targetUser || currentUser;
      if (!user) return false;
      if (user.isAdmin || user.role === 'Diretor de Engenharia & Admin' || user.role === 'ADMIN') {
        return true;
      }
      return Boolean(user.permissions && user.permissions[tab]);
    },
    [currentUser]
  );

  // Available tabs for current user
  const availableTabsForCurrentUser = useMemo(() => {
    return ALL_TAB_IDS.filter((tab) => canAccessTab(tab, currentUser));
  }, [canAccessTab, currentUser]);

  // Safe tab switcher
  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
  }, []);

  // Safe user switcher that switches tab if target user lacks access
  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id);
    const targetUser = users.find((u) => u.id === id);
    if (targetUser && !targetUser.isAdmin && targetUser.role !== 'ADMIN' && targetUser.role !== 'Diretor de Engenharia & Admin') {
      if (!targetUser.permissions[activeTab]) {
        const firstAllowed = ALL_TAB_IDS.find((tab) => targetUser.permissions[tab]);
        if (firstAllowed) {
          setActiveTabState(firstAllowed);
        }
      }
    }
  }, [users, activeTab]);

  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Managed Lists methods
  const addGroup = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (managedLists.groups.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    setManagedLists((prev) => ({ ...prev, groups: [...prev.groups, trimmed] }));
    return true;
  }, [managedLists.groups]);

  const editGroup = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    setManagedLists((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g === oldName ? trimmed : g)),
    }));
    // Update existing products with that group
    setProducts((prev) =>
      prev.map((p) => (p.group === oldName ? { ...p, group: trimmed } : p))
    );
    // Update movements group
    setMovements((prev) =>
      prev.map((m) => (m.group === oldName ? { ...m, group: trimmed } : m))
    );
    return true;
  }, []);

  const deleteGroup = useCallback((name: string) => {
    // Check if products are using this group
    const inUse = products.some((p) => p.group === name);
    if (inUse) {
      return {
        success: false,
        message: `O grupo "${name}" não pode ser excluído pois existem produtos cadastrados com este grupo. Altere os produtos primeiro ou edite o nome do grupo.`,
      };
    }
    setManagedLists((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g !== name),
    }));
    return { success: true };
  }, [products]);

  const addRole = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (managedLists.roles.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return false;
    setManagedLists((prev) => ({ ...prev, roles: [...prev.roles, trimmed] }));
    return true;
  }, [managedLists.roles]);

  const editRole = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    setManagedLists((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r === oldName ? trimmed : r)),
    }));
    setUsers((prev) =>
      prev.map((u) => (u.role === oldName ? { ...u, role: trimmed } : u))
    );
    return true;
  }, []);

  const deleteRole = useCallback((name: string) => {
    setManagedLists((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r !== name),
    }));
    return true;
  }, []);

  const addDestination = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if (managedLists.destinations.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return false;
    setManagedLists((prev) => ({ ...prev, destinations: [...prev.destinations, trimmed] }));
    return true;
  }, [managedLists.destinations]);

  const editDestination = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    setManagedLists((prev) => ({
      ...prev,
      destinations: prev.destinations.map((d) => (d === oldName ? trimmed : d)),
    }));
    return true;
  }, []);

  const deleteDestination = useCallback((name: string) => {
    setManagedLists((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((d) => d !== name),
    }));
    return true;
  }, []);

  // User Management
  const updateUserPermissions = useCallback((userId: string, permissions: UserPermissions) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, permissions: { ...permissions } } : u))
    );
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  }, []);

  const addUser = useCallback((newUser: Omit<User, 'id' | 'createdAt'>) => {
    const id = `user-${Date.now()}`;
    const createdAt = new Date().toISOString().split('T')[0];
    setUsers((prev) => [...prev, { ...newUser, id, createdAt }]);
  }, []);

  const deleteUser = useCallback((userId: string) => {
    if (userId === 'user-admin') return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setCurrentUserIdState((prev) => (prev === userId ? 'user-admin' : prev));
  }, []);

  // Product Management
  const addProduct = useCallback((prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `prod-${Date.now()}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    const newProduct: Product = {
      ...prodData,
      id,
      createdAt: today,
      updatedAt: formattedDate,
    };
    setProducts((prev) => [newProduct, ...prev]);
  }, []);

  const updateProduct = useCallback((updatedProduct: Product) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? { ...updatedProduct, updatedAt: formattedDate } : p))
    );
  }, []);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  // Movement Management (Entradas e Saídas com cálculo de saldo imediato)
  const addMovement = useCallback((params: {
    productId: string;
    type: 'ENTRADA' | 'SAIDA';
    quantity: number;
    date?: string;
    withdrawnBy?: string;
    destination?: string;
    notes?: string;
    isNegativeStockAuthorized?: boolean;
    authorizedBy?: string;
  }) => {
    const product = products.find((p) => p.id === params.productId);
    if (!product) {
      return { success: false, message: 'Produto não encontrado.' };
    }

    // Validação de estoque negativo se não autorizado
    if (params.type === 'SAIDA' && !params.isNegativeStockAuthorized) {
      if (product.currentStock < params.quantity) {
        return {
          success: false,
          message: `Estoque insuficiente! Disponível: ${product.currentStock}. Solicitado: ${params.quantity}. Solicite autorização ao Administrador para liberar saída com saldo negativo.`,
        };
      }
    }

    const now = new Date();
    const formattedDate =
      params.date ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newStock =
      params.type === 'ENTRADA'
        ? product.currentStock + params.quantity
        : product.currentStock - params.quantity;

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      group: product.group,
      type: params.type,
      quantity: params.quantity,
      stockAfterMovement: newStock,
      date: formattedDate,
      withdrawnBy: params.withdrawnBy,
      responsibleUser: currentUser.name,
      destination: params.destination,
      notes: params.notes,
      isNegativeStockAuthorized: params.isNegativeStockAuthorized,
      authorizedBy: params.authorizedBy,
    };

    // Update product stock
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, currentStock: newStock, updatedAt: formattedDate } : p
      )
    );

    // Record movement
    setMovements((prev) => [newMovement, ...prev]);

    return { success: true, stockAfter: newStock };
  }, [products, currentUser.name]);

  // Negative Stock Authorization Workflow
  const createNegativeStockRequest = useCallback((req: {
    productId: string;
    requestedQuantity: number;
    withdrawnBy: string;
    destination: string;
    reason: string;
  }) => {
    const product = products.find((p) => p.id === req.productId);
    if (!product) return { success: false, message: 'Produto não encontrado.' };

    const deficit = req.requestedQuantity - product.currentStock;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newReq: NegativeStockRequest = {
      id: `req-neg-${Date.now()}`,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      group: product.group,
      requestedQuantity: req.requestedQuantity,
      availableStock: product.currentStock,
      deficitQuantity: deficit,
      withdrawnBy: req.withdrawnBy,
      destination: req.destination,
      requestedBy: currentUser.name,
      reason: req.reason,
      date: formattedDate,
      status: 'PENDENTE',
    };

    setNegativeRequests((prev) => [newReq, ...prev]);
    return {
      success: true,
      message: 'Solicitação de liberação excepcional enviada ao Administrador.',
    };
  }, [products, currentUser.name]);

  const approveNegativeStockRequest = useCallback((requestId: string) => {
    const req = negativeRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, message: 'Solicitação não encontrada.' };
    if (req.status !== 'PENDENTE') {
      return { success: false, message: 'Esta solicitação já foi analisada.' };
    }

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Execute the movement with isNegativeStockAuthorized = true
    const movResult = addMovement({
      productId: req.productId,
      type: 'SAIDA',
      quantity: req.requestedQuantity,
      withdrawnBy: req.withdrawnBy,
      destination: req.destination,
      notes: `[AUTORIZAÇÃO EXCEPCIONAL ADMINISTRADOR: ${currentUser.name}] Motivo: ${req.reason}`,
      isNegativeStockAuthorized: true,
      authorizedBy: currentUser.name,
    });

    if (!movResult.success) {
      return movResult;
    }

    // Update request status
    setNegativeRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'APROVADO',
              reviewedBy: currentUser.name,
              reviewedAt: formattedDate,
            }
          : r
      )
    );

    return {
      success: true,
      message: `Saída de ${req.requestedQuantity} un do produto ${req.productCode} autorizada com sucesso pelo Administrador.`,
    };
  }, [negativeRequests, addMovement, currentUser.name]);

  const rejectNegativeStockRequest = useCallback((requestId: string) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setNegativeRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'RECUSADO',
              reviewedBy: currentUser.name,
              reviewedAt: formattedDate,
            }
          : r
      )
    );

    return { success: true, message: 'Solicitação recusada pelo Administrador.' };
  }, [currentUser.name]);

  const resetAllData = useCallback(() => {
    setSettings(INITIAL_SETTINGS);
    setManagedLists(INITIAL_LISTS);
    setUsers(INITIAL_USERS);
    setProducts(INITIAL_PRODUCTS);
    setMovements(INITIAL_MOVEMENTS);
    setNegativeRequests(INITIAL_NEGATIVE_REQUESTS);
    setCurrentUserIdState('user-admin');
    setActiveTabState('dashboard');
    try {
      localStorage.removeItem(STORAGE_KEY_SETTINGS);
      localStorage.removeItem(STORAGE_KEY_LISTS);
      localStorage.removeItem(STORAGE_KEY_USERS);
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
      localStorage.removeItem(STORAGE_KEY_PRODUCTS);
      localStorage.removeItem(STORAGE_KEY_MOVEMENTS);
      localStorage.removeItem(STORAGE_KEY_NEGATIVE_REQ);
    } catch {}
  }, []);

  const pendingNegativeRequestsCount = useMemo(() => {
    return negativeRequests.filter((r) => r.status === 'PENDENTE').length;
  }, [negativeRequests]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUserId,
        updateUserPermissions,
        updateUser,
        addUser,
        deleteUser,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        movements,
        addMovement,
        negativeRequests,
        createNegativeStockRequest,
        approveNegativeStockRequest,
        rejectNegativeStockRequest,
        managedLists,
        addGroup,
        editGroup,
        deleteGroup,
        addRole,
        editRole,
        deleteRole,
        addDestination,
        editDestination,
        deleteDestination,
        settings,
        updateSettings,
        activeTab,
        setActiveTab,
        canAccessTab,
        selectedProductForModal,
        setSelectedProductForModal,
        resetAllData,
        availableTabsForCurrentUser,
        pendingNegativeRequestsCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
