import React, { useEffect, useMemo, useState } from 'react';
import { SettingsSubTab, useApp } from '../../context/AppContext';
import { AccessRequest, DeletionRecordType, TabId, User, UserPermissions } from '../../types';
import { DeletionActionModal, DeletionTarget } from '../DeletionActionModal';
import {
  Settings,
  Shield,
  Eye,
  UserCheck,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  X,
  Building,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  ListPlus,
  Plus,
  ShieldAlert,
  HardHat,
  Briefcase,
  Layers,
  History,
  Lock,
  ShieldCheck,
  Users,
  Copy,
  Mail,
  Send,
  Share2,
  ExternalLink,
} from 'lucide-react';

const TAB_CONFIGS: { id: TabId; label: string; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Acesso a KPIs e alertas' },
  { id: 'produtos', label: 'Cadastro de Produtos', desc: 'Visualizar e cadastrar produtos' },
  { id: 'entradas', label: 'Entradas', desc: 'Recebimento de materiais' },
  { id: 'saidas', label: 'Saídas', desc: 'Requisições para canteiros de obras' },
  { id: 'colaboradores', label: 'Colaboradores', desc: 'Cadastro de funcionários de obra (sem login)' },
  { id: 'relatorios', label: 'Relatórios', desc: 'Emissão e exportação de relatórios' },
  { id: 'estatisticas', label: 'Estatísticas', desc: 'Giro de estoque e métricas' },
  { id: 'configuracoes', label: 'Configurações', desc: 'Gerenciamento de listas e permissões' },
];

const getRecordTypeLabel = (type: DeletionRecordType) => {
  switch (type) {
    case 'PRODUTO':
      return 'Produto';
    case 'ENTRADA':
      return 'Entrada';
    case 'SAIDA':
      return 'Saída';
    case 'SOLICITACAO_NEGATIVA':
      return 'Solic. Estoque Negativo';
    case 'COLABORADOR':
      return 'Colaborador';
  }
};

