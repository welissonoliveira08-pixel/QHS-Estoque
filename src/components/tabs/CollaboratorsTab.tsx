import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Collaborator, StockMovement } from '../../types';
import { DeletionActionModal, DeletionTarget } from '../DeletionActionModal';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  History,
  CheckCircle2,
  AlertCircle,
  UserX,
  UserCheck,
  X,
  HardHat,
  Package,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Trash2,
} from 'lucide-react';

const matchesCollaboratorMovement = (mov: StockMovement, colab: Collaborator): boolean => {
  if (mov.type !== 'SAIDA') return false;
  if (mov.collaboratorId) {
    return mov.collaboratorId === colab.id;
  }
  return (
    (mov.withdrawnBy || '').trim().toLowerCase() ===
    colab.fullName.trim().toLowerCase()
  );
};

export const CollaboratorsTab: React.FC = () => {
  const {
    collaborators,
    movements,
    managedLists,
    addCollaborator,
    updateCollaborator,
    toggleCollaboratorActive,
    deleteCollaborator,
    canDeleteDirectly,
    deletionRequests,
    createDeletionRequest,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS'>('TODOS');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Add/Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Inactivate/Reactivate Confirmation Modal
  const [confirmToggleTarget, setConfirmToggleTarget] = useState<Collaborator | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Deletion Modal State
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<Collaborator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pendingDeletionIds = useMemo(
    () => new Set(deletionRequests.filter((r) => r.status === 'PENDENTE').map((r) => r.targetId)),
    [deletionRequests]
  );

  // Withdrawal History Modal State
  const [historyTarget, setHistoryTarget] = useState<Collaborator | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyViewMode, setHistoryViewMode] = useState<'DETALHADO' | 'RESUMO'>('DETALHADO');

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Pre-compute stats per collaborator from real movements
  const collaboratorStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { exitsCount: number; totalUnits: number; lastDate: string; exits: StockMovement[] }
    >();

    for (const colab of collaborators) {
      const exits = movements.filter((m) => matchesCollaboratorMovement(m, colab));
      const totalUnits = exits.reduce((acc, m) => acc + m.quantity, 0);
      const lastDate = exits.length > 0 ? exits[0].date : '';
      map.set(colab.id, {
        exitsCount: exits.length,
        totalUnits,
        lastDate,
        exits,
      });
    }

    return map;
  }, [collaborators, movements]);

  const kpis = useMemo(() => {
    const total = collaborators.length;
    const activeCount = collaborators.filter((c) => c.active).length;
    const inactiveCount = total - activeCount;
    const totalWithdrawals = movements.filter((m) => m.type === 'SAIDA').length;
    return { total, activeCount, inactiveCount, totalWithdrawals };
  }, [collaborators, movements]);

  const filteredCollaborators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...collaborators]
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.fullName.localeCompare(b.fullName, 'pt-BR');
      })
      .filter((c) => {
        if (statusFilter === 'ATIVOS' && !c.active) return false;
        if (statusFilter === 'INATIVOS' && c.active) return false;
        if (!q) return true;
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.role && c.role.toLowerCase().includes(q))
        );
      });
  }, [collaborators, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    setEditingCollaborator(null);
    setFormFullName('');
    setFormRole('');
    setFormActive(true);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (colab: Collaborator) => {
    setEditingCollaborator(colab);
    setFormFullName(colab.fullName);
    setFormRole(colab.role || '');
    setFormActive(colab.active);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    const trimmedName = formFullName.trim();
    if (trimmedName.length < 2) {
      setFormError('Informe o nome completo do colaborador (mínimo 2 caracteres).');
      return;
    }

    setIsSaving(true);
    const res = editingCollaborator
      ? await updateCollaborator({
          id: editingCollaborator.id,
          fullName: trimmedName,
          role: formRole.trim(),
          active: formActive,
        })
      : await addCollaborator({
          fullName: trimmedName,
          role: formRole.trim(),
          active: formActive,
        });
    setIsSaving(false);

    if (res.success) {
      setIsFormModalOpen(false);
      showNotice(
        'success',
        res.message ||
          (editingCollaborator
            ? 'Colaborador atualizado com sucesso.'
            : 'Colaborador cadastrado com sucesso.')
      );
    } else {
      setFormError(res.message || 'Erro ao salvar colaborador.');
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!confirmToggleTarget || isToggling) return;
    setIsToggling(true);
    const res = await toggleCollaboratorActive(confirmToggleTarget.id);
    setIsToggling(false);
    setConfirmToggleTarget(null);
    showNotice(
      res.success ? 'success' : 'error',
      res.message || 'Status do colaborador atualizado.'
    );
  };

  const deletionTarget: DeletionTarget | null = useMemo(() => {
    if (!collaboratorToDelete) return null;
    const stats = collaboratorStatsMap.get(collaboratorToDelete.id) || {
      exitsCount: 0,
      totalUnits: 0,
      lastDate: '',
      exits: [],
    };
    return {
      recordType: 'COLABORADOR',
      targetId: collaboratorToDelete.id,
      targetCode: '',
      targetName: collaboratorToDelete.fullName,
      targetDetails: collaboratorToDelete.role
        ? `Função: ${collaboratorToDelete.role} · Status: ${collaboratorToDelete.active ? 'Ativo' : 'Inativo'}`
        : `Colaborador de obra · Status: ${collaboratorToDelete.active ? 'Ativo' : 'Inativo'}`,
      quantity: stats.exitsCount,
      modalTitle: canDeleteDirectly ? 'Excluir Colaborador' : 'Solicitar Exclusão de Colaborador',
      summaryText: (
        <>
          {canDeleteDirectly
            ? 'Deseja excluir o colaborador '
            : 'Solicitar ao Administrador a exclusão do colaborador '}
          <strong className="text-zinc-900">"{collaboratorToDelete.fullName}"</strong> do cadastro?
          {canDeleteDirectly
            ? ' Ele deixará de aparecer na lista de colaboradores e nas opções de seleção em Saídas.'
            : ' Após aprovação do Administrador, ele será removido da lista e das opções em Saídas.'}
        </>
      ),
      stockImpactWarning:
        stats.exitsCount > 0 ? (
          <span>
            Este colaborador possui <strong>{stats.exitsCount}</strong> retirada(s) registrada(s) (
            <strong>{stats.totalUnits} un</strong>). A exclusão remove apenas o cadastro do colaborador;
            o histórico de movimentações e as quantidades do estoque permanecerão preservados.
          </span>
        ) : undefined,
    };
  }, [collaboratorToDelete, collaboratorStatsMap, canDeleteDirectly]);

  const historyData = useMemo(() => {
    if (!historyTarget) {
      return { exits: [], filteredExits: [], summaryByProduct: [], totalUnits: 0 };
    }
    const exits = collaboratorStatsMap.get(historyTarget.id)?.exits || [];
    const q = historySearch.trim().toLowerCase();
    const filteredExits = q
      ? exits.filter(
          (m) =>
            m.productName.toLowerCase().includes(q) ||
            m.productCode.toLowerCase().includes(q) ||
            m.group.toLowerCase().includes(q) ||
            (m.destination && m.destination.toLowerCase().includes(q))
        )
      : exits;

    const productMap = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productName: string;
        group: string;
        totalQuantity: number;
        withdrawalsCount: number;
        lastDate: string;
      }
    >();

    for (const m of filteredExits) {
      const existing = productMap.get(m.productId);
      if (existing) {
        existing.totalQuantity += m.quantity;
        existing.withdrawalsCount += 1;
        if (m.date > existing.lastDate) existing.lastDate = m.date;
      } else {
        productMap.set(m.productId, {
          productId: m.productId,
          productCode: m.productCode,
          productName: m.productName,
          group: m.group,
          totalQuantity: m.quantity,
          withdrawalsCount: 1,
          lastDate: m.date,
        });
      }
    }

    const summaryByProduct = Array.from(productMap.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );
    const totalUnits = filteredExits.reduce((acc, m) => acc + m.quantity, 0);

    return { exits, filteredExits, summaryByProduct, totalUnits };
  }, [historyTarget, collaboratorStatsMap, historySearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <Users className="w-5 h-5 text-red-500" />
            </span>
            Colaboradores
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Cadastro dos funcionários da obra para identificação de quem retirou materiais no almoxarifado e consulta de histórico.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Cadastrar Colaborador
        </button>
      </div>

      {/* Explicit Governance Notice: No app access created */}
      <div className="p-4 bg-zinc-950 text-zinc-200 rounded-xl border border-zinc-800 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <strong className="text-white block">
            Controle de Retiradas sem Acesso ao Aplicativo
          </strong>
          <p className="text-zinc-400 leading-relaxed">
            Os colaboradores cadastrados nesta área <strong className="text-zinc-200">não possuem login, senha ou acesso ao sistema</strong>. Eles ficam disponíveis exclusivamente no campo{' '}
            <strong className="text-zinc-200">"Colaborador que retirou"</strong> ao registrar saídas de materiais.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-2 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-zinc-500 hover:text-zinc-800 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Total Cadastrados
          </div>
          <div className="text-2xl font-black text-zinc-900 font-mono tabular-nums mt-1">
            {kpis.total}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Funcionários na lista</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            Ativos para Retirada
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
            {kpis.activeCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Disponíveis em Saídas</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Inativos
          </div>
          <div className="text-2xl font-black text-zinc-600 font-mono tabular-nums mt-1">
            {kpis.inactiveCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Histórico preservado</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
            Retiradas Registradas
          </div>
          <div className="text-2xl font-black text-zinc-900 font-mono tabular-nums mt-1">
            {kpis.totalWithdrawals}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Saídas no almoxarifado</div>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar colaborador por nome completo ou função..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-red-600 bg-zinc-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg self-start sm:self-auto">
          {(
            [
              { key: 'TODOS', label: `Todos (${kpis.total})` },
              { key: 'ATIVOS', label: `Ativos (${kpis.activeCount})` },
              { key: 'INATIVOS', label: `Inativos (${kpis.inactiveCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                statusFilter === item.key
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredCollaborators.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-400 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-zinc-300 stroke-1" />
            <p>Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          filteredCollaborators.map((colab) => {
            const stats = collaboratorStatsMap.get(colab.id) || {
              exitsCount: 0,
              totalUnits: 0,
              lastDate: '',
            };
            return (
              <div
                key={colab.id}
                className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-900 text-sm truncate">
                      {colab.fullName}
                    </div>
                    {colab.role && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">{colab.role}</div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 ${
                      colab.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-300'
                    }`}
                  >
                    {colab.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Retiradas / Itens</span>
                    <strong className="font-mono text-zinc-900">
                      {stats.exitsCount} reg. · {stats.totalUnits} un
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Última Retirada</span>
                    <strong className="font-mono text-zinc-800">
                      {stats.lastDate || 'Nenhuma'}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryTarget(colab);
                      setHistorySearch('');
                      setHistoryViewMode('DETALHADO');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                  >
                    <History className="w-3.5 h-3.5" />
                    Histórico ({stats.exitsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(colab)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      colab.active
                        ? setConfirmToggleTarget(colab)
                        : void toggleCollaboratorActive(colab.id).then((res) =>
                            showNotice(res.success ? 'success' : 'error', res.message || '')
                          )
                    }
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg ${
                      colab.active
                        ? 'text-red-700 border-red-200 hover:bg-red-50'
                        : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {colab.active ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        Inativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Reativar
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollaboratorToDelete(colab)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border rounded-lg transition-colors ${
                      pendingDeletionIds.has(colab.id)
                        ? 'text-amber-700 border-amber-200 bg-amber-50'
                        : 'text-red-700 border-red-200 hover:bg-red-50'
                    }`}
                    title={
                      canDeleteDirectly
                        ? 'Excluir colaborador'
                        : pendingDeletionIds.has(colab.id)
                        ? 'Solicitação de exclusão pendente'
                        : 'Solicitar exclusão do colaborador'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {canDeleteDirectly ? 'Excluir' : pendingDeletionIds.has(colab.id) ? 'Solicitado' : 'Solicitar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (md+) */}
      <div className="hidden md:block bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 text-zinc-200 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3.5 px-4">Nome Completo</th>
                <th className="py-3.5 px-4">Função / Cargo</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Retiradas</th>
                <th className="py-3.5 px-4 text-right">Total de Itens Retirados</th>
                <th className="py-3.5 px-4">Última Retirada</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredCollaborators.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-400">
                    <Layers className="w-8 h-8 mx-auto text-zinc-300 stroke-1 mb-1" />
                    Nenhum colaborador cadastrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredCollaborators.map((colab) => {
                  const stats = collaboratorStatsMap.get(colab.id) || {
                    exitsCount: 0,
                    totalUnits: 0,
                    lastDate: '',
                  };
                  return (
                    <tr key={colab.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-zinc-900">
                        {colab.fullName}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        {colab.role || <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                            colab.active
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-300'
                          }`}
                        >
                          {colab.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800 tabular-nums">
                        {stats.exitsCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-700 tabular-nums">
                        {stats.totalUnits} un
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-600 whitespace-nowrap">
                        {stats.lastDate || <span className="text-zinc-400">Nenhuma</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryTarget(colab);
                              setHistorySearch('');
                              setHistoryViewMode('DETALHADO');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md text-[11px] font-semibold transition-colors"
                            title="Consultar histórico de materiais retirados"
                          >
                            <History className="w-3.5 h-3.5" />
                            Histórico
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(colab)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                            title="Editar colaborador"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              colab.active
                                ? setConfirmToggleTarget(colab)
                                : void toggleCollaboratorActive(colab.id).then((res) =>
                                    showNotice(res.success ? 'success' : 'error', res.message || '')
                                  )
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              colab.active
                                ? 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={colab.active ? 'Inativar colaborador' : 'Reativar colaborador'}
                          >
                            {colab.active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCollaboratorToDelete(colab)}
                            className={`inline-flex items-center gap-1 rounded-md transition-colors ${
                              !canDeleteDirectly ? 'px-2 py-1 text-[11px] font-semibold border ' : 'p-1.5 '
                            }${
                              pendingDeletionIds.has(colab.id)
                                ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                : !canDeleteDirectly
                                ? 'text-red-700 border-red-200 hover:bg-red-50'
                                : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={
                              canDeleteDirectly
                                ? 'Excluir colaborador'
                                : pendingDeletionIds.has(colab.id)
                                ? 'Solicitação de exclusão pendente'
                                : 'Solicitar exclusão do colaborador'
                            }
                          >
                            <Trash2 className={canDeleteDirectly ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                            {!canDeleteDirectly && (
                              <span>
                                {pendingDeletionIds.has(colab.id)
                                  ? 'Solicitado'
                                  : 'Solicitar exclusão'}
                              </span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Collaborator Modal (NO login/email/password fields) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-red-500" />
                {editingCollaborator ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Ex: João Silva Santos"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-medium"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Cargo / Função (Opcional)
                </label>
                <input
                  type="text"
                  list="collaborator-roles-datalist"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="Ex: Eletricista, Mestre de Obras, Ajudante..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                />
                <datalist id="collaborator-roles-datalist">
                  {managedLists.roles.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Status do Colaborador *
                </label>
                <select
                  value={formActive ? 'ATIVO' : 'INATIVO'}
                  onChange={(e) => setFormActive(e.target.value === 'ATIVO')}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-semibold"
                >
                  <option value="ATIVO">Ativo — Disponível no campo "Colaborador que retirou"</option>
                  <option value="INATIVO">Inativo — Oculto para novas retiradas (histórico mantido)</option>
                </select>
              </div>

              <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] text-zinc-600">
                Este cadastro não cria conta de usuário, login ou senha de acesso ao sistema.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Inactivate Collaborator Modal */}
      {confirmToggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold">Inativar Colaborador</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmToggleTarget(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-zinc-700 leading-relaxed">
                Deseja inativar o colaborador{' '}
                <strong className="text-zinc-900">"{confirmToggleTarget.fullName}"</strong>? Ele
                deixará de aparecer nas novas retiradas de materiais, mas todo o histórico de
                retiradas anteriores será preservado para consulta.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setConfirmToggleTarget(null)}
                  className="px-4 py-2 text-zinc-700 hover:bg-zinc-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isToggling}
                  onClick={handleConfirmToggleActive}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {isToggling ? 'Inativando...' : 'Confirmar Inativação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collaborator Withdrawal History Modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 text-white shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <History className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="truncate">
                    Histórico de Materiais Retirados — {historyTarget.fullName}
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {historyTarget.role ? `${historyTarget.role} · ` : ''}
                  Status: {historyTarget.active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="text-zinc-400 hover:text-white p-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Filtrar histórico por material, código, grupo ou obra..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                  />
                </div>

                <div className="flex items-center gap-1 bg-zinc-200/80 p-1 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryViewMode('DETALHADO')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      historyViewMode === 'DETALHADO'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Retiradas Detalhadas
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryViewMode('RESUMO')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      historyViewMode === 'RESUMO'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Resumo por Material
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-700">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                  Registros encontrados:{' '}
                  <strong className="font-mono">{historyData.filteredExits.length}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-zinc-600" />
                  Total retirado:{' '}
                  <strong className="font-mono text-red-700">{historyData.totalUnits} un</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-600" />
                  Materiais distintos:{' '}
                  <strong className="font-mono">{historyData.summaryByProduct.length}</strong>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {historyData.filteredExits.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
                  <Package className="w-8 h-8 mx-auto text-zinc-300 stroke-1" />
                  <p>Nenhuma retirada de material encontrada para este colaborador.</p>
                </div>
              ) : historyViewMode === 'DETALHADO' ? (
                <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-white uppercase text-[11px] font-semibold">
                      <tr>
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3.5">Código</th>
                        <th className="py-3 px-3.5">Material</th>
                        <th className="py-3 px-3.5">Grupo</th>
                        <th className="py-3 px-3.5 text-right">Qtd. Retirada</th>
                        <th className="py-3 px-3.5">Obra / Destino</th>
                        <th className="py-3 px-3.5">Resp. Registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {historyData.filteredExits.map((mov) => (
                        <tr key={mov.id} className="hover:bg-zinc-50">
                          <td className="py-2.5 px-3.5 font-mono text-zinc-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              {mov.date}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-bold text-zinc-900 whitespace-nowrap">
                            <span className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                              {mov.productCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-zinc-900">
                            <div>{mov.productName}</div>
                            {mov.notes && (
                              <div className="text-[11px] text-zinc-500 font-normal">
                                Obs.: {mov.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-zinc-600 whitespace-nowrap">
                            {mov.group}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-red-700 whitespace-nowrap tabular-nums">
                            -{mov.quantity} un
                          </td>
                          <td className="py-2.5 px-3.5 text-zinc-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <HardHat className="w-3.5 h-3.5 text-red-600" />
                              {mov.destination || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-zinc-500 whitespace-nowrap text-[11px]">
                            {mov.responsibleUser}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-white uppercase text-[11px] font-semibold">
                      <tr>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Material</th>
                        <th className="py-3 px-4">Grupo</th>
                        <th className="py-3 px-4 text-right">Qtd. de Retiradas</th>
                        <th className="py-3 px-4 text-right">Total Retirado</th>
                        <th className="py-3 px-4">Última Retirada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {historyData.summaryByProduct.map((item) => (
                        <tr key={item.productId} className="hover:bg-zinc-50">
                          <td className="py-2.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                            <span className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                              {item.productCode}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-zinc-900">
                            {item.productName}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap">
                            {item.group}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-zinc-700 tabular-nums">
                            {item.withdrawalsCount}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700 tabular-nums">
                            {item.totalQuantity} un
                          </td>
                          <td className="py-2.5 px-4 font-mono text-zinc-600 whitespace-nowrap">
                            {item.lastDate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeletionActionModal
        target={deletionTarget}
        canDeleteDirectly={canDeleteDirectly}
        hasPendingRequest={
          collaboratorToDelete ? pendingDeletionIds.has(collaboratorToDelete.id) : false
        }
        isSubmitting={isDeleting}
        onClose={() => {
          if (!isDeleting) setCollaboratorToDelete(null);
        }}
        onConfirmDirectDelete={async () => {
          if (!collaboratorToDelete) return;
          setIsDeleting(true);
          try {
            const res = await deleteCollaborator(collaboratorToDelete.id);
            setCollaboratorToDelete(null);
            showNotice(
              res.success ? 'success' : 'error',
              res.message ||
                (res.success
                  ? 'Colaborador excluído com sucesso.'
                  : 'Não foi possível excluir o colaborador.')
            );
          } finally {
            setIsDeleting(false);
          }
        }}
        onSubmitRequest={async (reason) => {
          if (!deletionTarget) return;
          setIsDeleting(true);
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
            setCollaboratorToDelete(null);
            showNotice(
              res.success ? 'success' : 'error',
              res.message ||
                (res.success
                  ? 'Solicitação de exclusão enviada ao Administrador.'
                  : 'Não foi possível enviar a solicitação.')
            );
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
};
