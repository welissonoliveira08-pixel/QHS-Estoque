import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const {
    products,
    movements,
    currentUser,
    setActiveTab,
    canAccessTab,
    pendingNegativeRequestsCount,
  } = useApp();

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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-xl p-6 border border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-red-500 font-semibold uppercase tracking-wider">
              <span>QHS Engenharia</span>
              <span>·</span>
              <span>Almoxarifado & Gestão Operacional</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white mt-1">
              Olá, {currentUser.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Acompanhe em tempo real as quantidades em estoque, movimentações de materiais para as frentes de obras e alertas preventivos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canAccessTab('entradas') && (
              <button
                onClick={() => setActiveTab('entradas')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <ArrowDownRight className="w-4 h-4" />
                Registrar Entrada
              </button>
            )}
            {canAccessTab('saidas') && (
              <button
                onClick={() => setActiveTab('saidas')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
              >
                <ArrowUpRight className="w-4 h-4" />
                Registrar Saída
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Negative Stock Alert for Administrator */}
      {currentUser.isAdmin && pendingNegativeRequestsCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
              onClick={() => setActiveTab('configuracoes')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors shadow-xs"
            >
              Analisar Solicitações
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
            // Scroll smoothly down to the bottom alert table
            const el = document.getElementById('alerta-estoque-minimo-tabela');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-5 rounded-xl border shadow-xs transition-colors cursor-pointer ${
            criticalProducts.length > 0
              ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
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
                  <div key={mov.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-zinc-900">
                            {mov.productCode}
                          </span>
                          <span className="text-zinc-800 font-medium truncate">
                            {mov.productName}
                          </span>
                          <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-medium">
                            {mov.group}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate flex items-center gap-2 mt-0.5">
                          {mov.destination && <span>Destino: {mov.destination}</span>}
                          {mov.withdrawnBy && <span>· Retirou: {mov.withdrawnBy}</span>}
                          <span>· Resp: {mov.responsibleUser}</span>
                          <span>· Saldo pós-movimento: <strong>{mov.stockAfterMovement} un</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
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
            {Object.entries(categoryStats).map(([cat, val]) => {
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
            })}
          </div>
        </div>
      </div>

      {/* SECTION 1 REQUIREMENT: ALERTA PREVENTIVO DE ESTOQUE MÍNIMO NA PARTE INFERIOR DO DASHBOARD */}
      {/* Apresentação semelhante a uma tabela pequena, organizada verticalmente, com um produto em cada linha */}
      {/* Linhas organizadas com: Código, Nome, Grupo, Estoque atual, Estoque mínimo, Situação */}
      {/* Exibir primeiro os produtos com maior necessidade de reposição */}
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

        <div className="overflow-x-auto">
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
              {criticalProducts.length === 0 ? (
                <tr>
                  <td colSpan={canAccessTab('entradas') ? 7 : 6} className="py-8 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mb-1" />
                      <p className="font-semibold text-zinc-800">
                        Nenhum produto abaixo do estoque mínimo
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Todos os materiais e itens da QHS Engenharia estão operando com saldo de segurança normal.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                criticalProducts.map((p) => {
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
