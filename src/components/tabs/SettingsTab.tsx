import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TabId, User, UserPermissions } from '../../types';
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
} from 'lucide-react';

const TAB_CONFIGS: { id: TabId; label: string; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Acesso a KPIs e alertas' },
  { id: 'produtos', label: 'Cadastro de Produtos', desc: 'Visualizar e cadastrar produtos' },
  { id: 'entradas', label: 'Entradas', desc: 'Recebimento de materiais' },
  { id: 'saidas', label: 'Saídas', desc: 'Requisições para canteiros de obras' },
  { id: 'relatorios', label: 'Relatórios', desc: 'Emissão e exportação de relatórios' },
  { id: 'estatisticas', label: 'Estatísticas', desc: 'Giro de estoque e métricas' },
  { id: 'configuracoes', label: 'Configurações', desc: 'Gerenciamento de listas e permissões' },
];

export const SettingsTab: React.FC = () => {
  const {
    settings,
    updateSettings,
    users,
    updateUserPermissions,
    updateUser,
    addUser,
    deleteUser,
    currentUser,
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
    pendingNegativeRequestsCount,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'listas' | 'permissoes' | 'autorizacoes' | 'fotos' | 'empresa'>('listas');
  const [noticeMessage, setNoticeMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // SECTION 3: List Management Form States
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupName, setEditingGroupName] = useState<{ oldName: string; currentVal: string } | null>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRoleName, setEditingRoleName] = useState<{ oldName: string; currentVal: string } | null>(null);

  const [newDestinationName, setNewDestinationName] = useState('');
  const [editingDestinationName, setEditingDestinationName] = useState<{ oldName: string; currentVal: string } | null>(null);

  // New Employee Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: managedLists.roles[0] || 'Técnico de Campo',
    department: 'Operações de Campo',
    isAdmin: false,
    active: true,
    permissions: {
      dashboard: false,
      produtos: true,
      entradas: false,
      saidas: true,
      relatorios: false,
      estatisticas: false,
      configuracoes: false,
    } as UserPermissions,
  });

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
    if (window.confirm(`Confirma a exclusão do grupo "${name}"?`)) {
      const res = deleteGroup(name);
      if (res.success) {
        showNotice(`Grupo "${name}" excluído.`);
      } else {
        showNotice(res.message || 'Não foi possível excluir.', true);
      }
    }
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
    if (window.confirm(`Excluir o cargo "${name}" das opções?`)) {
      deleteRole(name);
      showNotice(`Cargo "${name}" removido.`);
    }
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
    if (window.confirm(`Excluir a obra "${name}"?`)) {
      deleteDestination(name);
      showNotice(`Obra "${name}" excluída.`);
    }
  };

  // Permissions Toggle
  const handleTogglePermission = (user: User, tabId: TabId) => {
    if (user.isAdmin) {
      alert('Administradores possuem acesso total a todas as funcionalidades.');
      return;
    }
    const updatedPermissions: UserPermissions = {
      ...user.permissions,
      [tabId]: !user.permissions[tabId],
    };
    updateUserPermissions(user.id, updatedPermissions);
    showNotice(`Permissão da aba "${tabId}" atualizada para ${user.name}`);
  };

  const handleGrantAll = (user: User) => {
    if (user.isAdmin) return;
    const allTrue: UserPermissions = {
      dashboard: true,
      produtos: true,
      entradas: true,
      saidas: true,
      relatorios: true,
      estatisticas: true,
      configuracoes: true,
    };
    updateUserPermissions(user.id, allTrue);
    showNotice(`Todas as abas liberadas para ${user.name}`);
  };

  const handleRevokeAll = (user: User) => {
    if (user.isAdmin) return;
    const allFalse: UserPermissions = {
      dashboard: false,
      produtos: false,
      entradas: false,
      saidas: false,
      relatorios: false,
      estatisticas: false,
      configuracoes: false,
    };
    updateUserPermissions(user.id, allFalse);
    showNotice(`Todas as abas bloqueadas para ${user.name}`);
  };

  // Employee Add / Edit
  const handleOpenAddEmployee = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      email: '',
      role: managedLists.roles[0] || 'Técnico de Campo',
      department: 'Operações de Campo',
      isAdmin: false,
      active: true,
      permissions: {
        dashboard: false,
        produtos: true,
        entradas: false,
        saidas: true,
        relatorios: false,
        estatisticas: false,
        configuracoes: false,
      },
    });
    setIsAddUserModalOpen(true);
  };

  const handleOpenEditEmployee = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isAdmin: user.isAdmin,
      active: user.active,
      permissions: { ...user.permissions },
    });
    setIsAddUserModalOpen(true);
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
      showNotice(`Colaborador ${userFormData.name} cadastrado com sucesso!`);
    }

    setIsAddUserModalOpen(false);
  };

  const handleToggleUserActive = (user: User) => {
    if (user.id === 'user-admin') {
      alert('Não é permitido inativar o Administrador principal.');
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.confirm('Deseja restaurar as configurações e dados de fábrica?')) {
                resetAllData();
                showNotice('Dados e configurações restaurados com sucesso.');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 hover:text-red-600 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>
        </div>
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

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-100 rounded-xl">
        <button
          onClick={() => setActiveSubTab('listas')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'listas'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ListPlus className="w-4 h-4 text-red-600" />
          <span>Gerenciamento de Listas & Cadastros</span>
        </button>

        <button
          onClick={() => setActiveSubTab('permissoes')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'permissoes'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Shield className="w-4 h-4 text-red-600" />
          <span>Permissões de Abas</span>
        </button>

        <button
          onClick={() => setActiveSubTab('autorizacoes')}
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

        <button
          onClick={() => setActiveSubTab('fotos')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'fotos'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Eye className="w-4 h-4 text-zinc-500" />
          <span>Fotos dos Produtos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('empresa')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeSubTab === 'empresa'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Building className="w-4 h-4 text-zinc-500" />
          <span>Dados da Empresa</span>
        </button>
      </div>

      {/* SUB-TAB 1: SECTION 3 — GERENCIAMENTO DE CADASTROS E LISTAS (ÁREA CENTRALIZADA DO ADMINISTRADOR) */}
      {activeSubTab === 'listas' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
            <div className="border-b border-zinc-100 pb-3">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-red-600" />
                Gerenciamento Centralizado de Listas e Opções
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Todas as opções adicionadas, editadas ou inativadas nesta área aparecem automaticamente nos campos de seleção do aplicativo, sem precisar abrir formulários individuais.
              </p>
            </div>

            {/* 1. GRUPOS DE PRODUTOS (Materiais, Extintores, Placas + Novos Grupos) */}
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-red-600" />
                    Grupos de Produtos
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Grupos iniciais: <strong>Materiais</strong>, <strong>Extintores</strong> e <strong>Placas</strong>. Você pode adicionar outros grupos conforme desejar.
                  </span>
                </div>

                {/* Form to add group */}
                <form onSubmit={handleAddGroupSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do novo grupo..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
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
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-zinc-700" />
                    Lista de Cargos
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Cargos cadastrados para qualificação de funcionários.
                  </span>
                </div>

                <form onSubmit={handleAddRoleSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Novo cargo..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors"
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
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-red-600" />
                    Canteiros de Obras & Locais de Destino
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Opções disponíveis para seleção no formulário de saídas de materiais.
                  </span>
                </div>

                <form onSubmit={handleAddDestSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome da nova obra..."
                    value={newDestinationName}
                    onChange={(e) => setNewDestinationName(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors"
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

            {/* 4. FUNCIONÁRIOS CADASTRADOS & STATUS DE ATIVAÇÃO */}
            <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-zinc-700" />
                    Gerenciamento de Funcionários (Retiradas & Responsáveis)
                  </h3>
                  <span className="text-xs text-zinc-500">
                    Colaboradores que aparecem na seleção de <strong>"Funcionário que retirou o material"</strong> e lançadores de movimentações.
                  </span>
                </div>

                <button
                  onClick={handleOpenAddEmployee}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar Colaborador
                </button>
              </div>

              <div className="overflow-x-auto bg-white rounded-lg border border-zinc-200">
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
                              onClick={() => handleOpenEditEmployee(user)}
                              className="p-1 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded"
                              title="Editar funcionário"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!user.isAdmin && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Excluir o funcionário "${user.name}"?`)) {
                                    deleteUser(user.id);
                                    showNotice(`Funcionário "${user.name}" excluído.`);
                                  }
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

      {/* SUB-TAB 2: PERMISSÕES INDIVIDUAIS DE ABAS */}
      {activeSubTab === 'permissoes' && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-bold text-zinc-900">
              Matriz de Permissões Individuais por Funcionário
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Como administrador, você pode liberar ou bloquear o acesso a cada uma das 7 abas do sistema para cada colaborador individualmente.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-white font-semibold">
                <tr>
                  <th className="py-3 px-4 min-w-[200px]">Colaborador</th>
                  <th className="py-3 px-3 text-center">Dashboard</th>
                  <th className="py-3 px-3 text-center">Produtos</th>
                  <th className="py-3 px-3 text-center">Entradas</th>
                  <th className="py-3 px-3 text-center">Saídas</th>
                  <th className="py-3 px-3 text-center">Relatórios</th>
                  <th className="py-3 px-3 text-center">Estatísticas</th>
                  <th className="py-3 px-3 text-center">Configurações</th>
                  <th className="py-3 px-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUser.id;

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

      {/* SUB-TAB 3: SECTION 7 — AUTORIZAÇÕES DE ESTOQUE NEGATIVO (EXCLUSIVO DO ADMINISTRADOR) */}
      {activeSubTab === 'autorizacoes' && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
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
                  className={`p-4 rounded-xl border space-y-3 ${
                    req.status === 'PENDENTE'
                      ? 'bg-amber-50/60 border-amber-300'
                      : req.status === 'APROVADO'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-zinc-300">
                        {req.productCode}
                      </span>
                      <strong className="text-sm text-zinc-900">{req.productName}</strong>
                      <span className="text-xs text-zinc-500 font-mono">({req.group})</span>
                    </div>

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
                      <span className="text-zinc-500 block">Funcionário que Retirará:</span>
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
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                      <button
                        onClick={() => {
                          const res = approveNegativeStockRequest(req.id);
                          if (res.success) {
                            showNotice(res.message || 'Saída autorizada com sucesso!');
                          }
                        }}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        Autorizar Saída Excepcional
                      </button>
                      <button
                        onClick={() => {
                          rejectNegativeStockRequest(req.id);
                          showNotice('Solicitação recusada.');
                        }}
                        className="px-3.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-xs font-semibold transition-colors"
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
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-red-600" />
              Recurso Opcional de Fotografias dos Produtos
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Ative ou desative a renderização das fotografias nas consultas, pesquisas e listagens.
            </p>
          </div>

          <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-4">
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
      {activeSubTab === 'empresa' && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-red-600" />
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
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar ou Editar Colaborador */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-red-500" />
                {editingUser ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Cargo / Função *
                  </label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg bg-white"
                  >
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

              <div className="flex items-center gap-2 pt-1">
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
                  Colaborador Ativo (Aparece na lista de retiradas e lançamentos)
                </label>
              </div>

              {/* Permissões iniciais para este funcionário */}
              <div className="pt-2">
                <span className="block text-xs font-bold text-zinc-800 mb-2">
                  Abas que este funcionário poderá visualizar:
                </span>
                <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
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
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
