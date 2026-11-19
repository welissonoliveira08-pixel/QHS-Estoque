import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  User as FirebaseUser,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, googleProvider } from '../firebase';
import {
  ApiError,
  approveAccessRequestApi,
  approveDeletionRequestApi,
  approveNegativeRequestApi,
  BootstrapResponse,
  createCollaboratorApi,
  createDeletionRequestApi,
  createNegativeRequestApi,
  createProductApi,
  createUserApi,
  deleteCollaboratorApi,
  deleteMovementApi,
  deleteNegativeRequestApi,
  deleteProductApi,
  deleteUserApi,
  fetchBootstrapData,
  patchShowProductPhotosApi,
  recordMovementApi,
  rejectAccessRequestApi,
  rejectDeletionRequestApi,
  rejectNegativeRequestApi,
  requestAccessApi,
  resetAllDataApi,
  toggleCollaboratorActiveApi,
  updateCollaboratorApi,
  updateManagedListsApi,
  updateProductApi,
  updateSettingsApi,
  updateUserApi,
  updateUserDeletePermissionApi,
  updateUserPermissionsApi,
  verifyEmailInviteApi,
} from '../services/apiService';
import {
  AccessRequest,
  Collaborator,
  DeletionLog,
  DeletionRecordType,
  DeletionRequest,
  ManagedLists,
  NegativeStockRequest,
  Product,
  StockMovement,
  SystemSettings,
  TabId,
  User,
  UserPermissions,
} from '../types';
import { INITIAL_LISTS, INITIAL_SETTINGS, INITIAL_USERS } from '../data/initialData';

export type AccessStatus =
  | 'loading'
  | 'unauthenticated'
  | 'email_unverified'
  | 'unauthorized'
  | 'server_error'
  | 'ready';
export type SettingsSubTab =
  | 'listas'
  | 'permissoes'
  | 'autorizacoes'
  | 'exclusoes'
  | 'fotos'
  | 'empresa';

