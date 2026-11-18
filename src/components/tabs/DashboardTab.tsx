import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockMovement } from '../../types';
import { DeletionActionModal, DeletionTarget } from '../DeletionActionModal';
import {
  Package,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  ArrowRight,
  Clock,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const {
    products,
    movements,
    currentUser,
    isRealAdmin,
    canDeleteDirectly,
    deletionRequests,
    createDeletionRequest,
    pendingDeletionRequestsCount,
    setActiveTab,
    openSettingsSubTab,
    canAccessTab,
    pendingNegativeRequestsCount,
    deleteMovement,
  } = useApp();

  const [movementToDelete, setMovementToDelete] = useState<StockMovement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pendingDeletionIds = useMemo(
    () => new Set(deletionRequests.filter((r) => r.status === 'PENDENTE').map((r) => r.targetId)),
    [deletionRequests]
  );

  // Metrics
  const totalProducts = products.length;
  const totalUnitsInStock = products.reduce((acc, p) => acc + p.currentStock, 0);

  // Products with low stock, sorted by greatest need of replenishment first (most negative or lowest ratio)
  const criticalProducts = useMemo(() => {
    return products
      .filter((p) => p.currentStock <= p.minStock)
      .sort((a, b) => {
        const deficitA = a.minStock - a.currentStock;
        const deficitB = b.minStock - b.currentStock;
        return deficitB - deficitA; // Highest deficit first
      });
  }, [products]);

  const recentMovements = movements.slice(0, 5);

  // Category distribution by physical quantity
  const categoryStats = useMemo(() => {
    return products.reduce((acc, p) => {
      acc[p.group] = (acc[p.group] || 0) + p.currentStock;
      return acc;
    }, {} as Record<string, number>);
  }, [products]);

  const handleConfirmDeleteMovement = async () => {
    if (!movementToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = movementToDelete;
    const res = await deleteMovement(target.id);
    setIsDeleting(false);
    setMovementToDelete(null);

    if (res.success) {
      const label = target.type === 'ENTRADA' ? 'Entrada' : 'Saída';
      const stockInfo =
        res.productUpdated && res.newStock !== undefined
          ? ` Estoque atual de "${target.productName}": ${res.newStock} un.`
          : '';
      setFeedback({
        type: 'success',
        message: `${label} de ${target.quantity} un de "${target.productName}" excluída com sucesso.${stockInfo}`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Erro ao excluir a movimentação.',
      });
    }
  };

  const handleRequestDeleteMovement = async (reason: string) => {
    if (!movementToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = movementToDelete;
    const detailsParts = [
      `Data: ${target.date}`,
      `Resp: ${target.responsibleUser}`,
      target.withdrawnBy ? `Retirado por: ${target.withdrawnBy}` : '',
      target.destination ? `Obra: ${target.destination}` : '',
    ].filter(Boolean);

    const res = await createDeletionRequest({
      recordType: target.type,
      targetId: target.id,
      targetCode: target.productCode,
      targetName: target.productName,
      targetDetails: detailsParts.join(' · '),
      quantity: target.quantity,
      reason,
    });
    setIsDeleting(false);
    setMovementToDelete(null);

    setFeedback({
      type: res.success ? 'success' : 'error',
      message:
        res.message ||
        (res.success
          ? 'Solicitação de exclusão enviada ao Administrador.'
          : 'Erro ao solicitar exclusão.'),
    });
    setTimeout(() => setFeedback(null), 6000);
  };

  const movementDeletionTarget: DeletionTarget | null = movementToDelete
    ? {
        recordType: movementToDelete.type,
        targetId: movementToDelete.id,
        targetCode: movementToDelete.productCode,
        targetName: movementToDelete.productName,
        targetDetails: `${movementToDelete.type} em ${movementToDelete.date}`,
        quantity: movementToDelete.quantity,
        modalTitle: `Confirmar Exclusão de ${
          movementToDelete.type === 'ENTRADA' ? 'Entrada' : 'Saída'
        }`,
        summaryText: (
          <>
            {canDeleteDirectly ? 'Tem certeza que deseja excluir a movimentação de ' : 'Solicitar exclusão da movimentação de '}
            <strong className={movementToDelete.type === 'ENTRADA' ? 'text-emerald-700' : 'text-red-700'}>
              {movementToDelete.type === 'ENTRADA' ? '+' : '-'}{movementToDelete.quantity} un
            </strong>{' '}
            do produto <strong className="text-zinc-900">"{movementToDelete.productName}"</strong>{' '}
            (<span className="font-mono font-semibold">{movementToDelete.productCode}</span>)?
          </>
        ),
        stockImpactWarning: (
          <span>
            Esta ação apagará o registro definitivamente e{' '}
            {movementToDelete.type === 'ENTRADA' ? (
              <strong>retirará {movementToDelete.quantity} unidade(s) do estoque</strong>
            ) : (
              <strong>devolverá {movementToDelete.quantity} unidade(s) ao estoque</strong>
            )}
            , atualizando indicadores e relatórios automaticamente.
          </span>
        ),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-xl p-4 sm:p-6 border border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-red-500 font-semibold uppercase tracking-wider">
              <span>QHS Engenharia</span>
              <span>·</span>
              <span>Almoxarifado & Gestão Operacional</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white mt-1">
              Olá, {currentUser.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Acompanhe em tempo real as quantidades em estoque, movimentações de materiais para as frentes de obras e alertas preventivos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {canAccessTab('entradas') && (
              <button
                onClick={() => setActiveTab('entradas')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <ArrowDownRight className="w-4 h-4" />
                Registrar Entrada
              </button>
            )}
            {canAccessTab('saidas') && (
              <button
                onClick={() => setActiveTab('saidas')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <ArrowUpRight className="w-4 h-4" />
                Registrar Saída
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-2 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
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
            className="text-zinc-500 hover:text-zinc-800 p-0.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Negative Stock Alert for Administrator */}
      {isRealAdmin && currentUser.isAdmin && pendingNegativeRequestsCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 bg-red-600 text-white rounded-lg flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-red-950 uppercase tracking-wide">
                {pendingNegativeRequestsCount} Solicitação(ões) de Saída com Estoque Negativo Aguardando Autorização
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                Colaboradores de obras solicitaram liberação excepcional de saída acima do estoque físico disponível.
              </p>
            </div>
          </div>
          {canAccessTab('configuracoes') && (
            <button
              onClick={() => openSettingsSubTab('autorizacoes')}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors shadow-xs"
            >
              Analisar Solicitações
            </button>
          )}
        </div>
      )}

      {/* Pending Deletion Requests Alert for Principal Administrator */}
      {isRealAdmin && currentUser.isAdmin && pendingDeletionRequestsCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 bg-amber-600 text-white rounded-lg flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                {pendingDeletionRequestsCount} Solicitação(ões) de Exclusão de Registros Aguardando Aprovação
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Usuários sem permissão de exclusão direta enviaram justificativas para remoção de registros.
              </p>
            </div>
          </div>
          {canAccessTab('configuracoes') && (
            <button
              onClick={() => openSettingsSubTab('exclusoes')}
              className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors shadow-xs"
            >
              Analisar Exclusões
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Grid (Top) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Itens no Catálogo */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Itens Cadastrados</span>
            <Package className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {totalProducts}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Itens ativos no catálogo
          </p>
        </div>

        {/* KPI 2: Total de Unidades Físicas */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total em Estoque</span>
            <Layers className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {totalUnitsInStock}
          </div>
          <p className="text-[11px] text-zinc-600 font-medium mt-1">
            Unidades físicas disponíveis
          </p>
        </div>

        {/* KPI 3: Itens em Alerta Crítico */}
        <div
          onClick={() => {
            if (criticalProducts.length === 0) return;
            // Scroll smoothly down to the bottom alert table
            const el = document.getElementById('alerta-estoque-minimo-tabela');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-5 rounded-xl border shadow-xs transition-colors ${
            criticalProducts.length > 0
              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 cursor-pointer'
              : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Abaixo do Mínimo</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                criticalProducts.length > 0 ? 'text-amber-600' : 'text-zinc-400'
              }`}
            />
          </div>
          <div
            className={`font-mono text-2xl font-black tabular-nums ${
              criticalProducts.length > 0 ? 'text-amber-700' : 'text-zinc-900'
            }`}
          >
            {criticalProducts.length}
          </div>
          <p
            className={`text-[11px] font-medium mt-1 ${
              criticalProducts.length > 0 ? 'text-amber-700' : 'text-zinc-500'
            }`}
          >
            {criticalProducts.length > 0
              ? 'Ver tabela detalhada abaixo'
              : 'Nenhum item em nível crítico'}
          </p>
        </div>

        {/* KPI 4: Total de Movimentações */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Movimentações</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {movements.length}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Entradas e saídas registradas
          </p>
        </div>
      </div>

      {/* Middle Grid: Recent Movements & Volume by Group */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Movements (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Últimas Movimentações no Almoxarifado
              </h2>
              <span className="text-xs text-zinc-500">
                Recebimentos e requisições para canteiros de obra
              </span>
            </div>
            {canAccessTab('relatorios') && (
              <button
                onClick={() => setActiveTab('relatorios')}
                className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                Ver Relatórios
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-zinc-100">
            {recentMovements.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Nenhuma movimentação registrada até o momento.
              </p>
            ) : (
              recentMovements.map((mov) => {
                const isEntry = mov.type === 'ENTRADA';
                return (
                  <div key={mov.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          isEntry
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                      >
                        {isEntry ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-mono font-semibold text-zinc-900">
                            {mov.productCode}
                          </span>
                          <span className="text-zinc-800 font-medium break-words">
                            {mov.productName}
                          </span>
                          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-medium">
                            {mov.group}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {mov.destination && <span>Destino: {mov.destination}</span>}
                          {mov.withdrawnBy && <span>· Retirou: {mov.withdrawnBy}</span>}
                          <span>· Resp: {mov.responsibleUser}</span>
                          <span>· Saldo pós-movimento: <strong>{mov.stockAfterMovement} un</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pl-10 sm:pl-0 gap-2.5 shrink-0">
                      <div className="sm:text-right">
                        <div
                          className={`font-mono font-bold tabular-nums ${
                            isEntry ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isEntry ? '+' : '-'} {mov.quantity} un
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {mov.date}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMovementToDelete(mov)}
                        title={
                          pendingDeletionIds.has(mov.id)
                            ? 'Solicitação de exclusão pendente'
                            : canDeleteDirectly
                            ? 'Excluir movimentação'
                            : 'Solicitar exclusão'
                        }
                        className={`p-1.5 rounded-lg transition-colors ${
                          pendingDeletionIds.has(mov.id)
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Categories & Quantity Allocation (1 col) */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900">
              Distribuição por Grupo
            </h2>
            <span className="text-xs text-zinc-500">
              Volume físico armazenado em cada categoria
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(categoryStats).length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Nenhum produto cadastrado no estoque até o momento.
              </p>
            ) : (
              Object.entries(categoryStats).map(([cat, val]) => {
                const percent = totalUnitsInStock > 0 ? (val / totalUnitsInStock) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-700 font-medium truncate max-w-[160px]">
                        {cat}
                      </span>
                      <span className="font-mono font-bold text-zinc-900 tabular-nums">
                        {val} un
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                      />
                    </div>
                    <div className="flex justify-end text-[10px] text-zinc-400 font-mono">
                      {percent.toFixed(1)}% do estoque
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1 REQUIREMENT: ALERTA PREVENTIVO DE ESTOQUE MÍNIMO NA PARTE INFERIOR DO DASHBOARD */}
      {/* Exibir apenas quando houver produtos cadastrados em situação crítica / abaixo do estoque mínimo */}
      {criticalProducts.length > 0 && (
        <div
          id="alerta-estoque-minimo-tabela"
          className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden"
        >
          <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-sm font-bold tracking-tight">
                Alertas Preventivos de Estoque Mínimo
              </h2>
              <span className="text-xs bg-red-600 text-white font-mono font-bold px-2 py-0.5 rounded-full">
                {criticalProducts.length} {criticalProducts.length === 1 ? 'item crítico' : 'itens críticos'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">
              Ordenado pela maior necessidade de reposição (atualização automática)
            </span>
          </div>

          {/* Mobile Vertical List (< md) */}
          <div className="md:hidden divide-y divide-zinc-200">
            {criticalProducts.map((p) => {
              let statusLabel = 'Abaixo do Mínimo';
              let statusClass = 'bg-amber-100 text-amber-900 border-amber-300';

              if (p.currentStock <= 0) {
                statusLabel = p.currentStock < 0 ? `Negativo (${p.currentStock})` : 'Estoque Zerado';
                statusClass = 'bg-red-100 text-red-900 border-red-300 font-bold';
              } else if (p.currentStock <= p.minStock / 2) {
                statusLabel = 'Crítico Urgente';
                statusClass = 'bg-red-50 text-red-800 border-red-200 font-semibold';
              }

              return (
                <div key={p.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {p.code}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-medium">{p.group}</span>
                      </div>
                      <p className="font-semibold text-zinc-900 mt-1">{p.name}</p>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border shrink-0 ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Atual</span>
                        <span className="font-mono font-bold text-red-600 tabular-nums">{p.currentStock} un</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block">Mínimo</span>
                        <span className="font-mono text-zinc-600 tabular-nums">{p.minStock} un</span>
                      </div>
                    </div>
                    {canAccessTab('entradas') && (
                      <button
                        onClick={() => setActiveTab('entradas')}
                        className="px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
                      >
                        Repor
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-700 font-semibold border-b border-zinc-200">
                <tr>
                  <th className="py-2.5 px-4 w-32">Código</th>
                  <th className="py-2.5 px-4">Nome do Produto</th>
                  <th className="py-2.5 px-4">Grupo</th>
                  <th className="py-2.5 px-4 text-right">Estoque Atual</th>
                  <th className="py-2.5 px-4 text-right">Estoque Mínimo</th>
                  <th className="py-2.5 px-4 text-center">Situação</th>
                  {canAccessTab('entradas') && (
                    <th className="py-2.5 px-4 text-center w-28">Ação Rápida</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {criticalProducts.map((p) => {
                  let statusLabel = 'Abaixo do Mínimo';
                  let statusClass = 'bg-amber-100 text-amber-900 border-amber-300';

                  if (p.currentStock <= 0) {
                    statusLabel = p.currentStock < 0 ? `Negativo (${p.currentStock})` : 'Estoque Zerado';
                    statusClass = 'bg-red-100 text-red-900 border-red-300 font-bold';
                  } else if (p.currentStock <= p.minStock / 2) {
                    statusLabel = 'Crítico Urgente';
                    statusClass = 'bg-red-50 text-red-800 border-red-200 font-semibold';
                  }

                  return (
                    <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                        <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {p.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 text-zinc-600 font-medium">
                        {p.group}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums">
                        {p.currentStock} un
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-600 tabular-nums">
                        {p.minStock} un
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] border ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      {canAccessTab('entradas') && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setActiveTab('entradas')}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shadow-xs"
                          >
                            Repor
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DeletionActionModal
        target={movementDeletionTarget}
        canDeleteDirectly={canDeleteDirectly}
        hasPendingRequest={
          movementToDelete ? pendingDeletionIds.has(movementToDelete.id) : false
        }
        isSubmitting={isDeleting}
        onClose={() => setMovementToDelete(null)}
        onConfirmDirectDelete={handleConfirmDeleteMovement}
        onSubmitRequest={handleRequestDeleteMovement}
      />
    </div>
  );
};
