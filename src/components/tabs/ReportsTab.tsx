import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Download,
  Printer,
  Search,
  Calendar,
  Filter,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  X,
  Layers,
  User,
} from 'lucide-react';

export const ReportsTab: React.FC = () => {
  const { products, movements, settings, managedLists } = useApp();

  const [reportType, setReportType] = useState<'ENTRADAS' | 'SAIDAS' | 'CRITICOS'>('ENTRADAS');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 1. Filtered Entradas
  const filteredEntries = useMemo(() => {
    return movements
      .filter((m) => m.type === 'ENTRADA')
      .filter((m) => {
        // Search by product name or code
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q);

        // Filter by group
        const matchesGroup =
          selectedGroup === 'TODOS' || m.group === selectedGroup;

        // Filter by date range (m.date format: 'YYYY-MM-DD HH:mm' or 'YYYY-MM-DD')
        const moveDate = m.date.slice(0, 10);
        const matchesStart = !startDate || moveDate >= startDate;
        const matchesEnd = !endDate || moveDate <= endDate;

        return matchesQuery && matchesGroup && matchesStart && matchesEnd;
      });
  }, [movements, searchQuery, selectedGroup, startDate, endDate]);

  // 2. Filtered Saídas
  const filteredExits = useMemo(() => {
    return movements
      .filter((m) => m.type === 'SAIDA')
      .filter((m) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q) ||
          (m.withdrawnBy && m.withdrawnBy.toLowerCase().includes(q)) ||
          (m.destination && m.destination.toLowerCase().includes(q));

        const matchesGroup =
          selectedGroup === 'TODOS' || m.group === selectedGroup;

        const moveDate = m.date.slice(0, 10);
        const matchesStart = !startDate || moveDate >= startDate;
        const matchesEnd = !endDate || moveDate <= endDate;

        return matchesQuery && matchesGroup && matchesStart && matchesEnd;
      });
  }, [movements, searchQuery, selectedGroup, startDate, endDate]);

  // 3. Filtered Produtos Críticos (Abaixo do mínimo ou zerados)
  const filteredCriticalProducts = useMemo(() => {
    return products
      .filter((p) => p.currentStock <= p.minStock)
      .filter((p) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q);

        const matchesGroup =
          selectedGroup === 'TODOS' || p.group === selectedGroup;

        return matchesQuery && matchesGroup;
      })
      .sort((a, b) => {
        const deficitA = a.minStock - a.currentStock;
        const deficitB = b.minStock - b.currentStock;
        return deficitB - deficitA;
      });
  }, [products, searchQuery, selectedGroup]);

  // CSV Exporter for each report type
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'ENTRADAS') {
      csvContent += 'Data;Codigo;Nome do Produto;Grupo;Quantidade Recebida;Estoque Apos a Entrada;Responsavel;Observacoes\n';
      filteredEntries.forEach((e) => {
        csvContent += `"${e.date}";"${e.productCode}";"${e.productName}";"${e.group}";${e.quantity};${e.stockAfterMovement};"${e.responsibleUser}";"${e.notes || ''}"\n`;
      });
    } else if (reportType === 'SAIDAS') {
      csvContent += 'Data;Codigo;Nome do Produto;Grupo;Quantidade Retirada;Saldo Restante;Funcionario que Retirou;Destino ou Obra;Responsavel Registro;Observacoes\n';
      filteredExits.forEach((s) => {
        csvContent += `"${s.date}";"${s.productCode}";"${s.productName}";"${s.group}";${s.quantity};${s.stockAfterMovement};"${s.withdrawnBy || ''}";"${s.destination || ''}";"${s.responsibleUser}";"${s.notes || ''}"\n`;
      });
    } else {
      csvContent += 'Codigo;Nome do Produto;Grupo;Estoque Atual;Estoque Minimo;Deficit a Repor;Situacao\n';
      filteredCriticalProducts.forEach((p) => {
        const deficit = Math.max(0, p.minStock * 2 - p.currentStock);
        const situacao = p.currentStock <= 0 ? 'Zerado / Negativo' : 'Abaixo do Mínimo';
        csvContent += `"${p.code}";"${p.name}";"${p.group}";${p.currentStock};${p.minStock};${deficit};"${situacao}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `qhs_engenharia_relatorio_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGroup('TODOS');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <FileText className="w-5 h-5 text-red-500" />
            </span>
            Relatórios Operacionais
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Geração de relatórios analíticos de entradas, saídas e reposição crítica com filtros combinados de período e grupo.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-zinc-500" />
            Imprimir / Salvar PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar para Excel / CSV
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-100 rounded-xl max-w-xl">
        <button
          onClick={() => setReportType('ENTRADAS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'ENTRADAS'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
          <span>1. Relatório de Entradas</span>
        </button>

        <button
          onClick={() => setReportType('SAIDAS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'SAIDAS'
              ? 'bg-white text-red-800 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
          <span>2. Relatório de Saídas</span>
        </button>

        <button
          onClick={() => setReportType('CRITICOS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'CRITICOS'
              ? 'bg-white text-amber-900 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>3. Produtos Críticos</span>
          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono text-[10px]">
            {filteredCriticalProducts.length}
          </span>
        </button>
      </div>

      {/* SECTION 8: FILTROS COMBINADOS (PESQUISA, GRUPO E PERÍODO DE DATAS) */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 text-xs font-bold text-zinc-800">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-red-600" />
            <span>Filtros do Relatório</span>
          </div>
          {(searchQuery || selectedGroup !== 'TODOS' || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Pesquisa por Nome ou Código */}
          <div>
            <label className="block text-zinc-600 font-semibold mb-1">
              Pesquisar Produto (Nome/Código)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: Extintor, QHS-EXT, Placa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
              />
            </div>
          </div>

          {/* 2. Filtro de Grupo (Carregado dinamicamente de managedLists) */}
          <div>
            <label className="block text-zinc-600 font-semibold mb-1">
              Grupo / Categoria
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
            >
              <option value="TODOS">Todos os Grupos</option>
              {managedLists.groups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Data Inicial */}
          {reportType !== 'CRITICOS' && (
            <div>
              <label className="block text-zinc-600 font-semibold mb-1">
                Data Inicial (De)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-mono"
              />
            </div>
          )}

          {/* 4. Data Final */}
          {reportType !== 'CRITICOS' && (
            <div>
              <label className="block text-zinc-600 font-semibold mb-1">
                Data Final (Até)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Relatório Sheet (Pronto para Visualização e Impressão) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Cabeçalho Oficial QHS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-base shadow-sm">
              QHS
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 tracking-tight">
                QHS ENGENHARIA LTDA
              </h2>
              <p className="text-xs text-zinc-500">
                CNPJ: {settings.cnpj} · Departamento de Almoxarifado & Estoque
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-zinc-500 font-mono">
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-zinc-900 font-semibold mt-0.5">
              Tipo: {reportType === 'ENTRADAS' ? 'Entradas de Materiais' : reportType === 'SAIDAS' ? 'Saídas & Requisições de Obras' : 'Reposição Crítica'}
            </div>
          </div>
        </div>

        {/* 1. RELATÓRIO DE ENTRADAS */}
        {reportType === 'ENTRADAS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Relatório de Entradas de Materiais
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredEntries.length} registro(s) encontrado(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Produto Recebido</th>
                    <th className="py-2.5 px-3">Grupo</th>
                    <th className="py-2.5 px-3 text-right">Qtd. Recebida</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Estoque Após a Entrada</th>
                    <th className="py-2.5 px-3">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        Nenhum registro de entrada corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-3 font-mono text-zinc-600 whitespace-nowrap">{e.date}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">{e.productCode}</td>
                        <td className="py-2.5 px-3 font-medium text-zinc-900">{e.productName}</td>
                        <td className="py-2.5 px-3 text-zinc-600">{e.group}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 tabular-nums">
                          +{e.quantity} un
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 tabular-nums">
                          {e.stockAfterMovement} un
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">{e.responsibleUser}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. RELATÓRIO DE SAÍDAS */}
        {reportType === 'SAIDAS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Relatório de Saídas & Requisições de Obras
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredExits.length} registro(s) encontrado(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Produto Retirado</th>
                    <th className="py-2.5 px-3">Grupo</th>
                    <th className="py-2.5 px-3 text-right">Qtd. Retirada</th>
                    <th className="py-2.5 px-3 text-right">Saldo Restante</th>
                    <th className="py-2.5 px-3 font-bold text-red-600">Funcionário que Retirou</th>
                    <th className="py-2.5 px-3">Obra / Destino</th>
                    <th className="py-2.5 px-3">Responsável Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredExits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400">
                        Nenhum registro de saída corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredExits.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-3 font-mono text-zinc-600 whitespace-nowrap">{s.date}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900">{s.productCode}</td>
                        <td className="py-2.5 px-3 font-medium text-zinc-900">
                          {s.productName}
                          {s.isNegativeStockAuthorized && (
                            <span className="block text-[10px] text-red-600">
                              (Autorizado Excepcional: {s.authorizedBy})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600">{s.group}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 tabular-nums">
                          -{s.quantity} un
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900 tabular-nums">
                          {s.stockAfterMovement} un
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                          {s.withdrawnBy || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700 whitespace-nowrap">{s.destination || '-'}</td>
                        <td className="py-2.5 px-3 text-zinc-600 whitespace-nowrap">{s.responsibleUser}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. RELATÓRIO DE PRODUTOS CRÍTICOS */}
        {reportType === 'CRITICOS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Relatório de Produtos Críticos (Abaixo do Mínimo ou Zerados)
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredCriticalProducts.length} item(ns) requer reposição
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-50 text-amber-900 font-semibold border-b border-amber-200">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Produto</th>
                    <th className="py-2.5 px-3">Grupo</th>
                    <th className="py-2.5 px-3 text-right">Estoque Atual</th>
                    <th className="py-2.5 px-3 text-right">Estoque Mínimo</th>
                    <th className="py-2.5 px-3 text-right">Déficit / Qtd a Repor</th>
                    <th className="py-2.5 px-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredCriticalProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-700">
                        Todos os produtos estão com níveis de estoque operacional adequados!
                      </td>
                    </tr>
                  ) : (
                    filteredCriticalProducts.map((p) => {
                      const suggestBuy = Math.max(1, p.minStock * 2 - p.currentStock);
                      const isZeroOrNeg = p.currentStock <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-amber-50/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-red-600">{p.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-900">{p.name}</td>
                          <td className="py-2.5 px-3 text-zinc-600">{p.group}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 tabular-nums">
                            {p.currentStock} un
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-600">
                            {p.minStock} un
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 tabular-nums">
                            +{suggestBuy} un
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isZeroOrNeg
                                  ? 'bg-red-100 text-red-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {isZeroOrNeg ? 'Estoque Zerado / Negativo' : 'Abaixo do Mínimo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