export const SettingsTab: React.FC = () => {
  const {
    isRealAdmin,
    settings,
    updateSettings,
    users,
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
    setActiveTab,
    currentUser,
    canDeleteDirectly,
    resetAllData,
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
    negativeRequests,
    approveNegativeStockRequest,
    rejectNegativeStockRequest,
    deleteNegativeStockRequest,
    pendingNegativeRequestsCount,
    deletionRequests,
    deletionLogs,
    pendingDeletionRequestsCount,
    createDeletionRequest,
    approveDeletionRequest,
    rejectDeletionRequest,
    accessRequests,
    pendingAccessRequestsCount,
    approveAccessRequest,
    rejectAccessRequest,
    settingsInitialSubTab,
    setSettingsInitialSubTab,
  } = useApp();

  const isPrincipalAdminMode = isRealAdmin && currentUser.isAdmin;

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(
    isPrincipalAdminMode ? settingsInitialSubTab : 'fotos'
  );
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Deletion modal for negative stock requests in 'autorizacoes'
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);
  const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false);

  // Deletion requests filter & processing lock in 'exclusoes'
  const [deletionStatusFilter, setDeletionStatusFilter] = useState<'TODAS' | 'PENDENTE' | 'APROVADO' | 'RECUSADO'>('TODAS');
  const [processingDeletionReqId, setProcessingDeletionReqId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPrincipalAdminMode) {
      if (activeSubTab !== 'fotos') {
        setActiveSubTab('fotos');
      }
    } else {
      setActiveSubTab(settingsInitialSubTab);
    }
  }, [isPrincipalAdminMode, settingsInitialSubTab]);

  const handleSelectSubTab = (subTab: SettingsSubTab) => {
    if (!isPrincipalAdminMode && subTab !== 'fotos') return;
    setActiveSubTab(subTab);
    setSettingsInitialSubTab(subTab);
  };

  // SECTION 3: List Management Form States
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupName, setEditingGroupName] = useState<{ oldName: string; currentVal: string } | null>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleName, setEditingRoleName] = useState<{ oldName: string; currentVal: string } | null>(null);

  const [newDestinationName, setNewDestinationName] = useState('');
  const [editingDestinationName, setEditingDestinationName] = useState<{ oldName: string; currentVal: string } | null>(null);

  // Field Collaborators (no app login) Form States
  const [newCollabFullName, setNewCollabFullName] = useState('');
  const [newCollabActive, setNewCollabActive] = useState(true);
  const [isSavingCollab, setIsSavingCollab] = useState(false);
  const [editingCollab, setEditingCollab] = useState<{
    id: string;
    fullName: string;
    role?: string;
    active: boolean;
  } | null>(null);

  // New Employee Modal State (App Login User)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: managedLists.roles[0] || '',
    department: '',
    isAdmin: false,
    canDelete: false,
    active: true,
    permissions: {
      dashboard: false,
      produtos: true,
      entradas: false,
      saidas: true,
      colaboradores: true,
      relatorios: false,
      estatisticas: false,
      configuracoes: false,
    } as UserPermissions,
  });

  // Invite Modal State
  const [inviteModalUser, setInviteModalUser] = useState<User | null>(null);
  const [inviteBaseUrl, setInviteBaseUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const saved = window.localStorage.getItem('qhs_public_app_url');
    if (saved) return saved;
    const origin = window.location.origin;
    if (origin.includes('://ais-dev-')) {
      return origin.replace('://ais-dev-', '://ais-pre-');
    }
    return origin;
  });

  // Access Requests Processing State
  const [processingAccessReqId, setProcessingAccessReqId] = useState<string | null>(null);
  const [accessReqCanDeleteMap, setAccessReqCanDeleteMap] = useState<Record<string, boolean>>({});

  const sortedAndFilteredDeletionRequests = useMemo(() => {
    const filtered =
      deletionStatusFilter === 'TODAS'
        ? deletionRequests
        : deletionRequests.filter((r) => r.status === deletionStatusFilter);
    return [...filtered].sort((a, b) => {
      if (a.status === 'PENDENTE' && b.status !== 'PENDENTE') return -1;
      if (a.status !== 'PENDENTE' && b.status === 'PENDENTE') return 1;
      return 0;
    });
  }, [deletionRequests, deletionStatusFilter]);

  const pendingTargetIds = useMemo(
    () =>
      new Set(
        deletionRequests
          .filter((r) => r.status === 'PENDENTE')
          .map((r) => r.targetId)
      ),
    [deletionRequests]
  );

  const showNotice = (text: string, isError = false) => {
    setNoticeMessage({ text, isError });
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  // Group Handlers
  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const ok = addGroup(newGroupName);
    if (ok) {
      showNotice(`Grupo "${newGroupName}" adicionado com sucesso e disponível nos cadastros!`);
      setNewGroupName('');
    } else {
      showNotice(`O grupo "${newGroupName}" já existe.`, true);
    }
  };

  const handleSaveEditGroup = () => {
    if (!editingGroupName) return;
    const ok = editGroup(editingGroupName.oldName, editingGroupName.currentVal);
    if (ok) {
      showNotice(`Grupo renomeado para "${editingGroupName.currentVal}".`);
      setEditingGroupName(null);
    } else {
      showNotice('Nome inválido ou já existente.', true);
    }
  };

  const handleDeleteGroup = (name: string) => {
    setConfirmDialog({
      title: 'Excluir Grupo',
      message: `Confirma a exclusão do grupo "${name}"?`,
      onConfirm: () => {
        const res = deleteGroup(name);
        if (res.success) {
          showNotice(`Grupo "${name}" excluído.`);
        } else {
          showNotice(res.message || 'Não foi possível excluir.', true);
        }
      },
    });
  };

  // Role Handlers
  const handleAddRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const ok = addRole(newRoleName);
    if (ok) {
      showNotice(`Cargo "${newRoleName}" cadastrado com sucesso!`);
      setNewRoleName('');
    } else {
      showNotice('Cargo já existente.', true);
    }
  };

  const handleSaveEditRole = () => {
    if (!editingRoleName) return;
    const ok = editRole(editingRoleName.oldName, editingRoleName.currentVal);
    if (ok) {
      showNotice(`Cargo renomeado para "${editingRoleName.currentVal}".`);
      setEditingRoleName(null);
    }
  };

  const handleDeleteRole = (name: string) => {
    setConfirmDialog({
      title: 'Excluir Cargo',
      message: `Excluir o cargo "${name}" das opções?`,
      onConfirm: () => {
        deleteRole(name);
        showNotice(`Cargo "${name}" removido.`);
      },
    });
  };

  // Destination / Obras Handlers
  const handleAddDestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestinationName.trim()) return;
    const ok = addDestination(newDestinationName);
    if (ok) {
      showNotice(`Obra/Canteiro "${newDestinationName}" adicionado!`);
      setNewDestinationName('');
    } else {
      showNotice('Destino já existente.', true);
    }
  };

  const handleSaveEditDest = () => {
    if (!editingDestinationName) return;
    const ok = editDestination(editingDestinationName.oldName, editingDestinationName.currentVal);
    if (ok) {
      showNotice(`Obra renomeada para "${editingDestinationName.currentVal}".`);
      setEditingDestinationName(null);
    }
  };

  const handleDeleteDest = (name: string) => {
    setConfirmDialog({
      title: 'Excluir Obra / Destino',
      message: `Excluir a obra "${name}"?`,
      onConfirm: () => {
        deleteDestination(name);
        showNotice(`Obra "${name}" excluída.`);
      },
    });
  };

  // Permissions Toggle
  const handleTogglePermission = (user: User, tabId: TabId) => {
    if (!isPrincipalAdminMode) {
      showNotice('Apenas o administrador principal pode alterar permissões.', true);
      return;
    }
    if (user.isAdmin) {
      showNotice('Administradores possuem acesso total a todas as funcionalidades.', true);
      return;
    }
    const updatedPermissions: UserPermissions = {
      ...user.permissions,
      [tabId]: !user.permissions[tabId],
    };
    updateUserPermissions(user.id, updatedPermissions);
    showNotice(`Permissão da aba "${tabId}" atualizada para ${user.name}`);
  };

  const handleToggleDeletePermission = (user: User) => {
    if (!isPrincipalAdminMode) {
      showNotice('Apenas o administrador principal pode controlar a permissão de exclusão.', true);
      return;
    }
    if (user.isAdmin) {
      showNotice('O administrador principal sempre possui permissão total de exclusão.', true);
      return;
    }
    const nextValue = !Boolean(user.canDelete);
    updateUserDeletePermission(user.id, nextValue);
    showNotice(
      nextValue
        ? `Permissão de exclusão direta concedida a ${user.name}.`
        : `Permissão de exclusão direta removida de ${user.name}. Agora este usuário precisará solicitar aprovação.`
    );
  };

  const handleGrantAll = (user: User) => {
    if (!isPrincipalAdminMode || user.isAdmin) return;
    const allTrue: UserPermissions = {
      dashboard: true,
      produtos: true,
      entradas: true,
      saidas: true,
      colaboradores: true,
      relatorios: true,
      estatisticas: true,
      configuracoes: true,
    };
    updateUserPermissions(user.id, allTrue);
    showNotice(`Todas as abas liberadas para ${user.name}`);
  };

  const handleRevokeAll = (user: User) => {
    if (!isPrincipalAdminMode || user.isAdmin) return;
    const allFalse: UserPermissions = {
      dashboard: false,
      produtos: false,
      entradas: false,
      saidas: false,
      colaboradores: false,
      relatorios: false,
      estatisticas: false,
      configuracoes: false,
    };
    updateUserPermissions(user.id, allFalse);
    showNotice(`Todas as abas bloqueadas para ${user.name}`);
  };

  // Field Collaborators (No Login) Handlers
  const sortedCollaborators = useMemo(() => {
    return [...collaborators].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'pt-BR');
    });
  }, [collaborators]);

  const handleAddCollaboratorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCollab) return;
    setIsSavingCollab(true);
    const res = await addCollaborator({
      fullName: newCollabFullName,
      active: newCollabActive,
    });
    setIsSavingCollab(false);
    if (res.success) {
      setNewCollabFullName('');
      setNewCollabActive(true);
      showNotice(res.message || 'Colaborador cadastrado com sucesso.');
    } else {
      showNotice(res.message || 'Erro ao cadastrar colaborador.', true);
    }
  };

  const handleSaveEditCollaborator = async () => {
    if (!editingCollab || isSavingCollab) return;
    setIsSavingCollab(true);
    const res = await updateCollaborator({
      id: editingCollab.id,
      fullName: editingCollab.fullName,
      role: editingCollab.role,
      active: editingCollab.active,
    });
    setIsSavingCollab(false);
    if (res.success) {
      setEditingCollab(null);
      showNotice(res.message || 'Colaborador atualizado com sucesso.');
    } else {
      showNotice(res.message || 'Erro ao atualizar colaborador.', true);
    }
  };

  // Employee Add / Edit
  const handleOpenAddEmployee = () => {
    if (!isPrincipalAdminMode) return;
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: managedLists.roles[0] || '',
      department: '',
      isAdmin: false,
      canDelete: false,
      active: true,
      permissions: {
        dashboard: false,
        produtos: true,
        entradas: false,
        saidas: true,
        colaboradores: true,
        relatorios: false,
        estatisticas: false,
        configuracoes: false,
      },
    });
    setIsAddUserModalOpen(true);
  };

  const handleOpenEditEmployee = (user: User) => {
    if (!isPrincipalAdminMode) return;
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isAdmin: user.isAdmin,
      canDelete: Boolean(user.isAdmin || user.canDelete),
      active: user.active,
      permissions: { ...user.permissions },
    });
    setIsAddUserModalOpen(true);
  };

  const copyTextSafely = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below for iOS Safari / restricted iframes
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  };

  const getNormalizedInviteBaseUrl = () => {
    const cleaned = inviteBaseUrl.trim().replace(/\/+$/, '');
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned;
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  const buildDirectInviteLink = (email: string) => {
    const base = getNormalizedInviteBaseUrl();
    return `${base}/?convite=${encodeURIComponent(email.trim().toLowerCase())}`;
  };

  const buildUserInviteText = (name: string, email: string) => {
    const directUrl = buildDirectInviteLink(email);
    return `Olá, ${name}!\n\nSeu acesso ao Sistema de Estoque da QHS Engenharia foi liberado para o e-mail: ${email}\n\nPara entrar:\n1. Abra o link: ${directUrl}\n2. Crie sua senha na aba "1º Acesso" (ou clique em "Continuar com conta Google")\n3. Confirme seu e-mail e acesse o sistema.`;
  };

  const handleOpenInviteModal = async (user: User) => {
    setInviteModalUser(user);
    const copied = await copyTextSafely(buildDirectInviteLink(user.email));
    if (copied) {
      showNotice(`Link de convite de ${user.email} copiado! Escolha abaixo como enviar.`);
    }
  };

  const buildMailtoHref = (user: User) => {
    const subject = encodeURIComponent('Convite de Acesso - Sistema de Estoque QHS Engenharia');
    const body = encodeURIComponent(buildUserInviteText(user.name, user.email));
    return `mailto:${user.email}?subject=${subject}&body=${body}`;
  };

  const buildWhatsAppHref = (user: User) => {
    const text = encodeURIComponent(buildUserInviteText(user.name, user.email));
    return `https://wa.me/?text=${text}`;
  };

  const pendingAccessRequests = useMemo(
    () => accessRequests.filter((r) => r.status === 'PENDENTE'),
    [accessRequests]
  );

  const handleApproveAccessRequest = async (req: AccessRequest) => {
    if (!isPrincipalAdminMode || processingAccessReqId) return;
    setProcessingAccessReqId(req.id);
    const canDelete = Boolean(accessReqCanDeleteMap[req.id]);
    try {
      const res = await approveAccessRequest(req.id, { canDelete });
      showNotice(res.message || 'Pedido aprovado!', !res.success);
    } finally {
      setProcessingAccessReqId(null);
    }
  };

  const handleRejectAccessRequest = async (req: AccessRequest) => {
    if (!isPrincipalAdminMode || processingAccessReqId) return;
    setProcessingAccessReqId(req.id);
    try {
      const res = await rejectAccessRequest(req.id);
      showNotice(res.message || 'Pedido recusado.', !res.success);
    } finally {
      setProcessingAccessReqId(null);
    }
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name.trim() || !userFormData.email.trim()) return;

    if (editingUser) {
      updateUser({
        ...editingUser,
        ...userFormData,
      });
      showNotice(`Colaborador ${userFormData.name} atualizado com sucesso!`);
    } else {
      addUser({
        ...userFormData,
      });
      showNotice(
        `Usuário ${userFormData.name} cadastrado! Envie o convite para ${userFormData.email.trim().toLowerCase()} realizar o Primeiro Acesso.`
      );
    }

    setIsAddUserModalOpen(false);
  };

  const handleToggleUserActive = (user: User) => {
    if (user.id === 'user-owner' || user.isAdmin) {
      showNotice('Não é permitido inativar o Administrador principal.', true);
      return;
    }
    updateUser({ ...user, active: !user.active });
    showNotice(`Colaborador ${user.name} ${!user.active ? 'ativado' : 'inativado'}.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <Settings className="w-5 h-5 text-red-500" />
            </span>
            Administração, Cadastros & Permissões
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Área exclusiva do Administrador para gerenciar opções de listas, autorizar saídas de estoque negativo e definir permissões.
          </p>
        </div>

        {isPrincipalAdminMode && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setConfirmDialog({
                  title: 'Limpar Todos os Dados',
                  message:
                    'Deseja limpar TODOS os produtos, movimentações, solicitações e cadastros de teste para zerar o aplicativo?',
                  onConfirm: () => {
                    resetAllData();
                    showNotice('Todos os dados de teste foram removidos. O aplicativo está zerado.');
                  },
                });
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200 font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Limpar Todos os Dados
            </button>
          </div>
        )}
      </div>

      {noticeMessage && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium border ${
            noticeMessage.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {noticeMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {!isPrincipalAdminMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Controles Administrativos Restritos</strong>
            <span>
              Somente o Administrador principal pode gerenciar permissões de usuários, aprovar ou recusar solicitações de exclusão, autorizar saídas com saldo negativo ou alterar cadastros gerais.
            </span>
          </div>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-100 rounded-xl">
        {isPrincipalAdminMode && (
          <>
            <button
              onClick={() => handleSelectSubTab('listas')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'listas'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ListPlus className="w-4 h-4 text-red-600" />
              <span>Gerenciamento de Listas & Cadastros</span>
              {pendingAccessRequestsCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {pendingAccessRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSelectSubTab('permissoes')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'permissoes'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Shield className="w-4 h-4 text-red-600" />
              <span>Permissões de Usuários</span>
            </button>

            <button
              onClick={() => handleSelectSubTab('exclusoes')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all relative ${
                activeSubTab === 'exclusoes'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <History className="w-4 h-4 text-red-600" />
              <span>Solicitações de Exclusão</span>
              {pendingDeletionRequestsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {pendingDeletionRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSelectSubTab('autorizacoes')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all relative ${
                activeSubTab === 'autorizacoes'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Autorizações de Estoque Negativo</span>
              {pendingNegativeRequestsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
              )}
            </button>
          </>
        )}

        <button
          onClick={() => handleSelectSubTab('fotos')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'fotos'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Eye className="w-4 h-4 text-zinc-500" />
          <span>Fotos dos Produtos</span>
        </button>

        {isPrincipalAdminMode && (
          <button
            onClick={() => handleSelectSubTab('empresa')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'empresa'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Building className="w-4 h-4 text-zinc-500" />
            <span>Dados da Empresa</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: SECTION 3 — GERENCIAMENTO DE CADASTROS E LISTAS (ÁREA CENTRALIZADA DO ADMINISTRADOR) */}
      {activeSubTab === 'listas' && isPrincipalAdminMode && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
            <div className="border-b border-zinc-100 pb-3">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-red-600 shrink-0" />
                Gerenciamento Centralizado de Listas e Opções
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Todas as opções adicionadas, editadas ou inativadas nesta área aparecem automaticamente nos campos de seleção do aplicativo, sem precisar abrir formulários individuais.
              </p>
            </div>

            {/* 1. GRUPOS DE PRODUTOS (Materiais, Extintores, Placas + Novos Grupos) */}
            <div className="p-3.5 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-red-600 shrink-0" />
                    Grupos de Produtos
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Grupos iniciais: <strong>Materiais</strong>, <strong>Extintores</strong> e <strong>Placas</strong>. Você pode adicionar outros grupos conforme desejar.
                  </span>
                </div>

                {/* Form to add group */}
                <form onSubmit={handleAddGroupSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    required
                    placeholder="Nome do novo grupo..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full sm:w-44 px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Grupo
                  </button>
                </form>
              </div>

              {/* Groups List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {managedLists.groups.map((group) => {
                  const isEditing = editingGroupName?.oldName === group;
                  return (
                    <div
                      key={group}
                      className="bg-white p-3 rounded-lg border border-zinc-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingGroupName.currentVal}
                            onChange={(e) =>
                              setEditingGroupName({
                                ...editingGroupName,
                                currentVal: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-red-500 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEditGroup}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Salvar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingGroupName(null)}
                            className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                            <span className="text-xs font-bold text-zinc-800">{group}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingGroupName({ oldName: group, currentVal: group })
                              }
                              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                              title="Editar nome do grupo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group)}
                              className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Excluir grupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. CARGOS DOS COLABORADORES */}
            <div className="p-3.5 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-zinc-700 shrink-0" />
                    Lista de Cargos
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Cargos cadastrados para qualificação de funcionários.
                  </span>
                </div>

                <form onSubmit={handleAddRoleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    required
                    placeholder="Novo cargo..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full sm:w-44 px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Cargo
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {managedLists.roles.map((role) => {
                  const isEditing = editingRoleName?.oldName === role;
                  return (
                    <div
                      key={role}
                      className="bg-white p-3 rounded-lg border border-zinc-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingRoleName.currentVal}
                            onChange={(e) =>
                              setEditingRoleName({ ...editingRoleName, currentVal: e.target.value })
                            }
                            className="w-full px-2 py-1 text-xs border border-red-500 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEditRole}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingRoleName(null)}
                            className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-zinc-800">{role}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingRoleName({ oldName: role, currentVal: role })}
                              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. OBRAS E DESTINOS DAS SAÍDAS */}
            <div className="p-3.5 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-red-600 shrink-0" />
                    Canteiros de Obras & Locais de Destino
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Opções disponíveis para seleção no formulário de saídas de materiais.
                  </span>
                </div>

                <form onSubmit={handleAddDestSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    required
                    placeholder="Nome da nova obra..."
                    value={newDestinationName}
                    onChange={(e) => setNewDestinationName(e.target.value)}
                    className="w-full sm:w-44 px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Obra
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {managedLists.destinations.map((dest) => {
                  const isEditing = editingDestinationName?.oldName === dest;
                  return (
                    <div
                      key={dest}
                      className="bg-white p-3 rounded-lg border border-zinc-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="text"
                            value={editingDestinationName.currentVal}
                            onChange={(e) =>
                              setEditingDestinationName({
                                ...editingDestinationName,
                                currentVal: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-red-500 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEditDest}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingDestinationName(null)}
                            className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-zinc-800 truncate">{dest}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() =>
                                setEditingDestinationName({ oldName: dest, currentVal: dest })
                              }
                              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDest(dest)}
                              className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. COLABORADORES DE OBRA (RETIRADAS — SEM ACESSO AO APLICATIVO) */}
            <div className="p-3.5 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-600 shrink-0" />
                    Cadastro de Colaboradores (Sem Acesso ao Aplicativo)
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Cadastre os funcionários da obra que aparecerão no campo <strong>"Colaborador que retirou"</strong> ao registrar saídas. Estes cadastros não criam login nem senha.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('colaboradores')}
                  className="w-full lg:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  <History className="w-3.5 h-3.5 text-red-600" />
                  Abrir Aba Colaboradores & Histórico
                </button>
              </div>

              {/* Form: Nome Completo + Status (Ativo/Inativo) */}
              <form
                onSubmit={handleAddCollaboratorSubmit}
                className="bg-white p-3.5 rounded-lg border border-zinc-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Nome Completo do Colaborador *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCollabFullName}
                    onChange={(e) => setNewCollabFullName(e.target.value)}
                    placeholder="Ex: João Silva Santos"
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Status *
                  </label>
                  <select
                    value={newCollabActive ? 'ATIVO' : 'INATIVO'}
                    onChange={(e) => setNewCollabActive(e.target.value === 'ATIVO')}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-semibold"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={isSavingCollab}
                    className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isSavingCollab ? 'Salvando...' : 'Cadastrar Colaborador'}
                  </button>
                </div>
              </form>

              {/* Collaborators List */}
              {sortedCollaborators.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-lg p-6 text-center text-xs text-zinc-500">
                  Nenhum colaborador de obra cadastrado ainda. Utilize o formulário acima para cadastrar.
                </div>
              ) : (
                <>
                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-zinc-200 bg-white rounded-lg border border-zinc-200">
                    {sortedCollaborators.map((colab) => {
                      const isEditing = editingCollab?.id === colab.id;
                      return (
                        <div key={colab.id} className="p-3.5 space-y-2.5 text-xs">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editingCollab.fullName}
                                onChange={(e) =>
                                  setEditingCollab({ ...editingCollab, fullName: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 text-xs border border-red-500 rounded-lg focus:outline-none"
                                placeholder="Nome completo"
                              />
                              <select
                                value={editingCollab.active ? 'ATIVO' : 'INATIVO'}
                                onChange={(e) =>
                                  setEditingCollab({
                                    ...editingCollab,
                                    active: e.target.value === 'ATIVO',
                                  })
                                }
                                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg bg-white font-semibold"
                              >
                                <option value="ATIVO">Ativo</option>
                                <option value="INATIVO">Inativo</option>
                              </select>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingCollab(null)}
                                  className="px-3 py-1 text-zinc-600 hover:bg-zinc-100 rounded"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEditCollaborator}
                                  className="px-3 py-1 bg-emerald-600 text-white rounded font-semibold"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900 truncate">
                                  {colab.fullName}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleCollaboratorActive(colab.id).then((res) =>
                                      showNotice(res.message || '', !res.success)
                                    )
                                  }
                                  className={`mt-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                    colab.active
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-zinc-100 text-zinc-500 border-zinc-300'
                                  }`}
                                >
                                  {colab.active ? 'Ativo' : 'Inativo'}
                                </button>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingCollab({
                                      id: colab.id,
                                      fullName: colab.fullName,
                                      role: colab.role,
                                      active: colab.active,
                                    })
                                  }
                                  className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
                                  title="Editar colaborador"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeletionTarget({
                                      recordType: 'COLABORADOR',
                                      targetId: colab.id,
                                      targetCode: '',
                                      targetName: colab.fullName,
                                      targetDetails: colab.role
                                        ? `Função: ${colab.role} · Status: ${colab.active ? 'Ativo' : 'Inativo'}`
                                        : `Colaborador de obra · Status: ${colab.active ? 'Ativo' : 'Inativo'}`,
                                      quantity: 0,
                                      modalTitle: 'Excluir Colaborador',
                                      summaryText: (
                                        <>
                                          Deseja excluir o colaborador{' '}
                                          <strong className="text-zinc-900">"{colab.fullName}"</strong>{' '}
                                          do cadastro? O histórico de movimentações e quantidades de estoque será preservado.
                                        </>
                                      ),
                                    })
                                  }
                                  className={`p-1.5 rounded ${
                                    pendingTargetIds.has(colab.id)
                                      ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                      : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  title={
                                    canDeleteDirectly
                                      ? 'Excluir colaborador'
                                      : pendingTargetIds.has(colab.id)
                                      ? 'Solicitação de exclusão pendente'
                                      : 'Solicitar exclusão do colaborador'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-zinc-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                        <tr>
                          <th className="py-2.5 px-3">Nome Completo</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {sortedCollaborators.map((colab) => {
                          const isEditing = editingCollab?.id === colab.id;
                          return (
                            <tr key={colab.id} className="hover:bg-zinc-50">
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingCollab.fullName}
                                    onChange={(e) =>
                                      setEditingCollab({
                                        ...editingCollab,
                                        fullName: e.target.value,
                                      })
                                    }
                                    className="w-full max-w-sm px-2.5 py-1 text-xs border border-red-500 rounded focus:outline-none"
                                    autoFocus
                                  />
                                ) : (
                                  colab.fullName
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {isEditing ? (
                                  <select
                                    value={editingCollab.active ? 'ATIVO' : 'INATIVO'}
                                    onChange={(e) =>
                                      setEditingCollab({
                                        ...editingCollab,
                                        active: e.target.value === 'ATIVO',
                                      })
                                    }
                                    className="px-2.5 py-1 text-xs border border-zinc-300 rounded bg-white font-semibold"
                                  >
                                    <option value="ATIVO">Ativo</option>
                                    <option value="INATIVO">Inativo</option>
                                  </select>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void toggleCollaboratorActive(colab.id).then((res) =>
                                        showNotice(res.message || '', !res.success)
                                      )
                                    }
                                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                                      colab.active
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:bg-zinc-200'
                                    }`}
                                    title="Clique para alternar entre Ativo e Inativo"
                                  >
                                    {colab.active ? 'Ativo' : 'Inativo'}
                                  </button>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {isEditing ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={handleSaveEditCollaborator}
                                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                      title="Salvar alterações"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingCollab(null)}
                                      className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                                      title="Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingCollab({
                                          id: colab.id,
                                          fullName: colab.fullName,
                                          role: colab.role,
                                          active: colab.active,
                                        })
                                      }
                                      className="p-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
                                      title="Editar colaborador"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeletionTarget({
                                          recordType: 'COLABORADOR',
                                          targetId: colab.id,
                                          targetCode: '',
                                          targetName: colab.fullName,
                                          targetDetails: colab.role
                                            ? `Função: ${colab.role} · Status: ${colab.active ? 'Ativo' : 'Inativo'}`
                                            : `Colaborador de obra · Status: ${colab.active ? 'Ativo' : 'Inativo'}`,
                                          quantity: 0,
                                          modalTitle: 'Excluir Colaborador',
                                          summaryText: (
                                            <>
                                              Deseja excluir o colaborador{' '}
                                              <strong className="text-zinc-900">"{colab.fullName}"</strong>{' '}
                                              do cadastro? O histórico de movimentações e quantidades de estoque será preservado.
                                            </>
                                          ),
                                        })
                                      }
                                      className={`p-1 rounded ${
                                        pendingTargetIds.has(colab.id)
                                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                          : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                                      }`}
                                      title={
                                        canDeleteDirectly
                                          ? 'Excluir colaborador'
                                          : pendingTargetIds.has(colab.id)
                                          ? 'Solicitação de exclusão pendente'
                                          : 'Solicitar exclusão do colaborador'
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* 4B. PEDIDOS DE ENTRADA NO APLICATIVO (SOLICITAÇÕES DE ACESSO) */}
            {pendingAccessRequests.length > 0 && (
              <div className="p-3.5 sm:p-5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                      <Send className="w-4 h-4 text-red-600 shrink-0" />
                      Pedidos de Acesso ao Aplicativo ({pendingAccessRequests.length} pendente{pendingAccessRequests.length === 1 ? '' : 's'})
                    </h3>
                    <span className="text-xs text-zinc-600">
                      Pessoas que solicitaram entrada pelo aplicativo. Aprove para liberar login imediato e sincronizar com o Supabase.
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {pendingAccessRequests.map((req) => {
                    const isProc = processingAccessReqId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="bg-white p-3.5 rounded-lg border border-amber-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-zinc-900">{req.name}</strong>
                            <span className="font-mono text-[11px] bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 text-zinc-700 break-all">
                              {req.email}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">{req.date}</span>
                          </div>
                          {(req.role || req.department) && (
                            <div className="text-[11px] text-zinc-600">
                              {req.role ? `Cargo: ${req.role}` : ''}
                              {req.role && req.department ? ' · ' : ''}
                              {req.department ? `Obra/Setor: ${req.department}` : ''}
                            </div>
                          )}
                          {req.reason && (
                            <div className="text-[11px] text-zinc-600 italic">
                              "{req.reason}"
                            </div>
                          )}
                          <label className="inline-flex items-center gap-1.5 pt-1 text-[11px] text-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(accessReqCanDeleteMap[req.id])}
                              onChange={(e) =>
                                setAccessReqCanDeleteMap((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.checked,
                                }))
                              }
                              className="rounded border-zinc-300 text-red-600"
                            />
                            <span>Permitir exclusão direta de registros</span>
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isProc}
                            onClick={() => void handleApproveAccessRequest(req)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            {isProc ? 'Liberando...' : 'Aprovar e Liberar Acesso'}
                          </button>
                          <button
                            type="button"
                            disabled={isProc}
                            onClick={() => void handleRejectAccessRequest(req)}
                            className="px-3 py-2 bg-zinc-200 hover:bg-zinc-300 disabled:opacity-50 text-zinc-800 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. USUÁRIOS DO SISTEMA (ACESSO AO APLICATIVO & PERMISSÕES) */}
            <div className="p-3.5 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-zinc-700 shrink-0" />
                    Usuários com Acesso ao Aplicativo (Login & Permissões)
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Contas autorizadas por e-mail para acessar o sistema (Primeiro Acesso via E-mail/Senha ou Google), registrar movimentações e gerenciar o estoque.
                  </span>
                </div>

                <button
                  onClick={handleOpenAddEmployee}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar Usuário do Sistema
                </button>
              </div>

              {/* Mobile Employee Cards */}
              <div className="md:hidden divide-y divide-zinc-200 bg-white rounded-lg border border-zinc-200">
                {users.map((user) => (
                  <div key={user.id} className="p-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          <span>{user.name}</span>
                          {user.isAdmin && (
                            <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                          {!user.isAdmin && user.canDelete && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                              Exclusão Direta
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {user.role || '-'} {user.department ? `· ${user.department}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleOpenInviteModal(user)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                          title="Enviar link de convite"
                        >
                          <Send className="w-3 h-3" />
                          Convite
                        </button>
                        <button
                          onClick={() => handleOpenEditEmployee(user)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
                          title="Editar funcionário"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!user.isAdmin && (
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                title: 'Excluir Funcionário',
                                message: `Excluir o funcionário "${user.name}"?`,
                                onConfirm: () => {
                                  deleteUser(user.id);
                                  showNotice(`Funcionário "${user.name}" excluído.`);
                                },
                              });
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Excluir funcionário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => handleToggleUserActive(user)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                          user.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:bg-zinc-200'
                        }`}
                      >
                        {user.active ? 'Ativo na Lista' : 'Inativo (Oculto)'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Employee Table */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-3">Nome do Colaborador</th>
                      <th className="py-2.5 px-3">Cargo</th>
                      <th className="py-2.5 px-3">Departamento</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-3 font-semibold text-zinc-900">
                          {user.name}
                          {user.isAdmin && (
                            <span className="ml-1.5 text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                          {!user.isAdmin && user.canDelete && (
                            <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                              Exclusão Direta
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700">{user.role}</td>
                        <td className="py-2.5 px-3 text-zinc-500">{user.department}</td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleToggleUserActive(user)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                              user.active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:bg-zinc-200'
                            }`}
                            title="Clique para alternar entre Ativo e Inativo"
                          >
                            {user.active ? 'Ativo na Lista' : 'Inativo (Oculto)'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleOpenInviteModal(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                              title="Enviar link de convite por WhatsApp, E-mail ou Cópia"
                            >
                              <Send className="w-3 h-3" />
                              Enviar Convite
                            </button>
                            <button
                              onClick={() => handleOpenEditEmployee(user)}
                              className="p-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
                              title="Editar funcionário"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!user.isAdmin && (
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    title: 'Excluir Funcionário',
                                    message: `Excluir o funcionário "${user.name}"?`,
                                    onConfirm: () => {
                                      deleteUser(user.id);
                                      showNotice(`Funcionário "${user.name}" excluído.`);
                                    },
                                  });
                                }}
                                className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Excluir funcionário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PERMISSÕES INDIVIDUAIS DE USUÁRIOS */}
      {activeSubTab === 'permissoes' && isPrincipalAdminMode && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-bold text-zinc-900">
              Matriz de Permissões Individuais por Funcionário
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Como administrador principal, você pode liberar ou bloquear o acesso a cada aba e controlar individualmente quem tem permissão para excluir registros diretamente sem precisar solicitar aprovação.
            </p>
          </div>

          {/* Mobile & Tablet Permission Cards */}
          <div className="lg:hidden space-y-4">
            {users.map((user) => {
              const isCurrentUser = user.id === currentUser.id;
              const hasDirectDelete = user.isAdmin || Boolean(user.canDelete);
              return (
                <div key={user.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          user.isAdmin ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white'
                        }`}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{user.name}</span>
                          {user.isAdmin && (
                            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-medium">
                              Você
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate">
                          {user.role} {user.department ? `· ${user.department}` : ''}
                        </div>
                      </div>
                    </div>

                    {user.isAdmin ? (
                      <span className="text-[11px] font-semibold text-zinc-500">Acesso Pleno</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleGrantAll(user)}
                          className="px-2.5 py-1 text-[11px] text-emerald-700 bg-white hover:bg-emerald-50 rounded border border-emerald-200 font-medium"
                        >
                          Liberar Todas
                        </button>
                        <button
                          onClick={() => handleRevokeAll(user)}
                          className="px-2.5 py-1 text-[11px] text-red-700 bg-white hover:bg-red-50 rounded border border-red-200 font-medium"
                        >
                          Bloquear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Individual Direct Deletion Permission Toggle */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-zinc-200">
                    <div>
                      <span className="block text-xs font-bold text-zinc-900">
                        Exclusão Direta de Registros
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {hasDirectDelete
                          ? 'Pode excluir produtos, entradas, saídas e colaboradores diretamente.'
                          : 'Precisa solicitar exclusão com justificativa para sua aprovação.'}
                      </span>
                    </div>
                    {user.isAdmin ? (
                      <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        Sempre Ativa
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleDeletePermission(user)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors shrink-0 ${
                          hasDirectDelete
                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {hasDirectDelete ? 'Permitida' : 'Solicita Aprovação'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TAB_CONFIGS.map((tab) => {
                      const isAllowed = user.isAdmin || user.permissions[tab.id];
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          disabled={user.isAdmin}
                          onClick={() => handleTogglePermission(user, tab.id)}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                            user.isAdmin
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-not-allowed'
                              : isAllowed
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          <span className="truncate">{tab.label}</span>
                          {isAllowed ? (
                            <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                          ) : (
                            <X className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Matrix Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-white font-semibold">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Usuário</th>
                  <th className="py-3 px-3 text-center">Dashboard</th>
                  <th className="py-3 px-3 text-center">Produtos</th>
                  <th className="py-3 px-3 text-center">Entradas</th>
                  <th className="py-3 px-3 text-center">Saídas</th>
                  <th className="py-3 px-3 text-center">Colaboradores</th>
                  <th className="py-3 px-3 text-center">Relatórios</th>
                  <th className="py-3 px-3 text-center">Estatísticas</th>
                  <th className="py-3 px-3 text-center">Configurações</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Excluir Direto</th>
                  <th className="py-3 px-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUser.id;
                  const hasDirectDelete = user.isAdmin || Boolean(user.canDelete);

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              user.isAdmin ? 'bg-red-600 text-white' : 'bg-zinc-800 text-white'
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                              {user.name}
                              {user.isAdmin && (
                                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                                  ADMIN
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-medium">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {user.role} · {user.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Checkboxes */}
                      {TAB_CONFIGS.map((tab) => {
                        const isAllowed = user.isAdmin || user.permissions[tab.id];

                        return (
                          <td key={tab.id} className="py-3 px-3 text-center">
                            {user.isAdmin ? (
                              <span
                                title="Administrador possui acesso total a todas as abas"
                                className="inline-flex items-center justify-center w-7 h-7 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 cursor-not-allowed"
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePermission(user, tab.id)}
                                title={`Clique para ${isAllowed ? 'bloquear' : 'liberar'} o acesso à aba ${tab.label}`}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-all ${
                                  isAllowed
                                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-700'
                                }`}
                              >
                                {isAllowed ? (
                                  <Check className="w-4 h-4 stroke-[3]" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}

                      {/* Individual Direct Delete Permission */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {user.isAdmin ? (
                          <span
                            title="Administrador principal sempre pode excluir diretamente"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 text-[11px] font-semibold cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Total
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleDeletePermission(user)}
                            title={
                              hasDirectDelete
                                ? 'Clique para revogar a exclusão direta (passará a solicitar aprovação)'
                                : 'Clique para conceder permissão de exclusão direta sem aprovação'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all ${
                              hasDirectDelete
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {hasDirectDelete ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                Direto
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                Solicita
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Presets */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {user.isAdmin ? (
                          <span className="text-[11px] font-semibold text-zinc-400">
                            Acesso Pleno
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleGrantAll(user)}
                              className="px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200"
                            >
                              Liberar Todas
                            </button>
                            <button
                              onClick={() => handleRevokeAll(user)}
                              className="px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 rounded border border-red-200"
                            >
                              Bloquear
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: SOLICITAÇÕES DE EXCLUSÃO & HISTÓRICO DE AUDITORIA (EXCLUSIVO DO ADMINISTRADOR PRINCIPAL) */}
      {activeSubTab === 'exclusoes' && isPrincipalAdminMode && (
        <div className="space-y-6">
          {/* Request Queue Card */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
                  Solicitações de Exclusão de Registros
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Analise pedidos enviados por usuários sem permissão direta. Ao aprovar, o registro é excluído com estorno automático de estoque; ao recusar, o registro permanece intacto.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-lg">
                {(
                  [
                    { key: 'TODAS', label: `Todas (${deletionRequests.length})` },
                    { key: 'PENDENTE', label: `Pendentes (${pendingDeletionRequestsCount})` },
                    {
                      key: 'APROVADO',
                      label: `Aprovadas (${deletionRequests.filter((r) => r.status === 'APROVADO').length})`,
                    },
                    {
                      key: 'RECUSADO',
                      label: `Recusadas (${deletionRequests.filter((r) => r.status === 'RECUSADO').length})`,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDeletionStatusFilter(item.key)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      deletionStatusFilter === item.key
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {sortedAndFilteredDeletionRequests.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                Nenhuma solicitação de exclusão encontrada para este filtro.
              </p>
            ) : (
              <div className="space-y-4">
                {sortedAndFilteredDeletionRequests.map((req) => {
                  const isProcessing = processingDeletionReqId === req.id;
                  return (
                    <div
                      key={req.id}
                      className={`p-3.5 sm:p-4 rounded-xl border space-y-3 ${
                        req.status === 'PENDENTE'
                          ? 'bg-amber-50/60 border-amber-300'
                          : req.status === 'APROVADO'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-white shrink-0">
                            {getRecordTypeLabel(req.recordType)}
                          </span>
                          {req.targetCode && (
                            <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-zinc-300 shrink-0">
                              {req.targetCode}
                            </span>
                          )}
                          <strong className="text-sm text-zinc-900">{req.targetName}</strong>
                          {req.recordType === 'COLABORADOR' ? (
                            req.quantity > 0 && (
                              <span className="font-mono text-xs font-semibold text-zinc-700">
                                ({req.quantity} retirada{req.quantity === 1 ? '' : 's'})
                              </span>
                            )
                          ) : (
                            <span className="font-mono text-xs font-semibold text-zinc-700">
                              ({req.quantity} un)
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded uppercase self-start sm:self-auto shrink-0 ${
                            req.status === 'PENDENTE'
                              ? 'bg-amber-200 text-amber-900'
                              : req.status === 'APROVADO'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      {req.targetDetails && (
                        <div className="text-xs text-zinc-600">{req.targetDetails}</div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-700 bg-white p-3 rounded-lg border border-zinc-200">
                        <div>
                          <span className="text-zinc-500 block">Solicitado Por:</span>
                          <strong>{req.requestedBy}</strong>
                          <span className="block text-[11px] text-zinc-500 truncate">{req.requestedByEmail}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block">Data da Solicitação:</span>
                          <strong className="font-mono">{req.date}</strong>
                        </div>
                        {req.reviewedBy ? (
                          <div>
                            <span className="text-zinc-500 block">
                              {req.status === 'APROVADO' ? 'Aprovado Por:' : 'Recusado Por:'}
                            </span>
                            <strong
                              className={
                                req.status === 'APROVADO' ? 'text-emerald-800' : 'text-zinc-800'
                              }
                            >
                              {req.reviewedBy}
                            </strong>
                            <span className="block text-[11px] text-zinc-500 font-mono">
                              em {req.reviewedAt}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-zinc-500 block">Situação:</span>
                            <strong className="text-amber-800">Aguardando aprovação</strong>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-zinc-700 bg-white p-2.5 rounded-lg border border-zinc-200">
                        <strong className="text-zinc-900">Justificativa informada: </strong>
                        {req.reason}
                      </div>

                      {req.status === 'PENDENTE' && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-amber-200">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setProcessingDeletionReqId(req.id);
                              void approveDeletionRequest(req.id)
                                .then((res) => {
                                  showNotice(
                                    res.message ||
                                      (res.success
                                        ? 'Solicitação aprovada e exclusão executada.'
                                        : 'Erro ao aprovar solicitação.'),
                                    !res.success
                                  );
                                })
                                .finally(() => setProcessingDeletionReqId(null));
                            }}
                            className="px-4 py-2 sm:py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors text-center disabled:opacity-50"
                          >
                            {isProcessing ? 'Executando Exclusão...' : 'Aprovar e Excluir Registro'}
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => {
                              setProcessingDeletionReqId(req.id);
                              void rejectDeletionRequest(req.id)
                                .then((res) => {
                                  showNotice(
                                    res.message ||
                                      (res.success
                                        ? 'Solicitação recusada.'
                                        : 'Erro ao recusar solicitação.'),
                                    !res.success
                                  );
                                })
                                .finally(() => setProcessingDeletionReqId(null));
                            }}
                            className="px-3.5 py-2 sm:py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg text-xs font-semibold transition-colors text-center disabled:opacity-50"
                          >
                            Recusar Solicitação
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permanent Audit Log Section */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 pb-3">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-700 shrink-0" />
                Histórico e Auditoria de Exclusões Realizadas
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Registro completo de quem solicitou, justificativa, quem aprovou e quem efetivamente realizou cada exclusão no sistema.
              </p>
            </div>

            {deletionLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                Nenhuma exclusão auditada foi registrada até o momento.
              </p>
            ) : (
              <div className="space-y-3">
                {deletionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/70 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                            log.origin === 'APROVADA'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-200 text-zinc-800 border border-zinc-300'
                          }`}
                        >
                          {log.origin === 'APROVADA' ? 'Via Solicitação Aprovada' : 'Exclusão Direta'}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-zinc-900 text-white shrink-0">
                          {getRecordTypeLabel(log.recordType)}
                        </span>
                        {log.targetCode && (
                          <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-zinc-300 shrink-0">
                            {log.targetCode}
                          </span>
                        )}
                        <strong className="text-zinc-900">{log.targetName}</strong>
                        {log.recordType === 'COLABORADOR' ? (
                          log.quantity > 0 && (
                            <span className="font-mono text-zinc-600">
                              ({log.quantity} retirada{log.quantity === 1 ? '' : 's'})
                            </span>
                          )
                        ) : (
                          <span className="font-mono text-zinc-600">({log.quantity} un)</span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                        {log.deletedAt}
                      </span>
                    </div>

                    {log.targetDetails && (
                      <div className="text-[11px] text-zinc-600">{log.targetDetails}</div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-zinc-200 text-[11px]">
                      <div>
                        <span className="text-zinc-500 block">Solicitado por:</span>
                        <strong className="text-zinc-900">{log.requestedBy}</strong>
                        <span className="block text-zinc-500 font-mono">{log.requestedByDate}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Aprovação:</span>
                        {log.origin === 'APROVADA' && log.approvedBy ? (
                          <>
                            <strong className="text-emerald-800">{log.approvedBy}</strong>
                            <span className="block text-zinc-500 font-mono">{log.approvedAt}</span>
                          </>
                        ) : (
                          <strong className="text-zinc-700">Não necessária (Permissão Direta)</strong>
                        )}
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Excluído por:</span>
                        <strong className="text-red-700">{log.deletedBy}</strong>
                        <span className="block text-zinc-500 truncate">{log.deletedByEmail}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-700 bg-white px-2.5 py-2 rounded border border-zinc-200">
                      <strong className="text-zinc-900">Justificativa: </strong>
                      {log.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SECTION 7 — AUTORIZAÇÕES DE ESTOQUE NEGATIVO (EXCLUSIVO DO ADMINISTRADOR) */}
      {activeSubTab === 'autorizacoes' && isPrincipalAdminMode && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
              Gestão de Solicitações de Saída com Saldo Negativo
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Pelas regras de segurança, o sistema bloqueia saídas comuns quando o saldo é insuficiente. Apenas o Administrador pode autorizar casos excepcionais individualmente.
            </p>
          </div>

          <div className="space-y-4">
            {negativeRequests.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                Nenhuma solicitação de estoque negativo registrada no sistema.
              </p>
            ) : (
              negativeRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-3.5 sm:p-4 rounded-xl border space-y-3 ${
                    req.status === 'PENDENTE'
                      ? 'bg-amber-50/60 border-amber-300'
                      : req.status === 'APROVADO'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-zinc-300 shrink-0">
                        {req.productCode}
                      </span>
                      <strong className="text-sm text-zinc-900">{req.productName}</strong>
                      <span className="text-xs text-zinc-500 font-mono">({req.group})</span>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded uppercase ${
                          req.status === 'PENDENTE'
                            ? 'bg-amber-200 text-amber-900'
                            : req.status === 'APROVADO'
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {req.status}
                      </span>
                      <button
                        type="button"
                        title={
                          pendingTargetIds.has(req.id)
                            ? 'Já existe solicitação de exclusão pendente'
                            : canDeleteDirectly
                            ? 'Excluir registro de solicitação'
                            : 'Solicitar exclusão ao Administrador'
                        }
                        onClick={() =>
                          setDeletionTarget({
                            recordType: 'SOLICITACAO_NEGATIVA',
                            targetId: req.id,
                            targetCode: req.productCode,
                            targetName: req.productName,
                            targetDetails: `Status: ${req.status} · Retirada: ${req.withdrawnBy} · Obra: ${req.destination}`,
                            quantity: req.requestedQuantity,
                            modalTitle: 'Excluir Solicitação de Estoque Negativo',
                            summaryText: (
                              <p>
                                Registro da solicitação de <strong>{req.productName}</strong> ({req.requestedQuantity} un · Obra: {req.destination}).
                              </p>
                            ),
                            stockImpactWarning:
                              req.status === 'APROVADO' ? (
                                <span>
                                  Para estornar a quantidade que saiu do estoque, exclua também a saída correspondente na aba Saídas ou Relatórios.
                                </span>
                              ) : undefined,
                          })
                        }
                        className={`p-1.5 rounded-lg transition-colors ${
                          pendingTargetIds.has(req.id)
                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                            : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-700 bg-white p-3 rounded-lg border border-zinc-200">
                    <div>
                      <span className="text-zinc-500 block">Estoque Físico Disponível:</span>
                      <strong className="font-mono">{req.availableStock} un</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Quantidade Solicitada:</span>
                      <strong className="font-mono text-red-600">{req.requestedQuantity} un</strong> (Déficit: {req.deficitQuantity} un)
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Destino da Retirada:</span>
                      <strong>{req.destination}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Colaborador que Retirou:</span>
                      <strong>{req.withdrawnBy}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Solicitado Por:</span>
                      <strong>{req.requestedBy}</strong> em {req.date}
                    </div>
                    {req.reviewedBy && (
                      <div>
                        <span className="text-zinc-500 block">Parecer do Administrador:</span>
                        <strong className="text-emerald-800">{req.reviewedBy} em {req.reviewedAt}</strong>
                      </div>
                    )}
                  </div>

                  {req.reason && (
                    <p className="text-xs text-zinc-600 bg-white p-2.5 rounded border border-zinc-200">
                      <strong>Justificativa da Urgência:</strong> {req.reason}
                    </p>
                  )}

                  {req.status === 'PENDENTE' && currentUser.isAdmin && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-amber-200">
                      <button
                        onClick={() => {
                          const res = approveNegativeStockRequest(req.id);
                          if (res.success) {
                            showNotice(res.message || 'Saída autorizada com sucesso!');
                          }
                        }}
                        className="px-4 py-2 sm:py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors text-center"
                      >
                        Autorizar Saída Excepcional
                      </button>
                      <button
                        onClick={() => {
                          rejectNegativeStockRequest(req.id);
                          showNotice('Solicitação recusada.');
                        }}
                        className="px-3.5 py-2 sm:py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors text-center"
                      >
                        Recusar Solicitação
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CONFIGURAÇÃO DE FOTOS DOS PRODUTOS */}
      {activeSubTab === 'fotos' && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-red-600 shrink-0" />
              Recurso Opcional de Fotografias dos Produtos
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Ative ou desative a renderização das fotografias nas consultas, pesquisas e listagens.
            </p>
          </div>

          <div className="p-4 sm:p-5 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-900">
                  Exibição de Fotografias no Aplicativo
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    settings.showProductPhotos
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {settings.showProductPhotos ? 'ATIVADO' : 'DESATIVADO'}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1 max-w-xl leading-relaxed">
                Quando desativada, o sistema continua funcionando perfeitamente sem espaços vazios. Quando ativada, as fotos aparecem nas consultas com ampliação de alta fidelidade.
              </p>
            </div>

            <button
              onClick={() => {
                updateSettings({ showProductPhotos: !settings.showProductPhotos });
                showNotice(`Fotos ${!settings.showProductPhotos ? 'ativadas' : 'desativadas'}.`);
              }}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.showProductPhotos ? 'bg-red-600' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.showProductPhotos ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: DADOS INSTITUCIONAIS DA QHS ENGENHARIA */}
      {activeSubTab === 'empresa' && isPrincipalAdminMode && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-red-600 shrink-0" />
              Identidade Institucional da Empresa
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Informações utilizadas em cabeçalhos e relatórios do almoxarifado.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Razão Social da Empresa
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => updateSettings({ companyName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                CNPJ
              </label>
              <input
                type="text"
                value={settings.cnpj}
                onChange={(e) => updateSettings({ cnpj: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Subtítulo do Sistema / Departamento
              </label>
              <input
                type="text"
                value={settings.companySubtitle}
                onChange={(e) => updateSettings({ companySubtitle: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                E-mail Oficial de Contato
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => updateSettings({ contactEmail: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => showNotice('Dados da empresa salvos.')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar ou Editar Usuário do Sistema */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-red-500 shrink-0" />
                {editingUser ? 'Editar Usuário do Sistema' : 'Cadastrar Usuário do Sistema'}
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                  placeholder="Ex: Fernando Matos"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  E-mail Corporativo *
                </label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                  placeholder="fernando.matos@qhsengenharia.com.br"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Cargo / Função *
                  </label>
                  <select
                    required
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg bg-white"
                  >
                    <option value="">
                      {managedLists.roles.length === 0
                        ? 'Cadastre um cargo na Lista de Cargos...'
                        : 'Selecione um cargo...'}
                    </option>
                    {userFormData.role &&
                      !managedLists.roles.includes(userFormData.role) && (
                        <option value={userFormData.role}>{userFormData.role}</option>
                      )}
                    {managedLists.roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={userFormData.department}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, department: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                    placeholder="Ex: Obras Eletromecânicas"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="activeUserCheckbox"
                    checked={userFormData.active}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, active: e.target.checked })
                    }
                    className="rounded text-red-600 focus:ring-red-600"
                  />
                  <label htmlFor="activeUserCheckbox" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                    Usuário Ativo (Autorizado a fazer login no aplicativo com este e-mail)
                  </label>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                  <input
                    type="checkbox"
                    id="canDeleteUserCheckbox"
                    checked={userFormData.isAdmin || userFormData.canDelete}
                    disabled={userFormData.isAdmin}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, canDelete: e.target.checked })
                    }
                    className="rounded text-red-600 focus:ring-red-600 mt-0.5"
                  />
                  <label htmlFor="canDeleteUserCheckbox" className="text-xs text-zinc-800 cursor-pointer leading-snug">
                    <span className="font-semibold block">
                      Permitir exclusão direta de registros (sem aprovação)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Se desmarcado, este colaborador deverá enviar solicitação com justificativa para o Administrador aprovar.
                    </span>
                  </label>
                </div>
              </div>

              {/* Permissões iniciais para este funcionário */}
              <div className="pt-2">
                <span className="block text-xs font-bold text-zinc-800 mb-2">
                  Abas que este funcionário poderá visualizar:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                  {TAB_CONFIGS.map((tab) => (
                    <label key={tab.id} className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userFormData.permissions[tab.id]}
                        onChange={(e) =>
                          setUserFormData({
                            ...userFormData,
                            permissions: {
                              ...userFormData.permissions,
                              [tab.id]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-zinc-300 text-red-600 focus:ring-red-600"
                      />
                      <span>{tab.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generic In-App Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold">{confirmDialog.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-700 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fn = confirmDialog.onConfirm;
                    setConfirmDialog(null);
                    fn();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeletionActionModal
        target={deletionTarget}
        canDeleteDirectly={canDeleteDirectly}
        hasPendingRequest={deletionTarget ? pendingTargetIds.has(deletionTarget.targetId) : false}
        isSubmitting={isSubmittingDeletion}
        onClose={() => {
          if (!isSubmittingDeletion) setDeletionTarget(null);
        }}
        onConfirmDirectDelete={async () => {
          if (!deletionTarget) return;
          setIsSubmittingDeletion(true);
          try {
            const res =
              deletionTarget.recordType === 'COLABORADOR'
                ? await deleteCollaborator(deletionTarget.targetId)
                : await deleteNegativeStockRequest(deletionTarget.targetId);
            setDeletionTarget(null);
            if (res.success) {
              showNotice(
                res.message ||
                  (deletionTarget.recordType === 'COLABORADOR'
                    ? 'Colaborador excluído do cadastro.'
                    : 'Solicitação excluída do sistema.')
              );
            } else {
              showNotice(
                res.message ||
                  (deletionTarget.recordType === 'COLABORADOR'
                    ? 'Não foi possível excluir o colaborador.'
                    : 'Não foi possível excluir a solicitação.'),
                true
              );
            }
          } finally {
            setIsSubmittingDeletion(false);
          }
        }}
        onSubmitRequest={async (reason) => {
          if (!deletionTarget) return;
          setIsSubmittingDeletion(true);
          try {
            const res = await createDeletionRequest({
              recordType: deletionTarget.recordType,
              targetId: deletionTarget.targetId,
              targetCode: deletionTarget.targetCode,
              targetName: deletionTarget.targetName,
              targetDetails: deletionTarget.targetDetails,
              quantity: deletionTarget.quantity,
              reason,
            });
            setDeletionTarget(null);
            showNotice(
              res.message ||
                (res.success
                  ? 'Solicitação de exclusão enviada ao Administrador.'
                  : 'Não foi possível enviar a solicitação.'),
              !res.success
            );
          } finally {
            setIsSubmittingDeletion(false);
          }
        }}
      />

      {/* Modal: Enviar Link de Convite */}
      {inviteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-zinc-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3.5 bg-zinc-900 text-white border-b border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <Send className="w-4 h-4 text-red-500 shrink-0" />
                <h3 className="text-sm font-bold truncate">
                  Enviar Convite para {inviteModalUser.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalUser(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1">
                <div className="text-[11px] text-zinc-500">E-mail autorizado:</div>
                <div className="font-mono font-bold text-zinc-900 break-all">
                  {inviteModalUser.email}
                </div>
              </div>

              {typeof window !== 'undefined' &&
                window.location.hostname.startsWith('ais-dev-') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                    <strong>Dica importante:</strong> você está na tela de edição (<span className="font-mono">ais-dev-...</span>). Já ajustamos o link abaixo para o endereço público compartilhado (<span className="font-mono">ais-pre-...</span>). Se quiser usar outro endereço publicado, altere no campo abaixo.
                  </div>
                )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Endereço Base do Aplicativo Publicado
                </label>
                <input
                  type="url"
                  value={inviteBaseUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInviteBaseUrl(val);
                    if (typeof window !== 'undefined' && val.trim().startsWith('http')) {
                      window.localStorage.setItem('qhs_public_app_url', val.trim());
                    }
                  }}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Link Direto de Primeiro Acesso (toque para selecionar ou copie abaixo)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    value={buildDirectInviteLink(inviteModalUser.email)}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyTextSafely(buildDirectInviteLink(inviteModalUser.email));
                      showNotice(
                        ok
                          ? 'Link direto copiado com sucesso!'
                          : 'Selecione o campo do link acima e copie manualmente.',
                        !ok
                      );
                    }}
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Link
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Mensagem Pronta para Enviar
                </label>
                <textarea
                  readOnly
                  rows={5}
                  onFocus={(e) => e.currentTarget.select()}
                  value={buildUserInviteText(inviteModalUser.name, inviteModalUser.email)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-700 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <a
                  href={buildWhatsAppHref(inviteModalUser)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Enviar por WhatsApp
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    const text = buildUserInviteText(inviteModalUser.name, inviteModalUser.email);
                    const url = buildDirectInviteLink(inviteModalUser.email);
                    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                      try {
                        await navigator.share({
                          title: 'Convite QHS Engenharia',
                          text,
                          url,
                        });
                        showNotice('Convite compartilhado com sucesso!');
                        return;
                      } catch {
                        // Fall through to copy
                      }
                    }
                    const ok = await copyTextSafely(text);
                    showNotice(
                      ok
                        ? 'Mensagem completa com link copiada!'
                        : 'Use os botões WhatsApp/E-mail ou selecione o texto acima.',
                      !ok
                    );
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar / Copiar Mensagem
                </button>

                <a
                  href={buildMailtoHref(inviteModalUser)}
                  className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Abrir no Aplicativo de E-mail
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