interface AppContextType {
  firebaseUser: FirebaseUser | null;
  accessStatus: AccessStatus;
  authError: string | null;
  isRealAdmin: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  registerFirstAccessWithEmail: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; message?: string }>;
  checkEmailVerified: () => Promise<{ verified: boolean; message?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>;
  linkOrUpdateEmailPassword: (
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;
  retryBootstrap: () => Promise<boolean>;
  submitAccessRequest: (params: {
    name: string;
    email: string;
    role?: string;
    department?: string;
    reason?: string;
  }) => Promise<{ success: boolean; alreadyAuthorized?: boolean; message: string }>;
  accessRequests: AccessRequest[];
  pendingAccessRequestsCount: number;
  approveAccessRequest: (
    requestId: string,
    options?: {
      role?: string;
      department?: string;
      canDelete?: boolean;
      permissions?: Partial<UserPermissions>;
    }
  ) => Promise<{ success: boolean; message?: string }>;
  rejectAccessRequest: (requestId: string) => Promise<{ success: boolean; message?: string }>;
  currentUser: User;
  canDeleteDirectly: boolean;
  users: User[];
  setCurrentUserId: (id: string) => void;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
  updateUserDeletePermission: (userId: string, canDelete: boolean) => void;
  updateUser: (user: User) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  deleteUser: (userId: string) => void;
  collaborators: Collaborator[];
  addCollaborator: (params: {
    fullName: string;
    role?: string;
    active?: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
  updateCollaborator: (params: {
    id: string;
    fullName: string;
    role?: string;
    active: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
  toggleCollaboratorActive: (
    collaboratorId: string
  ) => Promise<{ success: boolean; message?: string }>;
  deleteCollaborator: (
    collaboratorId: string
  ) => Promise<{ success: boolean; message?: string }>;
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => Promise<{ success: boolean; message?: string }>;
  movements: StockMovement[];
  addMovement: (params: {
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
  }) => { success: boolean; message?: string; stockAfter?: number };
  deleteMovement: (movementId: string) => Promise<{
    success: boolean;
    message?: string;
    newStock?: number;
    productUpdated?: boolean;
  }>;
  negativeRequests: NegativeStockRequest[];
  createNegativeStockRequest: (req: {
    productId: string;
    requestedQuantity: number;
    withdrawnBy: string;
    collaboratorId?: string;
    destination: string;
    reason: string;
  }) => { success: boolean; message?: string };
  approveNegativeStockRequest: (requestId: string) => { success: boolean; message?: string };
  rejectNegativeStockRequest: (requestId: string) => { success: boolean; message?: string };
  deleteNegativeStockRequest: (
    requestId: string
  ) => Promise<{ success: boolean; message?: string }>;
  deletionRequests: DeletionRequest[];
  deletionLogs: DeletionLog[];
  pendingDeletionRequestsCount: number;
  createDeletionRequest: (params: {
    recordType: DeletionRecordType;
    targetId: string;
    targetCode: string;
    targetName: string;
    targetDetails: string;
    quantity: number;
    reason: string;
  }) => Promise<{ success: boolean; message?: string }>;
  approveDeletionRequest: (requestId: string) => Promise<{ success: boolean; message?: string }>;
  rejectDeletionRequest: (requestId: string) => Promise<{ success: boolean; message?: string }>;
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
  settingsInitialSubTab: SettingsSubTab;
  setSettingsInitialSubTab: (subTab: SettingsSubTab) => void;
  openSettingsSubTab: (subTab: SettingsSubTab) => void;
  canAccessTab: (tab: TabId, targetUser?: User) => boolean;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (product: Product | null) => void;
  resetAllData: () => void;
  availableTabsForCurrentUser: TabId[];
  pendingNegativeRequestsCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ALL_TAB_IDS: TabId[] = [
  'dashboard',
  'produtos',
  'entradas',
  'saidas',
  'colaboradores',
  'relatorios',
  'estatisticas',
  'configuracoes',
];

const FALLBACK_OWNER_USER: User = {
  id: 'user-owner',
  name: 'Administrador QHS',
  email: BOOTSTRAPPED_ADMIN_EMAIL,
  role: 'Diretor de Engenharia & Admin',
  department: 'Diretoria Técnica',
  isAdmin: true,
  canDelete: true,
  active: true,
  createdAt: '',
  permissions: {
    dashboard: true,
    produtos: true,
    entradas: true,
    saidas: true,
    colaboradores: true,
    relatorios: true,
    estatisticas: true,
    configuracoes: true,
  },
};

function formatDateToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateTimeNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function normalizePermissions(perms?: Partial<UserPermissions> | null): UserPermissions {
  return {
    dashboard: Boolean(perms?.dashboard),
    produtos: Boolean(perms?.produtos),
    entradas: Boolean(perms?.entradas),
    saidas: Boolean(perms?.saidas),
    colaboradores:
      perms?.colaboradores !== undefined ? Boolean(perms.colaboradores) : Boolean(perms?.saidas),
    relatorios: Boolean(perms?.relatorios),
    estatisticas: Boolean(perms?.estatisticas),
    configuracoes: Boolean(perms?.configuracoes),
  };
}

function translateFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Endereço de e-mail inválido.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada no sistema.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha do aplicativo incorretos. Se você usa Gmail e nunca criou uma senha neste app (não é a senha da sua conta Google), clique em "Continuar com conta Google" ou defina uma senha pelo link abaixo.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui conta vinculada (por exemplo, via Google). Entre pelo botão "Continuar com conta Google" ou clique abaixo para definir uma senha por e-mail.';
    case 'auth/weak-password':
      return 'A senha deve conter pelo menos 6 caracteres.';
    case 'auth/requires-recent-login':
      return 'Por segurança, saia e entre novamente antes de alterar sua senha.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login por E-mail/Senha ainda não foi ativado no Firebase Authentication do projeto.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login do Google. Aguarde o redirecionamento ou permita pop-ups.';
    case 'auth/popup-closed-by-user':
      return 'A janela de login do Google foi fechada antes de concluir a entrada.';
    case 'auth/unauthorized-domain':
      return 'Este domínio ainda não foi liberado nos Domínios Autorizados do Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com a internet ao autenticar. Verifique sua rede e tente novamente.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Não foi possível concluir a autenticação.';
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRealAdmin, setIsRealAdmin] = useState<boolean>(false);

  // Domain states synced from PostgreSQL via Express API
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [managedLists, setManagedLists] = useState<ManagedLists>(INITIAL_LISTS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [currentUserId, setCurrentUserIdState] = useState<string>('user-owner');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [negativeRequests, setNegativeRequests] = useState<NegativeStockRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [deletionLogs, setDeletionLogs] = useState<DeletionLog[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  // Active Tab & Modal
  const [activeTab, setActiveTabState] = useState<TabId>('dashboard');
  const [settingsInitialSubTab, setSettingsInitialSubTab] = useState<SettingsSubTab>('listas');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyBootstrapData = useCallback((data: BootstrapResponse) => {
    setIsRealAdmin(Boolean(data.currentUser.isAdmin));
    setUsers(data.users.length > 0 ? data.users : INITIAL_USERS);
    setCurrentUserIdState((prev) => {
      if (data.currentUser.isAdmin && data.users.some((u) => u.id === prev)) {
        return prev;
      }
      return data.currentUser.id;
    });
    setCollaborators(data.collaborators);
    setProducts(data.products);
    setMovements(data.movements);
    setNegativeRequests(data.negativeRequests);
    setDeletionRequests(data.deletionRequests);
    setDeletionLogs(data.deletionLogs);
    setAccessRequests(Array.isArray(data.accessRequests) ? data.accessRequests : []);
    setManagedLists(data.managedLists);
    setSettings(data.settings);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const data = await fetchBootstrapData();
      applyBootstrapData(data);
    } catch (err) {
      console.error('Failed to refresh bootstrap data:', err);
    }
  }, [applyBootstrapData]);

  const loadAuthorizedSession = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) {
      setAccessStatus('unauthenticated');
      return false;
    }
    setAccessStatus('loading');
    setAuthError(null);
    try {
      const data = await fetchBootstrapData();
      applyBootstrapData(data);
      setAccessStatus('ready');
      return true;
    } catch (err) {
      console.error('Auth/bootstrap initialization error:', err);
      setIsRealAdmin(false);
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao conectar ao servidor.';
      setAuthError(msg);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setAccessStatus('unauthorized');
      } else {
        setAccessStatus('server_error');
      }
      return false;
    }
  }, [applyBootstrapData]);

  // Capture Google redirect result (mobile fallback)
  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code && code !== 'auth/no-auth-event') {
        setAuthError(translateFirebaseAuthError(err));
      }
    });
  }, []);

  // Auth listener & Bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthError(null);

      if (!fbUser) {
        setIsRealAdmin(false);
        setProducts([]);
        setMovements([]);
        setCollaborators([]);
        setNegativeRequests([]);
        setDeletionRequests([]);
        setDeletionLogs([]);
        setAccessRequests([]);
        setAccessStatus('unauthenticated');
        return;
      }

      if (!fbUser.emailVerified) {
        setIsRealAdmin(false);
        setAccessStatus('email_unverified');
        return;
      }

      await loadAuthorizedSession();
    });

    return () => unsubscribe();
  }, [loadAuthorizedSession]);

  // Keep connected clients synchronized with Cloud SQL & Supabase
  useEffect(() => {
    if (accessStatus !== 'ready') return;

    const handleVisibleOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshBootstrap();
      }
    };

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshBootstrap();
      }
    }, 20000);

    window.addEventListener('focus', handleVisibleOrFocus);
    document.addEventListener('visibilitychange', handleVisibleOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibleOrFocus);
      document.removeEventListener('visibilitychange', handleVisibleOrFocus);
    };
  }, [accessStatus, refreshBootstrap]);

  useEffect(() => {
    return () => {
      if (settingsTimerRef.current) {
        clearTimeout(settingsTimerRef.current);
      }
    };
  }, []);

  // Auth Actions
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'Informe seu e-mail e senha para entrar.' };
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      return { success: true };
    } catch (err) {
      const msg = translateFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, message: msg };
    }
  }, []);

  const registerFirstAccessWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido.' };
    }
    if (password.length < 6) {
      return { success: false, message: 'Crie uma senha com pelo menos 6 caracteres.' };
    }

    try {
      await verifyEmailInviteApi(cleanEmail);
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await sendEmailVerification(cred.user);
      return {
        success: true,
        message: `Conta criada! Enviamos um link de confirmação para ${cleanEmail}.`,
      };
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : translateFirebaseAuthError(err);
      setAuthError(msg);
      return { success: false, message: msg };
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      return { success: false, message: 'Sessão não encontrada.' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      return {
        success: true,
        message: `Novo link de confirmação enviado para ${auth.currentUser.email}.`,
      };
    } catch (err) {
      return { success: false, message: translateFirebaseAuthError(err) };
    }
  }, []);

  const checkEmailVerified = useCallback(async () => {
    if (!auth.currentUser) {
      return { verified: false, message: 'Usuário não autenticado.' };
    }
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        return {
          verified: false,
          message:
            'Seu e-mail ainda não foi confirmado. Clique no link enviado para sua caixa de entrada (ou spam) e tente novamente.',
        };
      }
      await auth.currentUser.getIdToken(true);
      const ok = await loadAuthorizedSession();
      if (!ok) {
        return {
          verified: false,
          message: authError || 'Não foi possível validar o acesso no servidor.',
        };
      }
      return { verified: true };
    } catch (err) {
      const msg =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Erro ao validar acesso.';
      setAuthError(msg);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setAccessStatus('unauthorized');
      } else {
        setAccessStatus('server_error');
      }
      return { verified: false, message: msg };
    }
  }, [authError, loadAuthorizedSession]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido.' };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: `Link enviado para ${cleanEmail}! Abra seu e-mail (confira também o spam), crie sua senha para este aplicativo e depois faça login com ela.`,
      };
    } catch (err) {
      return { success: false, message: translateFirebaseAuthError(err) };
    }
  }, []);

  const linkOrUpdateEmailPassword = useCallback(async (newPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, message: 'Usuário não autenticado.' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'A senha deve ter no mínimo 6 caracteres.' };
    }
    try {
      const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
      if (hasPasswordProvider) {
        await updatePassword(user, newPassword);
      } else {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, credential);
      }
      return {
        success: true,
        message: `Senha do aplicativo salva para ${user.email}! Agora você pode entrar com e-mail e senha ou com Google.`,
      };
    } catch (err) {
      return { success: false, message: translateFirebaseAuthError(err) };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setAuthError(translateFirebaseAuthError(redirectErr));
          return;
        }
      }
      setAuthError(translateFirebaseAuthError(err));
    }
  }, []);

  const signOutGoogle = useCallback(async () => {
    try {
      await signOut(auth);
      setActiveTabState('dashboard');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, []);

  const retryBootstrap = useCallback(async () => {
    return loadAuthorizedSession();
  }, [loadAuthorizedSession]);

  const submitAccessRequest = useCallback(
    async (params: {
      name: string;
      email: string;
      role?: string;
      department?: string;
      reason?: string;
    }) => {
      try {
        const res = await requestAccessApi(params);
        return {
          success: true,
          alreadyAuthorized: Boolean(res.alreadyAuthorized),
          message: res.message,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível enviar o pedido de acesso ao servidor.',
        };
      }
    },
    []
  );

  const approveAccessRequest = useCallback(
    async (
      requestId: string,
      options?: {
        role?: string;
        department?: string;
        canDelete?: boolean;
        permissions?: Partial<UserPermissions>;
      }
    ) => {
      if (!firebaseUser || !isRealAdmin) {
        return {
          success: false,
          message: 'Apenas o Administrador principal pode aprovar pedidos de acesso.',
        };
      }
      try {
        const res = await approveAccessRequestApi(requestId, options);
        await refreshBootstrap();
        return {
          success: true,
          message: `Acesso liberado para ${res.user.name} (${res.user.email}) e sincronizado com o Supabase!`,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível aprovar o pedido de acesso.',
        };
      }
    },
    [firebaseUser, isRealAdmin, refreshBootstrap]
  );

  const rejectAccessRequest = useCallback(
    async (requestId: string) => {
      if (!firebaseUser || !isRealAdmin) {
        return {
          success: false,
          message: 'Apenas o Administrador principal pode recusar pedidos de acesso.',
        };
      }
      try {
        const res = await rejectAccessRequestApi(requestId);
        await refreshBootstrap();
        return {
          success: true,
          message: `Pedido de ${res.request.name} recusado.`,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível recusar o pedido de acesso.',
        };
      }
    },
    [firebaseUser, isRealAdmin, refreshBootstrap]
  );

  // Derived current user
  const currentUser: User = useMemo(() => {
    const found = users.find((u) => u.id === currentUserId);
    if (found) return found;
    return users[0] || FALLBACK_OWNER_USER;
  }, [users, currentUserId]);

  const canDeleteDirectly = useMemo(
    () => Boolean(currentUser.isAdmin || currentUser.canDelete),
    [currentUser]
  );

  const canAccessTab = useCallback(
    (tab: TabId, targetUser?: User): boolean => {
      const user = targetUser || currentUser;
      if (!user) return false;
      if (
        user.isAdmin ||
        user.role === 'Diretor de Engenharia & Admin' ||
        user.role === 'ADMIN'
      ) {
        return true;
      }
      return Boolean(user.permissions && user.permissions[tab]);
    },
    [currentUser]
  );

  const availableTabsForCurrentUser = useMemo(() => {
    return ALL_TAB_IDS.filter((tab) => canAccessTab(tab, currentUser));
  }, [canAccessTab, currentUser]);

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
  }, []);

  const openSettingsSubTab = useCallback((subTab: SettingsSubTab) => {
    setSettingsInitialSubTab(subTab);
    setActiveTabState('configuracoes');
  }, []);

  // Safe user switcher (only available to Admin for testing permissions)
  const setCurrentUserId = useCallback(
    (id: string) => {
      if (!isRealAdmin) return;
      setCurrentUserIdState(id);
      const targetUser = users.find((u) => u.id === id);
      if (
        targetUser &&
        !targetUser.isAdmin &&
        targetUser.role !== 'ADMIN' &&
        targetUser.role !== 'Diretor de Engenharia & Admin'
      ) {
        if (!targetUser.permissions[activeTab]) {
          const firstAllowed = ALL_TAB_IDS.find((tab) => targetUser.permissions[tab]);
          if (firstAllowed) {
            setActiveTabState(firstAllowed);
          }
        }
      }
    },
    [isRealAdmin, users, activeTab]
  );

  // Settings Update
  const updateSettings = useCallback(
    (newSettings: Partial<SystemSettings>) => {
      const keys = Object.keys(newSettings);
      const isPhotoToggleOnly =
        keys.length === 1 && newSettings.showProductPhotos !== undefined;

      setSettings((prev) => {
        const merged = { ...prev, ...newSettings };
        if (isPhotoToggleOnly) {
          void patchShowProductPhotosApi(Boolean(newSettings.showProductPhotos)).catch((err) => {
            console.error('Error updating photo toggle:', err);
          });
        } else if (isRealAdmin) {
          if (settingsTimerRef.current) {
            clearTimeout(settingsTimerRef.current);
          }
          settingsTimerRef.current = setTimeout(() => {
            void updateSettingsApi(merged).catch((err) => {
              console.error('Error updating settings:', err);
            });
          }, 250);
        }
        return merged;
      });
    },
    [isRealAdmin]
  );

  // Managed Lists methods
  const addGroup = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (managedLists.groups.some((g) => g.toLowerCase() === trimmed.toLowerCase())) {
        return false;
      }
      const next = { ...managedLists, groups: [...managedLists.groups, trimmed] };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const editGroup = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return false;
      const next = {
        ...managedLists,
        groups: managedLists.groups.map((g) => (g === oldName ? trimmed : g)),
      };
      setManagedLists(next);
      setProducts((prev) => prev.map((p) => (p.group === oldName ? { ...p, group: trimmed } : p)));
      setMovements((prev) => prev.map((m) => (m.group === oldName ? { ...m, group: trimmed } : m)));
      void updateManagedListsApi({
        lists: next,
        renameGroup: { oldName, newName: trimmed },
      }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const deleteGroup = useCallback(
    (name: string) => {
      const inUse = products.some((p) => p.group === name);
      if (inUse) {
        return {
          success: false,
          message: `O grupo "${name}" não pode ser excluído pois existem produtos cadastrados com este grupo. Altere os produtos primeiro ou edite o nome do grupo.`,
        };
      }
      const next = {
        ...managedLists,
        groups: managedLists.groups.filter((g) => g !== name),
      };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return { success: true };
    },
    [products, managedLists, refreshBootstrap]
  );

  const addRole = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (managedLists.roles.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return false;
      const next = { ...managedLists, roles: [...managedLists.roles, trimmed] };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const editRole = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return false;
      const next = {
        ...managedLists,
        roles: managedLists.roles.map((r) => (r === oldName ? trimmed : r)),
      };
      setManagedLists(next);
      setUsers((prev) => prev.map((u) => (u.role === oldName ? { ...u, role: trimmed } : u)));
      void updateManagedListsApi({
        lists: next,
        renameRole: { oldName, newName: trimmed },
      }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const deleteRole = useCallback(
    (name: string) => {
      const next = {
        ...managedLists,
        roles: managedLists.roles.filter((r) => r !== name),
      };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const addDestination = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (managedLists.destinations.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
        return false;
      }
      const next = {
        ...managedLists,
        destinations: [...managedLists.destinations, trimmed],
      };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const editDestination = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return false;
      const next = {
        ...managedLists,
        destinations: managedLists.destinations.map((d) => (d === oldName ? trimmed : d)),
      };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  const deleteDestination = useCallback(
    (name: string) => {
      const next = {
        ...managedLists,
        destinations: managedLists.destinations.filter((d) => d !== name),
      };
      setManagedLists(next);
      void updateManagedListsApi({ lists: next }).then(() => refreshBootstrap());
      return true;
    },
    [managedLists, refreshBootstrap]
  );

  // User Management (Principal Admin only)
  const updateUserPermissions = useCallback(
    (userId: string, permissions: UserPermissions) => {
      if (!isRealAdmin) return;
      const cleanPerms = normalizePermissions(permissions);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, permissions: cleanPerms } : u))
      );
      void updateUserPermissionsApi(userId, cleanPerms).then(() => refreshBootstrap());
    },
    [isRealAdmin, refreshBootstrap]
  );

  const updateUserDeletePermission = useCallback(
    (userId: string, canDelete: boolean) => {
      if (!isRealAdmin) return;
      const target = users.find((u) => u.id === userId);
      if (!target || target.isAdmin) return;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, canDelete: Boolean(canDelete) } : u))
      );
      void updateUserDeletePermissionApi(userId, Boolean(canDelete)).then(() => refreshBootstrap());
    },
    [isRealAdmin, users, refreshBootstrap]
  );

  const updateUser = useCallback(
    (updatedUser: User) => {
      if (!isRealAdmin) return;
      const emailLower = updatedUser.email.trim().toLowerCase();
      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? { ...updatedUser, email: emailLower } : u))
      );
      void updateUserApi({ ...updatedUser, email: emailLower }).then(() => refreshBootstrap());
    },
    [isRealAdmin, refreshBootstrap]
  );

  const addUser = useCallback(
    (newUser: Omit<User, 'id' | 'createdAt'>) => {
      if (!isRealAdmin) return;
      const tempUser: User = {
        ...newUser,
        id: `user-${Date.now()}`,
        email: newUser.email.trim().toLowerCase(),
        createdAt: formatDateToday(),
      };
      setUsers((prev) => [...prev, tempUser]);
      void createUserApi(newUser).then(() => refreshBootstrap());
    },
    [isRealAdmin, refreshBootstrap]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      if (!isRealAdmin || userId === 'user-owner') return;
      setCurrentUserIdState((prev) => (prev === userId ? 'user-owner' : prev));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      void deleteUserApi(userId).then(() => refreshBootstrap());
    },
    [isRealAdmin, refreshBootstrap]
  );

  // Field Collaborators Management (Does NOT create app login or user accounts)
  const addCollaborator = useCallback(
    async (params: { fullName: string; role?: string; active?: boolean }) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      const trimmedName = params.fullName.trim();
      if (trimmedName.length < 2) {
        return {
          success: false,
          message: 'Informe o nome completo do colaborador (mínimo 2 caracteres).',
        };
      }
      try {
        await createCollaboratorApi({
          fullName: trimmedName,
          role: params.role?.trim() || '',
          active: params.active ?? true,
        });
        await refreshBootstrap();
        return {
          success: true,
          message: `Colaborador "${trimmedName}" cadastrado com sucesso (sem acesso ao aplicativo).`,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível cadastrar o colaborador.',
        };
      }
    },
    [firebaseUser, refreshBootstrap]
  );

  const updateCollaborator = useCallback(
    async (params: { id: string; fullName: string; role?: string; active: boolean }) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      const trimmedName = params.fullName.trim();
      if (trimmedName.length < 2) {
        return {
          success: false,
          message: 'Informe o nome completo do colaborador (mínimo 2 caracteres).',
        };
      }
      try {
        await updateCollaboratorApi({
          id: params.id,
          fullName: trimmedName,
          role: params.role?.trim() || '',
          active: Boolean(params.active),
        });
        await refreshBootstrap();
        return {
          success: true,
          message: `Colaborador "${trimmedName}" atualizado com sucesso.`,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível atualizar o colaborador.',
        };
      }
    },
    [firebaseUser, refreshBootstrap]
  );

  const toggleCollaboratorActive = useCallback(
    async (collaboratorId: string) => {
      const target = collaborators.find((c) => c.id === collaboratorId);
      if (!target) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }
      try {
        const updated = await toggleCollaboratorActiveApi(collaboratorId);
        await refreshBootstrap();
        return {
          success: true,
          message: updated.active
            ? `Colaborador "${updated.fullName}" reativado para novas retiradas.`
            : `Colaborador "${updated.fullName}" inativado. Seu histórico de retiradas foi mantido.`,
        };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível alterar o status do colaborador.',
        };
      }
    },
    [collaborators, refreshBootstrap]
  );

  const deleteCollaborator = useCallback(
    async (collaboratorId: string) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      if (!canDeleteDirectly) {
        return {
          success: false,
          message:
            'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
        };
      }
      try {
        const res = await deleteCollaboratorApi(collaboratorId);
        await refreshBootstrap();
        return {
          success: true,
          message: `Colaborador "${res.deletedName}" excluído do cadastro com sucesso.`,
        };
      } catch (err) {
        console.error('Erro ao excluir colaborador:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível excluir o colaborador no banco de dados.',
        };
      }
    },
    [firebaseUser, canDeleteDirectly, refreshBootstrap]
  );

  // Product Management
  const addProduct = useCallback(
    (prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!firebaseUser) return;
      const now = formatDateTimeNow();
      const tempProd: Product = {
        ...prodData,
        id: `prod-${Date.now()}`,
        createdAt: formatDateToday(),
        updatedAt: now,
      };
      setProducts((prev) => [tempProd, ...prev]);
      void createProductApi(prodData).then(() => refreshBootstrap());
    },
    [firebaseUser, refreshBootstrap]
  );

  const updateProduct = useCallback(
    (updatedProduct: Product) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
      void updateProductApi(updatedProduct).then(() => refreshBootstrap());
    },
    [refreshBootstrap]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      if (!canDeleteDirectly) {
        return {
          success: false,
          message:
            'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
        };
      }
      try {
        await deleteProductApi(productId);
        setSelectedProductForModal((prev) => (prev?.id === productId ? null : prev));
        await refreshBootstrap();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível excluir o produto no banco de dados.',
        };
      }
    },
    [firebaseUser, canDeleteDirectly, refreshBootstrap]
  );

  // Movement Management
  const addMovement = useCallback(
    (params: {
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
    }) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      const product = products.find((p) => p.id === params.productId);
      if (!product) {
        return { success: false, message: 'Produto não encontrado.' };
      }

      if (params.type === 'SAIDA' && !params.isNegativeStockAuthorized) {
        if (product.currentStock < params.quantity) {
          return {
            success: false,
            message: `Estoque insuficiente! Disponível: ${product.currentStock}. Solicitado: ${params.quantity}. Solicite autorização ao Administrador para liberar saída com saldo negativo.`,
          };
        }
      }

      const formattedDate = params.date || formatDateTimeNow();
      const newStock =
        params.type === 'ENTRADA'
          ? product.currentStock + params.quantity
          : product.currentStock - params.quantity;

      const movId = `mov-${Date.now()}`;
      const matchedCollab = params.collaboratorId
        ? collaborators.find((c) => c.id === params.collaboratorId)
        : undefined;
      const resolvedWithdrawnBy = matchedCollab?.fullName || params.withdrawnBy;

      const optimisticMov: StockMovement = {
        id: movId,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        group: product.group,
        type: params.type,
        quantity: params.quantity,
        stockAfterMovement: newStock,
        date: formattedDate,
        withdrawnBy: resolvedWithdrawnBy,
        collaboratorId: params.collaboratorId,
        responsibleUser: currentUser.name,
        destination: params.destination,
        notes: params.notes,
        isNegativeStockAuthorized: params.isNegativeStockAuthorized,
        authorizedBy: params.authorizedBy,
      };

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, currentStock: newStock, updatedAt: formattedDate } : p
        )
      );
      setMovements((prev) => [optimisticMov, ...prev]);

      void recordMovementApi({
        id: movId,
        productId: params.productId,
        type: params.type,
        quantity: params.quantity,
        date: formattedDate,
        withdrawnBy: resolvedWithdrawnBy,
        collaboratorId: params.collaboratorId,
        destination: params.destination,
        notes: params.notes,
        isNegativeStockAuthorized: params.isNegativeStockAuthorized,
        authorizedBy: params.authorizedBy,
      })
        .then(() => refreshBootstrap())
        .catch(() => refreshBootstrap());

      return { success: true, stockAfter: newStock };
    },
    [firebaseUser, products, collaborators, currentUser.name, refreshBootstrap]
  );

  const deleteMovement = useCallback(
    async (movementId: string) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      if (!canDeleteDirectly) {
        return {
          success: false,
          message:
            'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
        };
      }

      const targetMov = movements.find((m) => m.id === movementId);
      const targetProd = targetMov
        ? products.find((p) => p.id === targetMov.productId)
        : undefined;

      if (
        !isRealAdmin &&
        targetMov?.type === 'ENTRADA' &&
        targetProd &&
        targetProd.currentStock - targetMov.quantity < 0
      ) {
        return {
          success: false,
          message:
            'Não é possível excluir esta entrada pois parte dessas unidades já saiu do estoque. Solicite ao Administrador ou exclua primeiro as saídas relacionadas.',
        };
      }

      try {
        const res = await deleteMovementApi(movementId);
        await refreshBootstrap();
        return {
          success: true,
          newStock: res.newStock,
          productUpdated: res.productUpdated,
        };
      } catch (err) {
        console.error('Erro ao excluir movimentação:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível excluir a movimentação no banco de dados.',
        };
      }
    },
    [firebaseUser, canDeleteDirectly, movements, products, isRealAdmin, refreshBootstrap]
  );

  // Negative Stock Authorization Workflow
  const createNegativeStockRequest = useCallback(
    (req: {
      productId: string;
      requestedQuantity: number;
      withdrawnBy: string;
      collaboratorId?: string;
      destination: string;
      reason: string;
    }) => {
      if (!firebaseUser) return { success: false, message: 'Usuário não autenticado.' };
      const product = products.find((p) => p.id === req.productId);
      if (!product) return { success: false, message: 'Produto não encontrado.' };

      const reqId = `req-neg-${Date.now()}`;
      const matchedCollab = req.collaboratorId
        ? collaborators.find((c) => c.id === req.collaboratorId)
        : undefined;
      const resolvedWithdrawnBy = matchedCollab?.fullName || req.withdrawnBy;

      const optimisticReq: NegativeStockRequest = {
        id: reqId,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        group: product.group,
        requestedQuantity: req.requestedQuantity,
        availableStock: product.currentStock,
        deficitQuantity: Math.max(0, req.requestedQuantity - product.currentStock),
        withdrawnBy: resolvedWithdrawnBy,
        collaboratorId: req.collaboratorId,
        destination: req.destination,
        requestedBy: currentUser.name,
        reason: req.reason || 'Necessidade operacional urgente.',
        date: formatDateTimeNow(),
        status: 'PENDENTE',
      };
      setNegativeRequests((prev) => [optimisticReq, ...prev]);

      void createNegativeRequestApi({
        id: reqId,
        productId: req.productId,
        requestedQuantity: req.requestedQuantity,
        withdrawnBy: resolvedWithdrawnBy,
        collaboratorId: req.collaboratorId,
        destination: req.destination,
        reason: req.reason,
      })
        .then(() => refreshBootstrap())
        .catch(() => refreshBootstrap());

      return {
        success: true,
        message: 'Solicitação de liberação excepcional enviada ao Administrador.',
      };
    },
    [firebaseUser, products, collaborators, currentUser.name, refreshBootstrap]
  );

  const approveNegativeStockRequest = useCallback(
    (requestId: string) => {
      if (!firebaseUser || !isRealAdmin) {
        return { success: false, message: 'Apenas o Administrador pode aprovar esta solicitação.' };
      }
      const req = negativeRequests.find((r) => r.id === requestId);
      if (!req) return { success: false, message: 'Solicitação não encontrada.' };
      if (req.status !== 'PENDENTE') {
        return { success: false, message: 'Esta solicitação já foi analisada.' };
      }

      setNegativeRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: 'APROVADO', reviewedBy: currentUser.name, reviewedAt: formatDateTimeNow() }
            : r
        )
      );

      void approveNegativeRequestApi(requestId)
        .then(() => refreshBootstrap())
        .catch(() => refreshBootstrap());

      return {
        success: true,
        message: `Saída de ${req.requestedQuantity} un do produto ${req.productCode} autorizada com sucesso pelo Administrador.`,
      };
    },
    [firebaseUser, isRealAdmin, negativeRequests, currentUser.name, refreshBootstrap]
  );

  const rejectNegativeStockRequest = useCallback(
    (requestId: string) => {
      if (!isRealAdmin) {
        return { success: false, message: 'Apenas o Administrador pode recusar esta solicitação.' };
      }
      setNegativeRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: 'RECUSADO', reviewedBy: currentUser.name, reviewedAt: formatDateTimeNow() }
            : r
        )
      );
      void rejectNegativeRequestApi(requestId)
        .then(() => refreshBootstrap())
        .catch(() => refreshBootstrap());
      return { success: true, message: 'Solicitação recusada pelo Administrador.' };
    },
    [isRealAdmin, currentUser.name, refreshBootstrap]
  );

  const deleteNegativeStockRequest = useCallback(
    async (requestId: string) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      if (!canDeleteDirectly) {
        return {
          success: false,
          message:
            'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
        };
      }
      try {
        await deleteNegativeRequestApi(requestId);
        await refreshBootstrap();
        return { success: true };
      } catch (err) {
        console.error('Erro ao excluir solicitação de estoque negativo:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível excluir a solicitação no banco de dados.',
        };
      }
    },
    [firebaseUser, canDeleteDirectly, refreshBootstrap]
  );

  // Deletion Request & Approval Workflow
  const createDeletionRequest = useCallback(
    async (params: {
      recordType: DeletionRecordType;
      targetId: string;
      targetCode: string;
      targetName: string;
      targetDetails: string;
      quantity: number;
      reason: string;
    }) => {
      if (!firebaseUser) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      const trimmedReason = params.reason.trim();
      if (trimmedReason.length < 3) {
        return {
          success: false,
          message: 'Informe uma justificativa com pelo menos 3 caracteres explicando o motivo da exclusão.',
        };
      }

      try {
        await createDeletionRequestApi({
          recordType: params.recordType,
          targetId: params.targetId,
          targetCode: params.targetCode,
          targetName: params.targetName,
          targetDetails: params.targetDetails,
          quantity: params.quantity,
          reason: trimmedReason,
        });
        await refreshBootstrap();
        return {
          success: true,
          message: 'Solicitação de exclusão enviada ao Administrador principal para análise.',
        };
      } catch (err) {
        console.error('Erro ao criar solicitação de exclusão:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível registrar a solicitação de exclusão.',
        };
      }
    },
    [firebaseUser, refreshBootstrap]
  );

  const approveDeletionRequest = useCallback(
    async (requestId: string) => {
      if (!firebaseUser || !isRealAdmin || !currentUser.isAdmin) {
        return {
          success: false,
          message: 'Apenas o administrador principal pode aprovar solicitações de exclusão.',
        };
      }

      try {
        const res = await approveDeletionRequestApi(requestId);
        setSelectedProductForModal((prev) =>
          deletionRequests.some((r) => r.id === requestId && r.targetId === prev?.id) ? null : prev
        );
        await refreshBootstrap();
        return {
          success: true,
          message: `Solicitação aprovada e registro "${res.targetName}" excluído do sistema.${res.stockNote}`,
        };
      } catch (err) {
        console.error('Erro ao aprovar solicitação de exclusão:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Erro ao executar a exclusão após aprovação.',
        };
      }
    },
    [firebaseUser, isRealAdmin, currentUser.isAdmin, deletionRequests, refreshBootstrap]
  );

  const rejectDeletionRequest = useCallback(
    async (requestId: string) => {
      if (!firebaseUser || !isRealAdmin || !currentUser.isAdmin) {
        return {
          success: false,
          message: 'Apenas o administrador principal pode recusar solicitações de exclusão.',
        };
      }

      try {
        const res = await rejectDeletionRequestApi(requestId);
        await refreshBootstrap();
        return {
          success: true,
          message: `Solicitação recusada. O registro "${res.targetName}" foi mantido normalmente no sistema.`,
        };
      } catch (err) {
        console.error('Erro ao recusar solicitação de exclusão:', err);
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Não foi possível recusar a solicitação no banco de dados.',
        };
      }
    },
    [firebaseUser, isRealAdmin, currentUser.isAdmin, refreshBootstrap]
  );

  const resetAllData = useCallback(() => {
    if (!firebaseUser || !isRealAdmin) return;
    void resetAllDataApi().then(async () => {
      await refreshBootstrap();
      setActiveTabState('dashboard');
    });
  }, [firebaseUser, isRealAdmin, refreshBootstrap]);

  const pendingNegativeRequestsCount = useMemo(() => {
    return negativeRequests.filter((r) => r.status === 'PENDENTE').length;
  }, [negativeRequests]);

  const pendingDeletionRequestsCount = useMemo(() => {
    return deletionRequests.filter((r) => r.status === 'PENDENTE').length;
  }, [deletionRequests]);

  const pendingAccessRequestsCount = useMemo(() => {
    return accessRequests.filter((r) => r.status === 'PENDENTE').length;
  }, [accessRequests]);

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        accessStatus,
        authError,
        isRealAdmin,
        signInWithEmail,
        registerFirstAccessWithEmail,
        resendVerificationEmail,
        checkEmailVerified,
        sendPasswordReset,
        linkOrUpdateEmailPassword,
        signInWithGoogle,
        signOutGoogle,
        retryBootstrap,
        submitAccessRequest,
        accessRequests,
        pendingAccessRequestsCount,
        approveAccessRequest,
        rejectAccessRequest,
        currentUser,
        canDeleteDirectly,
        users,
        setCurrentUserId,
        updateUserPermissions,
        updateUserDeletePermission,
        updateUser,
        addUser,
        deleteUser,
        collaborators,
        addCollaborator,
        updateCollaborator,
        toggleCollaboratorActive,
        deleteCollaborator,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        movements,
        addMovement,
        deleteMovement,
        negativeRequests,
        createNegativeStockRequest,
        approveNegativeStockRequest,
        rejectNegativeStockRequest,
        deleteNegativeStockRequest,
        deletionRequests,
        deletionLogs,
        pendingDeletionRequestsCount,
        createDeletionRequest,
        approveDeletionRequest,
        rejectDeletionRequest,
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
        settingsInitialSubTab,
        setSettingsInitialSubTab,
        openSettingsSubTab,
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
