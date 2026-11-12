import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { BarChart3, TrendingUp, Package, Layers } from 'lucide-react';

export const StatisticsTab: React.FC = () => {
  const { products, movements } = useApp();

  const totalInventoryUnits = useMemo(
    () => products.reduce((acc, p) => acc + p.currentStock, 0),
    [products]
  );

  // Top products by physical stock quantity
  const topStockedProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.currentStock - a.currentStock)
      .slice(0, 5);
  }, [products]);

  // Movement demand by product
  const productDemand = useMemo(() => {
    const map: Record<string, { name: string; code: string; group: string; exits: number; entries: number }> = {};
    movements.forEach((m) => {
      if (!map[m.productId]) {
        map[m.productId] = {
          name: m.productName,
          code: m.productCode,
          group: m.group,
          exits: 0,
          entries: 0,
        };
      }
      if (m.type === 'SAIDA') {
        map[m.productId].exits += m.quantity;
      } else {
        map[m.productId].entries += m.quantity;
      }
    });
    return Object.values(map).sort((a, b) => b.exits - a.exits);
  }, [movements]);

  // Group metrics by physical quantity
  const categorySummary = useMemo(() => {
    const stats: Record<string, { count: number; units: number }> = {};
    products.forEach((p) => {
      if (!stats[p.group]) {
        stats[p.group] = { count: 0, units: 0 };
      }
      stats[p.group].count += 1;
      stats[p.group].units += p.currentStock;
    });
    return stats;
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <BarChart3 className="w-5 h-5 text-red-500" />
            </span>
            Estatísticas & Análise de Giro por Quantidade
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Indicadores de volumes físicos, rotatividade de itens e demanda operacional de materiais da QHS Engenharia.
          </p>
        </div>
      </div>

      {/* SECTION 9: REMOVIDO "Fluxo de Movimentação". Mantidos os demais indicadores e comparações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Indicador 1: Total de Unidades em Depósito */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
            Total de Unidades em Estoque
          </span>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {totalInventoryUnits} un
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Soma de todas as peças e materiais físicos armazenados
          </span>
        </div>

        {/* Indicador 2: Item de Maior Volume Físico */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
            Item com Maior Quantidade
          </span>
          <div className="font-semibold text-base text-zinc-900 truncate">
            {topStockedProducts[0]?.name || 'N/A'}
          </div>
          <span className="text-[11px] text-red-600 font-mono font-semibold mt-1 block tabular-nums">
            {topStockedProducts[0]
              ? `${topStockedProducts[0].currentStock} un disponíveis (${topStockedProducts[0].group})`
              : '-'}
          </span>
        </div>
      </div>

      {/* Main Charts & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quantidades por Grupo */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div className="pb-3 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Volume de Estoque por Grupo
              </h2>
              <span className="text-xs text-zinc-500">
                Distribuição das quantidades físicas por categoria
              </span>
            </div>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>

          <div className="space-y-4">
            {Object.entries(categorySummary).map(([cat, info]) => {
              const percent = totalInventoryUnits > 0 ? (info.units / totalInventoryUnits) * 100 : 0;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800">{cat}</span>
                    <span className="font-mono font-bold text-zinc-900 tabular-nums">
                      {info.units} un
                    </span>
                  </div>

                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>{info.count} produtos cadastrados</span>
                    <span>{percent.toFixed(1)}% do estoque total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Produtos com Maior Quantidade Armazenada */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
          <div className="pb-3 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Top 5 Itens com Maior Estoque Físico
              </h2>
              <span className="text-xs text-zinc-500">
                Itens com maior quantidade disponível no almoxarifado
              </span>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="divide-y divide-zinc-100">
            {topStockedProducts.map((p, idx) => {
              return (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 font-mono text-zinc-400 font-bold">{idx + 1}.</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 truncate">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{p.code}</span>
                        <span>·</span>
                        <span>Grupo: {p.group}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-zinc-900 tabular-nums">
                      {p.currentStock} un
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Mínimo: {p.minStock} un
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Demanda & Giro de Materiais */}
      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
        <div className="pb-3 border-b border-zinc-100">
          <h2 className="text-sm font-bold text-zinc-900">
            Demanda Operacional & Giro de Materiais
          </h2>
          <span className="text-xs text-zinc-500">
            Frequência de baixas físicas para canteiros de obras vs recebimentos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 text-zinc-700 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Produto</th>
                <th className="py-2.5 px-3">Grupo</th>
                <th className="py-2.5 px-3 text-right">Total Requisitado (Saídas)</th>
                <th className="py-2.5 px-3 text-right">Total Recebido (Entradas)</th>
                <th className="py-2.5 px-3 text-center">Status de Giro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {productDemand.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-400">
                    Nenhuma movimentação registrada para cálculo de demanda.
                  </td>
                </tr>
              ) : (
                productDemand.map((item) => (
                  <tr key={item.code} className="hover:bg-zinc-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">{item.code}</td>
                    <td className="py-2.5 px-3 font-medium text-zinc-800">{item.name}</td>
                    <td className="py-2.5 px-3 text-zinc-600">{item.group}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 tabular-nums">
                      {item.exits} un
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      +{item.entries} un
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                        {item.exits > 5 ? 'Alta Rotatividade' : item.exits > 0 ? 'Rotatividade Média' : 'Baixa Movimentação'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
