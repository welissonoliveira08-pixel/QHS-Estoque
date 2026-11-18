import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Package,
  Layers,
  Calendar,
  Award,
  AlertTriangle,
  Boxes,
} from 'lucide-react';

type PeriodFilter = 'CURRENT_MONTH' | 'PREVIOUS_MONTH' | 'LAST_3_MONTHS' | 'ALL_TIME';
type ChartMetric = 'units' | 'salesCount';

const MONTH_NAMES_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const FULL_MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const extractYearMonth = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const isoMatch = dateStr.trim().match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }
  const brMatch = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}`;
  }
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
};

const getYearMonthKey = (year: number, monthZeroIndexed: number): string => {
  const d = new Date(year, monthZeroIndexed, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatYearMonthLabel = (ym: string, full = false): string => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  if (full) {
    return `${FULL_MONTH_NAMES_PT[m - 1]} de ${y}`;
  }
  return `${MONTH_NAMES_PT[m - 1]}/${String(y).slice(-2)}`;
};

export const StatisticsTab: React.FC = () => {
  const { products, movements } = useApp();

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('CURRENT_MONTH');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('units');
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);

  // All registered SAIDA movements represent sales/dispatches
  const salesMovements = useMemo(
    () => movements.filter((m) => m.type === 'SAIDA'),
    [movements]
  );

  // Current & previous month keys
  const { currentMonthKey, previousMonthKey, last3MonthKeys, last6MonthsMeta } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const curKey = getYearMonthKey(y, m);
    const prevKey = getYearMonthKey(y, m - 1);
    const l3 = new Set([
      getYearMonthKey(y, m),
      getYearMonthKey(y, m - 1),
      getYearMonthKey(y, m - 2),
    ]);

    const l6: { key: string; shortLabel: string; fullLabel: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const k = getYearMonthKey(y, m - i);
      l6.push({
        key: k,
        shortLabel: formatYearMonthLabel(k, false),
        fullLabel: formatYearMonthLabel(k, true),
      });
    }

    return {
      currentMonthKey: curKey,
      previousMonthKey: prevKey,
      last3MonthKeys: l3,
      last6MonthsMeta: l6,
    };
  }, []);

  // Aggregate real quantities by month (YYYY-MM)
  const monthlyAggregates = useMemo(() => {
    const map: Record<string, { salesCount: number; units: number }> = {};

    salesMovements.forEach((m) => {
      const ym = extractYearMonth(m.date);
      if (!ym) return;
      if (!map[ym]) {
        map[ym] = { salesCount: 0, units: 0 };
      }
      map[ym].salesCount += 1;
      map[ym].units += Number(m.quantity || 0);
    });

    return map;
  }, [salesMovements]);

  const currentMonthStats = monthlyAggregates[currentMonthKey] || {
    salesCount: 0,
    units: 0,
  };
  const previousMonthStats = monthlyAggregates[previousMonthKey] || {
    salesCount: 0,
    units: 0,
  };

  // Month-over-Month Comparisons (100% quantity & sales count only)
  const comparison = useMemo(() => {
    const unitsDiff = currentMonthStats.units - previousMonthStats.units;
    const salesDiff = currentMonthStats.salesCount - previousMonthStats.salesCount;

    let unitsGrowthPercent = 0;
    if (previousMonthStats.units > 0) {
      unitsGrowthPercent = Number(
        (((currentMonthStats.units - previousMonthStats.units) / previousMonthStats.units) * 100).toFixed(1)
      );
    } else if (currentMonthStats.units > 0) {
      unitsGrowthPercent = 100;
    }

    let salesGrowthPercent = 0;
    if (previousMonthStats.salesCount > 0) {
      salesGrowthPercent = Number(
        (
          ((currentMonthStats.salesCount - previousMonthStats.salesCount) /
            previousMonthStats.salesCount) *
          100
        ).toFixed(1)
      );
    } else if (currentMonthStats.salesCount > 0) {
      salesGrowthPercent = 100;
    }

    let status: 'UP' | 'DOWN' | 'EQUAL' | 'NO_DATA' = 'NO_DATA';
    if (currentMonthStats.salesCount === 0 && previousMonthStats.salesCount === 0) {
      status = 'NO_DATA';
    } else if (unitsDiff > 0 || (unitsDiff === 0 && salesDiff > 0)) {
      status = 'UP';
    } else if (unitsDiff < 0 || (unitsDiff === 0 && salesDiff < 0)) {
      status = 'DOWN';
    } else {
      status = 'EQUAL';
    }

    return {
      unitsDiff,
      salesDiff,
      unitsGrowthPercent,
      salesGrowthPercent,
      status,
    };
  }, [currentMonthStats, previousMonthStats]);

  // Period-filtered sales for "Produtos mais vendidos em quantidade"
  const periodSales = useMemo(() => {
    return salesMovements.filter((m) => {
      if (periodFilter === 'ALL_TIME') return true;
      const ym = extractYearMonth(m.date);
      if (!ym) return false;
      if (periodFilter === 'CURRENT_MONTH') return ym === currentMonthKey;
      if (periodFilter === 'PREVIOUS_MONTH') return ym === previousMonthKey;
      return last3MonthKeys.has(ym);
    });
  }, [salesMovements, periodFilter, currentMonthKey, previousMonthKey, last3MonthKeys]);

  const periodTotals = useMemo(() => {
    return periodSales.reduce(
      (acc, m) => {
        acc.salesCount += 1;
        acc.unitsSold += Number(m.quantity || 0);
        return acc;
      },
      { salesCount: 0, unitsSold: 0 }
    );
  }, [periodSales]);

  // Top-selling products by quantity in selected period
  const topSellingProducts = useMemo(() => {
    const map: Record<
      string,
      {
        productId: string;
        code: string;
        name: string;
        group: string;
        unitsSold: number;
        salesCount: number;
      }
    > = {};

    periodSales.forEach((m) => {
      if (!map[m.productId]) {
        map[m.productId] = {
          productId: m.productId,
          code: m.productCode,
          name: m.productName,
          group: m.group,
          unitsSold: 0,
          salesCount: 0,
        };
      }
      map[m.productId].unitsSold += Number(m.quantity || 0);
      map[m.productId].salesCount += 1;
    });

    return Object.values(map).sort((a, b) => {
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      return b.salesCount - a.salesCount;
    });
  }, [periodSales]);

  // Monthly series (last 6 months)
  const monthlySeries = useMemo(() => {
    return last6MonthsMeta.map((meta) => {
      const agg = monthlyAggregates[meta.key] || { salesCount: 0, units: 0 };
      return {
        ...meta,
        ...agg,
      };
    });
  }, [last6MonthsMeta, monthlyAggregates]);

  const maxChartValue = useMemo(() => {
    const vals = monthlySeries.map((d) => d[chartMetric]);
    return Math.max(...vals, 1);
  }, [monthlySeries, chartMetric]);

  // Inventory Snapshot (Quantities Only)
  const totalInventoryUnits = useMemo(
    () => products.reduce((acc, p) => acc + p.currentStock, 0),
    [products]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.currentStock <= p.minStock).length,
    [products]
  );

  const categorySummary = useMemo(() => {
    const stats: Record<string, { count: number; units: number }> = {};
    products.forEach((p) => {
      if (!stats[p.group]) stats[p.group] = { count: 0, units: 0 };
      stats[p.group].count += 1;
      stats[p.group].units += p.currentStock;
    });
    return stats;
  }, [products]);

  const periodLabel =
    periodFilter === 'CURRENT_MONTH'
      ? formatYearMonthLabel(currentMonthKey, true)
      : periodFilter === 'PREVIOUS_MONTH'
      ? formatYearMonthLabel(previousMonthKey, true)
      : periodFilter === 'LAST_3_MONTHS'
      ? 'Últimos 3 Meses'
      : 'Todo o Período';

  // Direct comparison bars (Mês Anterior vs Mês Atual)
  const compareMaxUnits = Math.max(currentMonthStats.units, previousMonthStats.units, 1);
  const compareMaxCount = Math.max(currentMonthStats.salesCount, previousMonthStats.salesCount, 1);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <BarChart3 className="w-5 h-5 text-red-500" />
            </span>
            Estatísticas de Estoque & Quantidade de Saídas
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Acompanhamento mensal de quantidades vendidas, volume de movimentações e saldo físico baseado nos registros reais do sistema.
          </p>
        </div>

        <div className="text-xs font-mono font-semibold text-zinc-700 bg-white border border-zinc-200 px-3 py-2 rounded-lg flex items-center gap-2 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-red-600" />
          <span>
            {formatYearMonthLabel(previousMonthKey, false)} vs{' '}
            <strong className="text-zinc-900">{formatYearMonthLabel(currentMonthKey, false)}</strong>
          </span>
        </div>
      </div>

      {/* Monthly Performance Comparison Banner (Quantity Only) */}
      <div
        className={`rounded-xl border p-5 sm:p-6 shadow-xs ${
          comparison.status === 'UP'
            ? 'bg-emerald-950 border-emerald-900 text-white'
            : comparison.status === 'DOWN'
            ? 'bg-red-950 border-red-900 text-white'
            : 'bg-zinc-900 border-zinc-800 text-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                comparison.status === 'UP'
                  ? 'bg-emerald-500 text-zinc-950'
                  : comparison.status === 'DOWN'
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-700 text-zinc-200'
              }`}
            >
              {comparison.status === 'UP' ? (
                <TrendingUp className="w-6 h-6" />
              ) : comparison.status === 'DOWN' ? (
                <TrendingDown className="w-6 h-6" />
              ) : (
                <Minus className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                Comparativo Mensal em Quantidade ({formatYearMonthLabel(currentMonthKey, true)} vs{' '}
                {formatYearMonthLabel(previousMonthKey, true)})
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                {comparison.status === 'UP'
                  ? 'Você movimentou mais unidades que no mês passado'
                  : comparison.status === 'DOWN'
                  ? 'Você movimentou menos unidades que no mês passado'
                  : comparison.status === 'EQUAL'
                  ? 'Quantidade igual à do mês passado'
                  : 'Ainda não há saídas registradas nos dois últimos meses'}
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                {comparison.status === 'NO_DATA'
                  ? 'Registre saídas na aba Saídas para acompanhar o comparativo automático de quantidades entre os meses.'
                  : `Diferença de ${comparison.unitsDiff >= 0 ? '+' : ''}${
                      comparison.unitsDiff
                    } unidade(s) e ${comparison.salesDiff >= 0 ? '+' : ''}${
                      comparison.salesDiff
                    } venda(s)/saída(s) em relação ao mês anterior.`}
              </p>
            </div>
          </div>

          {/* Quantity Growth / Drop Percentage Highlight */}
          <div className="flex items-center gap-6 lg:text-right border-t lg:border-t-0 border-white/10 pt-3 lg:pt-0 shrink-0">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-zinc-300 block font-semibold">
                Variação em Unidades
              </span>
              <span
                className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${
                  comparison.unitsGrowthPercent > 0
                    ? 'text-emerald-400'
                    : comparison.unitsGrowthPercent < 0
                    ? 'text-red-400'
                    : 'text-zinc-200'
                }`}
              >
                {comparison.unitsGrowthPercent > 0 ? '+' : ''}
                {comparison.unitsGrowthPercent.toFixed(1)}%
              </span>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-zinc-300 block font-semibold">
                Diferença (Qtd.)
              </span>
              <span className="font-mono text-lg sm:text-xl font-bold tabular-nums text-white">
                {comparison.unitsDiff > 0 ? '+' : ''}
                {comparison.unitsDiff} un
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Main Quantity-Only KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Unidades Vendidas no Mês Atual */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Quantidade de itens que saíram (Mês Atual)
            </span>
            <Package className="w-4 h-4 text-red-600" />
          </div>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {currentMonthStats.units} un
          </div>
          <p className="text-[11px] text-zinc-600 mt-1.5 font-medium">
            {formatYearMonthLabel(currentMonthKey, true)}
          </p>
        </div>

        {/* KPI 2: Unidades Vendidas no Mês Anterior + Diferença em unidades */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Quantidade de itens que saíram (Mês Anterior)
            </span>
            <Package className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
            {previousMonthStats.units} un
          </div>
          <p
            className={`text-[11px] mt-1.5 font-mono font-bold tabular-nums ${
              comparison.unitsDiff > 0
                ? 'text-emerald-700'
                : comparison.unitsDiff < 0
                ? 'text-red-700'
                : 'text-zinc-600'
            }`}
          >
            Dif.: {comparison.unitsDiff > 0 ? '+' : ''}
            {comparison.unitsDiff} un
          </p>
        </div>

        {/* KPI 3: Total de Vendas/Saídas (Mês Atual vs Mês Anterior) */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Nº de Vendas / Saídas (Mês)
            </span>
            <ShoppingBag className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
              {currentMonthStats.salesCount}
            </span>
            <span className="text-xs font-medium text-zinc-600">
              vs {previousMonthStats.salesCount} anterior
            </span>
          </div>
          <p
            className={`text-[11px] mt-1.5 font-mono font-bold tabular-nums ${
              comparison.salesGrowthPercent > 0
                ? 'text-emerald-700'
                : comparison.salesGrowthPercent < 0
                ? 'text-red-700'
                : 'text-zinc-600'
            }`}
          >
            {comparison.salesGrowthPercent > 0 ? '+' : ''}
            {comparison.salesGrowthPercent.toFixed(1)}% em nº de vendas
          </p>
        </div>

        {/* KPI 4: Resumo Físico de Estoque & Abaixo do Mínimo */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total em Estoque Físico
            </span>
            <Boxes className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-zinc-900 tabular-nums">
              {totalInventoryUnits} un
            </span>
            <span className="text-xs font-medium text-zinc-600">
              em {products.length} produto(s)
            </span>
          </div>
          <p
            className={`text-[11px] mt-1.5 font-mono font-bold tabular-nums inline-flex items-center gap-1 ${
              lowStockCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {lowStockCount > 0 && <AlertTriangle className="w-3 h-3" />}
            {lowStockCount > 0
              ? `${lowStockCount} item(ns) abaixo do estoque mínimo`
              : 'Todos os itens acima do mínimo'}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: 6-Month Sales Quantity Evolution Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Evolução das Quantidades nos Últimos 6 Meses
              </h2>
              <p className="text-xs text-zinc-600">
                Série mensal calculada automaticamente com base nas saídas registradas
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric('units')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  chartMetric === 'units'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-700 hover:text-zinc-900'
                }`}
              >
                Unidades Vendidas
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('salesCount')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  chartMetric === 'salesCount'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-700 hover:text-zinc-900'
                }`}
              >
                Nº de Vendas
              </button>
            </div>
          </div>

          {/* Interactive Column Chart */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[460px]">
              <div className="grid grid-cols-6 gap-3 items-end h-56 pt-8 pb-2 px-2 bg-zinc-50/70 rounded-xl border border-zinc-200/80 relative">
                {monthlySeries.map((item) => {
                  const val = item[chartMetric];
                  const pct = maxChartValue > 0 ? (val / maxChartValue) * 100 : 0;
                  const isCurrent = item.key === currentMonthKey;
                  const isHovered = hoveredMonthKey === item.key;

                  const displayVal =
                    chartMetric === 'salesCount' ? `${val} v.` : `${val} un`;

                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => setHoveredMonthKey(item.key)}
                      onMouseLeave={() => setHoveredMonthKey(null)}
                      onClick={() =>
                        setHoveredMonthKey((prev) => (prev === item.key ? null : item.key))
                      }
                      className="flex flex-col items-center justify-end h-full cursor-pointer group"
                    >
                      <div className="text-[10px] sm:text-[11px] font-mono font-bold tabular-nums text-zinc-800 mb-1.5 text-center truncate max-w-full px-1">
                        {val > 0 ? displayVal : '—'}
                      </div>
                      <div className="w-full max-w-[44px] h-36 bg-zinc-200/70 rounded-t-lg flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isCurrent
                              ? 'bg-red-600 group-hover:bg-red-700'
                              : isHovered
                              ? 'bg-zinc-900'
                              : 'bg-zinc-700 group-hover:bg-zinc-900'
                          }`}
                          style={{
                            height: `${val > 0 ? Math.max(8, pct) : 2}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div className="grid grid-cols-6 gap-3 mt-2 px-2">
                {monthlySeries.map((item) => {
                  const isCurrent = item.key === currentMonthKey;
                  return (
                    <div key={item.key} className="text-center">
                      <span
                        className={`text-[11px] font-mono uppercase ${
                          isCurrent ? 'font-black text-red-700' : 'font-semibold text-zinc-700'
                        }`}
                      >
                        {item.shortLabel}
                      </span>
                      {isCurrent && (
                        <span className="block text-[9px] font-bold text-red-600 uppercase">
                          Atual
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Detail Footer */}
          {(() => {
            const activeItem =
              monthlySeries.find((m) => m.key === hoveredMonthKey) ||
              monthlySeries[monthlySeries.length - 1];
            return (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-bold text-zinc-900">{activeItem.fullLabel}</span>
                <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-zinc-800">
                  <span>
                    Vendas / Saídas: <strong>{activeItem.salesCount}</strong>
                  </span>
                  <span>
                    Unidades Vendidas: <strong>{activeItem.units} un</strong>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right 1 col: Direct Month-over-Month Quantity Comparison */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-5">
          <div className="pb-3 border-b border-zinc-100">
            <h2 className="text-sm font-bold text-zinc-900">
              Mês Atual vs Mês Anterior
            </h2>
            <p className="text-xs text-zinc-600">
              Comparação direta de unidades vendidas e nº de saídas
            </p>
          </div>

          {/* Comparison Block 1: Units Sold */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Unidades Vendidas (un)
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-zinc-700">
                  Mês Anterior ({formatYearMonthLabel(previousMonthKey, false)})
                </span>
                <span className="font-mono font-bold text-zinc-800 tabular-nums">
                  {previousMonthStats.units} un
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-600 rounded-full transition-all"
                  style={{
                    width: `${
                      previousMonthStats.units > 0
                        ? Math.max(6, (previousMonthStats.units / compareMaxUnits) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-900">
                  Mês Atual ({formatYearMonthLabel(currentMonthKey, false)})
                </span>
                <span className="font-mono font-extrabold text-zinc-900 tabular-nums">
                  {currentMonthStats.units} un
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 rounded-full transition-all"
                  style={{
                    width: `${
                      currentMonthStats.units > 0
                        ? Math.max(6, (currentMonthStats.units / compareMaxUnits) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Comparison Block 2: Sales Count */}
          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Quantidade de Vendas / Saídas
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-zinc-700">
                  Mês Anterior ({formatYearMonthLabel(previousMonthKey, false)})
                </span>
                <span className="font-mono font-bold text-zinc-800 tabular-nums">
                  {previousMonthStats.salesCount} venda(s)
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-600 rounded-full transition-all"
                  style={{
                    width: `${
                      previousMonthStats.salesCount > 0
                        ? Math.max(6, (previousMonthStats.salesCount / compareMaxCount) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-zinc-900">
                  Mês Atual ({formatYearMonthLabel(currentMonthKey, false)})
                </span>
                <span className="font-mono font-extrabold text-zinc-900 tabular-nums">
                  {currentMonthStats.salesCount} venda(s)
                </span>
              </div>
              <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{
                    width: `${
                      currentMonthStats.salesCount > 0
                        ? Math.max(6, (currentMonthStats.salesCount / compareMaxCount) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products by Quantity in Period */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-red-600" />
              Produtos Mais Vendidos em Quantidade
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              Período selecionado: <strong className="text-zinc-900">{periodLabel}</strong> ·{' '}
              <strong className="font-mono tabular-nums text-zinc-900">
                {periodTotals.unitsSold} un
              </strong>{' '}
              vendida(s) em{' '}
              <strong className="font-mono tabular-nums text-zinc-900">
                {periodTotals.salesCount}
              </strong>{' '}
              saída(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-100 rounded-lg self-start md:self-auto">
            {(
              [
                { id: 'CURRENT_MONTH', label: 'Mês Atual' },
                { id: 'PREVIOUS_MONTH', label: 'Mês Anterior' },
                { id: 'LAST_3_MONTHS', label: 'Últimos 3 Meses' },
                { id: 'ALL_TIME', label: 'Todo Período' },
              ] as { id: PeriodFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodFilter(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  periodFilter === opt.id
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-700 hover:text-zinc-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-zinc-200 border border-zinc-300 rounded-xl overflow-hidden">
          {topSellingProducts.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-zinc-600">
              Nenhuma venda/saída registrada no período selecionado.
            </div>
          ) : (
            topSellingProducts.map((item, idx) => {
              const share =
                periodTotals.unitsSold > 0
                  ? (item.unitsSold / periodTotals.unitsSold) * 100
                  : 0;
              return (
                <div
                  key={item.productId}
                  className={`p-4 space-y-2 text-xs ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-red-700">#{idx + 1}</span>
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span className="text-[11px] font-medium text-zinc-700">
                          · {item.group}
                        </span>
                      </div>
                      <div className="font-bold text-zinc-900 mt-1">{item.name}</div>
                    </div>
                    <span className="font-mono font-extrabold text-zinc-900 tabular-nums shrink-0">
                      {item.unitsSold} un
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full"
                      style={{ width: `${Math.max(4, share)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-700 font-mono tabular-nums">
                    <span>{item.salesCount} venda(s)/saída(s)</span>
                    <strong>{share.toFixed(1)}% do volume</strong>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-300">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-900 text-white uppercase tracking-wider text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4 w-14 text-center">#</th>
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Produto</th>
                <th className="py-3.5 px-4">Grupo</th>
                <th className="py-3.5 px-4 text-right">Nº de Vendas</th>
                <th className="py-3.5 px-4 text-right">Quantidade de itens que saíram</th>
                <th className="py-3.5 px-4 w-44">Participação (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {topSellingProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-600 font-medium">
                    Nenhuma venda/saída registrada no período selecionado.
                  </td>
                </tr>
              ) : (
                topSellingProducts.map((item, idx) => {
                  const share =
                    periodTotals.unitsSold > 0
                      ? (item.unitsSold / periodTotals.unitsSold) * 100
                      : 0;
                  return (
                    <tr
                      key={item.productId}
                      className="odd:bg-white even:bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
                    >
                      <td className="py-3 px-4 text-center font-mono font-black text-red-700 tabular-nums">
                        {idx + 1}º
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        <span className="bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-zinc-900">{item.name}</td>
                      <td className="py-3 px-4 font-medium text-zinc-700 whitespace-nowrap">
                        {item.group}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800 tabular-nums">
                        {item.salesCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-zinc-900 tabular-nums">
                        {item.unitsSold} un
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-600 rounded-full"
                              style={{ width: `${Math.max(4, share)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-zinc-800 tabular-nums w-11 text-right">
                            {share.toFixed(0)}%
                          </span>
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

      {/* Inventory Distribution by Group (Compact Warehouse Context) */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-xs space-y-4">
        <div className="pb-3 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">
              Volume de Estoque Atual por Grupo
            </h2>
            <span className="text-xs text-zinc-600">
              Total físico armazenado: <strong className="font-mono text-zinc-900">{totalInventoryUnits} un</strong>
            </span>
          </div>
          <Layers className="w-4 h-4 text-zinc-500" />
        </div>

        {Object.entries(categorySummary).length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">
            Nenhum produto cadastrado até o momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categorySummary).map(([cat, info]) => {
              const percent = totalInventoryUnits > 0 ? (info.units / totalInventoryUnits) * 100 : 0;
              return (
                <div
                  key={cat}
                  className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50/70 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-900">{cat}</span>
                    <span className="font-mono font-extrabold text-zinc-900 tabular-nums">
                      {info.units} un
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-600 font-mono">
                    <span>{info.count} produto(s)</span>
                    <span>{percent.toFixed(1)}% do estoque</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
