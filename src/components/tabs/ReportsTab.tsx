import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StockMovement } from '../../types';
import { generateReportPdf, ExportReportPdfResult } from '../../utils/pdfExport';
import { DeletionActionModal, DeletionTarget } from '../DeletionActionModal';
import {
  FileText,
  Download,
  Printer,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ArrowRight,
  FileDown,
  Mail,
  X,
  Share2,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export const ReportsTab: React.FC = () => {
  const {
    products,
    movements,
    collaborators,
    settings,
    managedLists,
    deleteMovement,
    canDeleteDirectly,
    deletionRequests,
    createDeletionRequest,
  } = useApp();

  const [reportType, setReportType] = useState<'ENTRADAS' | 'SAIDAS' | 'CRITICOS'>('ENTRADAS');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('TODOS');
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('TODOS');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // PDF & Email State
  const [pdfFeedback, setPdfFeedback] = useState<ExportReportPdfResult | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [lastPdfResult, setLastPdfResult] = useState<ExportReportPdfResult | null>(null);

  // Movement Deletion State
  const [movementToDelete, setMovementToDelete] = useState<StockMovement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const pendingDeletionIds = useMemo(
    () => new Set(deletionRequests.filter((r) => r.status === 'PENDENTE').map((r) => r.targetId)),
    [deletionRequests]
  );

  // Global count of products below or at minimum stock (live auto-updating KPI)
  const allBelowMinProducts = useMemo(
    () => products.filter((p) => p.currentStock <= p.minStock),
    [products]
  );

  const zeroOrNegativeCount = useMemo(
    () => allBelowMinProducts.filter((p) => p.currentStock <= 0).length,
    [allBelowMinProducts]
  );

  // 1. Filtered Entradas
  const filteredEntries = useMemo(() => {
    return movements
      .filter((m) => m.type === 'ENTRADA')
      .filter((m) => {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          m.productName.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q);

        const matchesGroup =
          selectedGroup === 'TODOS' || m.group === selectedGroup;

        const moveDate = m.date.slice(0, 10);
        const matchesStart = !startDate || moveDate >= startDate;
        const matchesEnd = !endDate || moveDate <= endDate;

        return matchesQuery && matchesGroup && matchesStart && matchesEnd;
      });
  }, [movements, searchQuery, selectedGroup, startDate, endDate]);

  // Collaborator filter options (all registered collaborators + any legacy/deleted exit names)
  const collaboratorFilterOptions = useMemo(() => {
    const sorted = [...collaborators].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'pt-BR')
    );
    const registeredIds = new Set(sorted.map((c) => c.id));
    const registeredNames = new Set(sorted.map((c) => c.fullName.trim().toLowerCase()));
    const legacyNames = new Set<string>();
    for (const m of movements) {
      if (m.type === 'SAIDA' && m.withdrawnBy) {
        const isRegistered =
          (m.collaboratorId && registeredIds.has(m.collaboratorId)) ||
          (!m.collaboratorId && registeredNames.has(m.withdrawnBy.trim().toLowerCase()));
        const clean = m.withdrawnBy.trim();
        if (!isRegistered && clean && !registeredNames.has(clean.toLowerCase())) {
          legacyNames.add(clean);
        }
      }
    }
    return {
      registered: sorted,
      legacy: Array.from(legacyNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    };
  }, [collaborators, movements]);

  const selectedCollaboratorLabel = useMemo(() => {
    if (selectedCollaborator === 'TODOS') return 'TODOS';
    if (selectedCollaborator.startsWith('legacy:')) {
      return selectedCollaborator.slice('legacy:'.length);
    }
    const found = collaborators.find((c) => c.id === selectedCollaborator);
    return found ? found.fullName : 'TODOS';
  }, [selectedCollaborator, collaborators]);

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

        let matchesCollaborator = true;
        if (selectedCollaborator !== 'TODOS') {
          if (selectedCollaborator.startsWith('legacy:')) {
            const legacyName = selectedCollaborator.slice('legacy:'.length).trim().toLowerCase();
            const isRegisteredId =
              m.collaboratorId && collaborators.some((c) => c.id === m.collaboratorId);
            matchesCollaborator =
              !isRegisteredId && (m.withdrawnBy || '').trim().toLowerCase() === legacyName;
          } else {
            const colab = collaborators.find((c) => c.id === selectedCollaborator);
            if (colab) {
              matchesCollaborator = m.collaboratorId
                ? m.collaboratorId === colab.id
                : (m.withdrawnBy || '').trim().toLowerCase() ===
                  colab.fullName.trim().toLowerCase();
            }
          }
        }

        const moveDate = m.date.slice(0, 10);
        const matchesStart = !startDate || moveDate >= startDate;
        const matchesEnd = !endDate || moveDate <= endDate;

        return (
          matchesQuery &&
          matchesGroup &&
          matchesCollaborator &&
          matchesStart &&
          matchesEnd
        );
      });
  }, [
    movements,
    searchQuery,
    selectedGroup,
    selectedCollaborator,
    collaborators,
    startDate,
    endDate,
  ]);

  // 3. Filtered Produtos Críticos (Abaixo ou igual ao mínimo)
  const filteredCriticalProducts = useMemo(() => {
    return allBelowMinProducts
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
  }, [allBelowMinProducts, searchQuery, selectedGroup]);

  // CSV Exporter
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'ENTRADAS') {
      csvContent += 'Data;Codigo;Nome do Produto;Grupo;Quantidade Recebida;Estoque Apos a Entrada;Responsavel;Observacoes\n';
      filteredEntries.forEach((e) => {
        csvContent += `"${e.date}";"${e.productCode}";"${e.productName}";"${e.group}";${e.quantity};${e.stockAfterMovement};"${e.responsibleUser}";"${e.notes || ''}"\n`;
      });
    } else if (reportType === 'SAIDAS') {
      csvContent += 'Data;Codigo;Nome do Produto;Grupo;Quantidade Retirada;Saldo Restante;Colaborador que Retirou;Destino ou Obra;Responsavel Registro;Observacoes\n';
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

  const buildPdfExport = (): ExportReportPdfResult => {
    const result = generateReportPdf({
      reportType,
      entries: filteredEntries,
      exits: filteredExits,
      criticalProducts: filteredCriticalProducts,
      settings,
      filters: {
        searchQuery,
        selectedGroup,
        selectedCollaborator: selectedCollaboratorLabel,
        startDate,
        endDate,
      },
    });
    setLastPdfResult(result);
    return result;
  };

  const handleExportPDF = () => {
    const result = buildPdfExport();
    setPdfFeedback(result);
    setTimeout(() => setPdfFeedback(null), 8000);
  };

  const openEmailModalWithPdf = (existingResult?: ExportReportPdfResult) => {
    const result = existingResult || buildPdfExport();
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const company = settings.companyName || 'QHS Engenharia';

    setEmailTo(settings.contactEmail || '');
    setEmailSubject(`${company} - ${result.reportTitle} (${todayStr})`);
    setEmailBody(
      `Olá,\n\nSegue o relatório gerado pelo sistema de Almoxarifado da ${company}:\n` +
        `• Documento: ${result.reportTitle}\n` +
        `• Resumo: ${result.summaryLine}\n` +
        `• Arquivo PDF gerado: ${result.filename}\n\n` +
        `Obs.: Anexe o arquivo PDF baixado (${result.filename}) a este e-mail antes de enviar.\n\nAtenciosamente,\n${company}`
    );
    setIsEmailModalOpen(true);
  };

  const handleNativeSharePdf = async () => {
    if (!lastPdfResult || typeof navigator === 'undefined' || !navigator.share) return;
    try {
      const pdfFile = new File([lastPdfResult.blob], lastPdfResult.filename, {
        type: 'application/pdf',
      });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: emailSubject || lastPdfResult.reportTitle,
          text: emailBody,
          files: [pdfFile],
        });
      }
    } catch {
      // User cancelled share dialog
    }
  };

  const canSharePdfFile = useMemo(() => {
    if (!lastPdfResult || typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
      return false;
    }
    try {
      const testFile = new File([lastPdfResult.blob], lastPdfResult.filename, {
        type: 'application/pdf',
      });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }, [lastPdfResult]);

  const mailtoHref = useMemo(() => {
    const to = encodeURIComponent(emailTo.trim());
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [emailTo, emailSubject, emailBody]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGroup('TODOS');
    setSelectedCollaborator('TODOS');
    setStartDate('');
    setEndDate('');
  };

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
      setDeleteFeedback({
        type: 'success',
        message: `${label} de ${target.quantity} un de "${target.productName}" excluída com sucesso.${stockInfo}`,
      });
      setTimeout(() => setDeleteFeedback(null), 6000);
    } else {
      setDeleteFeedback({
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

    setDeleteFeedback({
      type: res.success ? 'success' : 'error',
      message:
        res.message ||
        (res.success
          ? 'Solicitação de exclusão enviada ao Administrador.'
          : 'Erro ao solicitar exclusão.'),
    });
    setTimeout(() => setDeleteFeedback(null), 6000);
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
            {canDeleteDirectly ? 'Tem certeza que deseja excluir o registro de ' : 'Solicitar exclusão do registro de '}
            <strong>{movementToDelete.type === 'ENTRADA' ? 'entrada' : 'saída'}</strong> de{' '}
            <strong className={movementToDelete.type === 'ENTRADA' ? 'text-emerald-700' : 'text-red-700'}>
              {movementToDelete.type === 'ENTRADA' ? '+' : '-'}{movementToDelete.quantity} un
            </strong>{' '}
            do produto <strong className="text-zinc-900">"{movementToDelete.productName}"</strong>{' '}
            (<span className="font-mono font-semibold">{movementToDelete.productCode}</span>) em{' '}
            <span className="font-mono">{movementToDelete.date}</span>?
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
            , atualizando relatórios e estatísticas automaticamente.
          </span>
        ),
      }
    : null;

  const belowMinCount = allBelowMinProducts.length;
  const hasCritical = belowMinCount > 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <FileText className="w-5 h-5 text-red-500" />
            </span>
            Relatórios Operacionais
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Geração de relatórios analíticos de entradas, saídas e reposição crítica com exportação direta em PDF, CSV, impressão e e-mail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Imprimir visualização atual"
          >
            <Printer className="w-4 h-4 text-zinc-600 shrink-0" />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Exportar planilha CSV"
          >
            <Download className="w-4 h-4 text-zinc-600 shrink-0" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => openEmailModalWithPdf()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Gerar PDF e preparar envio por e-mail"
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Enviar por E-mail</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            title="Baixar arquivo PDF para impressão ou envio"
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* PDF Export Confirmation Bar */}
      {pdfFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 print:hidden">
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold block">
                PDF gerado com sucesso: <span className="font-mono">{pdfFeedback.filename}</span>
              </span>
              <span className="text-emerald-800">
                Arquivo salvo no dispositivo e pronto para impressão ou anexo por e-mail.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openEmailModalWithPdf(pdfFeedback)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Enviar por E-mail</span>
            </button>
            <button
              type="button"
              onClick={() => setPdfFeedback(null)}
              className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Movement Deletion Feedback */}
      {deleteFeedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-2 text-xs font-medium border print:hidden ${
            deleteFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{deleteFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteFeedback(null)}
            className="text-zinc-500 hover:text-zinc-800 p-0.5 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Requirement 5: Prominent Indicator Card for Products Below Minimum Stock */}
      <div
        className={`rounded-xl border p-5 sm:p-6 shadow-xs transition-colors ${
          hasCritical
            ? 'bg-zinc-950 border-zinc-800 text-white'
            : 'bg-emerald-50/70 border-emerald-200 text-zinc-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                hasCritical
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {hasCritical ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div>
              <div
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  hasCritical ? 'text-amber-400' : 'text-emerald-800'
                }`}
              >
                Indicador de Reposição · Estoque Mínimo
              </div>
              <div className="flex flex-wrap items-baseline gap-3 mt-1">
                <span
                  className={`font-mono text-3xl sm:text-4xl font-black tabular-nums leading-none ${
                    hasCritical ? 'text-white' : 'text-emerald-900'
                  }`}
                >
                  {belowMinCount}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    hasCritical ? 'text-zinc-200' : 'text-emerald-900'
                  }`}
                >
                  {belowMinCount === 0
                    ? 'Nenhum produto precisa de reposição no momento'
                    : belowMinCount === 1
                    ? 'produto abaixo ou no limite mínimo de estoque'
                    : 'produtos abaixo ou no limite mínimo de estoque'}
                </span>
              </div>
              <p
                className={`text-xs mt-1.5 ${
                  hasCritical ? 'text-zinc-400' : 'text-emerald-800/80'
                }`}
              >
                {products.length === 0
                  ? 'Nenhum produto cadastrado no catálogo até o momento.'
                  : hasCritical
                  ? `${zeroOrNegativeCount > 0 ? `${zeroOrNegativeCount} com estoque zerado ou negativo · ` : ''}Total monitorado: ${products.length} produto(s) · Atualizado automaticamente.`
                  : `Todos os ${products.length} produto(s) cadastrados estão acima do estoque mínimo de segurança.`}
              </p>
            </div>
          </div>

          {hasCritical && reportType !== 'CRITICOS' && (
            <button
              type="button"
              onClick={() => setReportType('CRITICOS')}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-xs print:hidden"
            >
              <span>Ver Produtos para Reposição</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-200/70 rounded-xl w-full max-w-2xl print:hidden">
        <button
          onClick={() => setReportType('ENTRADAS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'ENTRADAS'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/60'
          }`}
        >
          <ArrowDownRight
            className={`w-3.5 h-3.5 ${
              reportType === 'ENTRADAS' ? 'text-emerald-400' : 'text-emerald-600'
            }`}
          />
          <span>1. Relatório de Entradas</span>
        </button>

        <button
          onClick={() => setReportType('SAIDAS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'SAIDAS'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/60'
          }`}
        >
          <ArrowUpRight
            className={`w-3.5 h-3.5 ${
              reportType === 'SAIDAS' ? 'text-red-400' : 'text-red-600'
            }`}
          />
          <span>2. Relatório de Saídas</span>
        </button>

        <button
          onClick={() => setReportType('CRITICOS')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
            reportType === 'CRITICOS'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-900 hover:bg-white/60'
          }`}
        >
          <AlertTriangle
            className={`w-3.5 h-3.5 ${
              reportType === 'CRITICOS' ? 'text-amber-400' : 'text-amber-600'
            }`}
          />
          <span>3. Produtos Críticos</span>
          <span
            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tabular-nums ${
              reportType === 'CRITICOS'
                ? 'bg-red-600 text-white'
                : 'bg-amber-200 text-amber-950'
            }`}
          >
            {filteredCriticalProducts.length}
          </span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3 print:hidden">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 text-xs font-bold text-zinc-800">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-red-600" />
            <span>Filtros do Relatório</span>
          </div>
          {(searchQuery ||
            selectedGroup !== 'TODOS' ||
            selectedCollaborator !== 'TODOS' ||
            startDate ||
            endDate) && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            reportType === 'SAIDAS' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          } gap-3 text-xs`}
        >
          <div>
            <label className="block text-zinc-700 font-semibold mb-1">
              Pesquisar Produto (Nome/Código)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: Extintor, COD-001, Placa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white text-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-700 font-semibold mb-1">
              Grupo / Categoria
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full px-2.5 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white text-zinc-900 font-medium"
            >
              <option value="TODOS">Todos os Grupos</option>
              {managedLists.groups.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {reportType === 'SAIDAS' && (
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Colaborador que retirou
              </label>
              <select
                value={selectedCollaborator}
                onChange={(e) => setSelectedCollaborator(e.target.value)}
                className="w-full px-2.5 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white text-zinc-900 font-medium"
              >
                <option value="TODOS">Todos os Colaboradores</option>
                {collaboratorFilterOptions.registered.map((colab) => (
                  <option key={colab.id} value={colab.id}>
                    {colab.fullName}
                    {!colab.active ? ' (Inativo)' : ''}
                  </option>
                ))}
                {collaboratorFilterOptions.legacy.map((legacyName) => (
                  <option key={`legacy:${legacyName}`} value={`legacy:${legacyName}`}>
                    {legacyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType !== 'CRITICOS' && (
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Data Inicial (De)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-mono text-zinc-900"
              />
            </div>
          )}

          {reportType !== 'CRITICOS' && (
            <div>
              <label className="block text-zinc-700 font-semibold mb-1">
                Data Final (Até)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-mono text-zinc-900"
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Document Sheet */}
      <div className="bg-white border border-zinc-300 rounded-xl p-4 sm:p-6 lg:p-8 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Official Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-zinc-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-base shadow-xs shrink-0">
              QHS
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-zinc-900 tracking-tight truncate">
                {settings.companyName || 'QHS ENGENHARIA LTDA'}
              </h2>
              <p className="text-xs text-zinc-700 font-medium">
                CNPJ: {settings.cnpj} · Departamento de Almoxarifado & Estoque
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-zinc-700 font-mono shrink-0">
            <div>
              Emissão: {new Date().toLocaleDateString('pt-BR')}{' '}
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-zinc-900 font-bold mt-0.5">
              Tipo:{' '}
              {reportType === 'ENTRADAS'
                ? 'Entradas de Materiais'
                : reportType === 'SAIDAS'
                ? 'Saídas & Requisições de Obras'
                : 'Reposição Crítica'}
            </div>
          </div>
        </div>

        {/* 1. RELATÓRIO DE ENTRADAS */}
        {reportType === 'ENTRADAS' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Relatório de Entradas de Materiais
              </h3>
              <span className="text-xs text-zinc-700 font-mono font-semibold bg-zinc-100 border border-zinc-300 px-2.5 py-1 rounded-md tabular-nums">
                {filteredEntries.length} registro(s) encontrado(s)
              </span>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden print:hidden divide-y divide-zinc-200 border border-zinc-300 rounded-xl overflow-hidden">
              {filteredEntries.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-zinc-600 font-medium bg-zinc-50">
                  Nenhum registro de entrada corresponde aos filtros selecionados.
                </div>
              ) : (
                filteredEntries.map((e, idx) => (
                  <div
                    key={e.id}
                    className={`p-4 space-y-2.5 text-xs ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 rounded">
                            {e.productCode}
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-700">
                            · {e.group}
                          </span>
                        </div>
                        <div className="font-bold text-zinc-900 mt-1.5 text-sm leading-snug">
                          {e.productName}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-zinc-700 shrink-0">
                        {e.date}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200">
                      <span className="text-zinc-700 font-medium truncate">
                        Resp.: <strong className="text-zinc-900">{e.responsibleUser}</strong>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 font-mono font-bold tabular-nums">
                        <span className="text-emerald-700">+{e.quantity} un</span>
                        <span className="text-zinc-400">→</span>
                        <span className="text-zinc-900 bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 rounded">
                          {e.stockAfterMovement} un
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setMovementToDelete(e)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-colors ${
                          pendingDeletionIds.has(e.id)
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-red-600 hover:bg-red-50 border-red-200'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {pendingDeletionIds.has(e.id)
                          ? 'Exclusão solicitada'
                          : canDeleteDirectly
                          ? 'Excluir'
                          : 'Solicitar exclusão'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop & Print Table (High Contrast) */}
            <div className="hidden md:block print:block overflow-x-auto rounded-xl border border-zinc-300 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Data</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Código</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Produto Recebido</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Grupo</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-right">Qtd. Recebida</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-right text-emerald-300">
                      Estoque Após Entrada
                    </th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Responsável</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-center print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-zinc-600 font-medium">
                        Nenhum registro de entrada corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e) => (
                      <tr
                        key={e.id}
                        className="odd:bg-white even:bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-zinc-800 whitespace-nowrap tabular-nums">
                          {e.date}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                          <span className="bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded">
                            {e.productCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-zinc-900">{e.productName}</td>
                        <td className="py-3 px-4 font-medium text-zinc-700 whitespace-nowrap">
                          {e.group}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                          +{e.quantity} un
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-zinc-900 tabular-nums whitespace-nowrap">
                          {e.stockAfterMovement} un
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-800 whitespace-nowrap">
                          {e.responsibleUser}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap print:hidden">
                          <button
                            type="button"
                            onClick={() => setMovementToDelete(e)}
                            title={
                              pendingDeletionIds.has(e.id)
                                ? 'Solicitação de exclusão pendente'
                                : canDeleteDirectly
                                ? 'Excluir registro de entrada'
                                : 'Solicitar exclusão'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              pendingDeletionIds.has(e.id)
                                ? 'text-amber-600 bg-amber-50'
                                : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                Relatório de Saídas & Requisições de Obras
              </h3>
              <span className="text-xs text-zinc-700 font-mono font-semibold bg-zinc-100 border border-zinc-300 px-2.5 py-1 rounded-md tabular-nums">
                {filteredExits.length} registro(s) encontrado(s)
              </span>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden print:hidden divide-y divide-zinc-200 border border-zinc-300 rounded-xl overflow-hidden">
              {filteredExits.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-zinc-600 font-medium bg-zinc-50">
                  Nenhum registro de saída corresponde aos filtros selecionados.
                </div>
              ) : (
                filteredExits.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`p-4 space-y-2.5 text-xs ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 bg-zinc-100 border border-zinc-300 px-1.5 py-0.5 rounded">
                            {s.productCode}
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-700">
                            · {s.group}
                          </span>
                        </div>
                        <div className="font-bold text-zinc-900 mt-1.5 text-sm leading-snug">
                          {s.productName}
                        </div>
                        {s.isNegativeStockAuthorized && (
                          <span className="block text-[10px] font-bold text-red-700 mt-0.5">
                            Autorizado Excepcional: {s.authorizedBy}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-zinc-700 shrink-0">
                        {s.date}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-100/80 p-2.5 rounded-lg border border-zinc-200">
                      <div>
                        <span className="text-zinc-600 block">Retirado por:</span>
                        <span className="font-bold text-zinc-900">{s.withdrawnBy || '-'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block">Obra / Destino:</span>
                        <span className="font-semibold text-zinc-900">{s.destination || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-zinc-700 font-medium truncate">
                        Reg.: {s.responsibleUser}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 font-mono font-bold tabular-nums">
                        <span className="text-red-700">-{s.quantity} un</span>
                        <span className="text-zinc-400">·</span>
                        <span className="text-zinc-900">Saldo: {s.stockAfterMovement} un</span>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setMovementToDelete(s)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-colors ${
                          pendingDeletionIds.has(s.id)
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-red-600 hover:bg-red-50 border-red-200'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {pendingDeletionIds.has(s.id)
                          ? 'Exclusão solicitada'
                          : canDeleteDirectly
                          ? 'Excluir'
                          : 'Solicitar exclusão'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop & Print Table (High Contrast) */}
            <div className="hidden md:block print:block overflow-x-auto rounded-xl border border-zinc-300 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Data</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Código</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Produto Retirado</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Grupo</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800 text-right">Qtd. Retirada</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800 text-right">Saldo Restante</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800 text-red-300">
                      Colaborador que Retirou
                    </th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Obra / Destino</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800">Responsável</th>
                    <th className="py-3.5 px-3.5 border-b border-zinc-800 text-center print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredExits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-zinc-600 font-medium">
                        Nenhum registro de saída corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredExits.map((s) => (
                      <tr
                        key={s.id}
                        className="odd:bg-white even:bg-zinc-50 hover:bg-zinc-100/80 transition-colors"
                      >
                        <td className="py-3 px-3.5 font-mono font-medium text-zinc-800 whitespace-nowrap tabular-nums">
                          {s.date}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-zinc-900 whitespace-nowrap">
                          <span className="bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded">
                            {s.productCode}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-zinc-900">
                          <div>{s.productName}</div>
                          {s.isNegativeStockAuthorized && (
                            <span className="block text-[10px] font-bold text-red-700 mt-0.5">
                              Autorizado Excepcional: {s.authorizedBy}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-zinc-700 whitespace-nowrap">
                          {s.group}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-red-700 tabular-nums whitespace-nowrap">
                          -{s.quantity} un
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-extrabold text-zinc-900 tabular-nums whitespace-nowrap">
                          <span
                            className={
                              s.stockAfterMovement < 0 ? 'text-red-700' : 'text-zinc-900'
                            }
                          >
                            {s.stockAfterMovement} un
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-bold text-zinc-900 whitespace-nowrap">
                          {s.withdrawnBy || '-'}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-zinc-800 whitespace-nowrap">
                          {s.destination || '-'}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-zinc-700 whitespace-nowrap">
                          {s.responsibleUser}
                        </td>
                        <td className="py-3 px-3.5 text-center whitespace-nowrap print:hidden">
                          <button
                            type="button"
                            onClick={() => setMovementToDelete(s)}
                            title={
                              pendingDeletionIds.has(s.id)
                                ? 'Solicitação de exclusão pendente'
                                : canDeleteDirectly
                                ? 'Excluir registro de saída'
                                : 'Solicitar exclusão'
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              pendingDeletionIds.has(s.id)
                                ? 'text-amber-600 bg-amber-50'
                                : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Relatório de Produtos Críticos (Abaixo do Mínimo)</span>
              </h3>
              <span className="text-xs text-zinc-700 font-mono font-semibold bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md tabular-nums">
                {filteredCriticalProducts.length} item(ns) requer reposição
              </span>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden print:hidden divide-y divide-zinc-200 border border-zinc-300 rounded-xl overflow-hidden">
              {filteredCriticalProducts.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-emerald-800 font-semibold bg-emerald-50/40">
                  Todos os produtos estão com níveis de estoque operacional adequados!
                </div>
              ) : (
                filteredCriticalProducts.map((p, idx) => {
                  const suggestBuy = Math.max(1, p.minStock * 2 - p.currentStock);
                  const isZeroOrNeg = p.currentStock <= 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 space-y-2.5 text-xs ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-700">
                              · {p.group}
                            </span>
                          </div>
                          <div className="font-bold text-zinc-900 mt-1.5 text-sm leading-snug">
                            {p.name}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-bold shrink-0 ${
                            isZeroOrNeg ? 'text-red-700' : 'text-amber-700'
                          }`}
                        >
                          {isZeroOrNeg ? 'Zerado / Negativo' : 'Abaixo do Mínimo'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200 font-mono text-center tabular-nums">
                        <div>
                          <span className="text-[10px] text-zinc-600 block">Atual</span>
                          <span className="font-extrabold text-red-700">{p.currentStock} un</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-600 block">Mínimo</span>
                          <span className="font-semibold text-zinc-800">{p.minStock} un</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-600 block">Repor</span>
                          <span className="font-extrabold text-amber-800">+{suggestBuy} un</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop & Print Table (High Contrast) */}
            <div className="hidden md:block print:block overflow-x-auto rounded-xl border border-zinc-300 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900 text-white uppercase tracking-wider text-[11px] font-bold">
                  <tr>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Código</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Produto</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800">Grupo</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-right">Estoque Atual</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-right">Estoque Mínimo</th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-right text-amber-300">
                      Sugestão de Reposição
                    </th>
                    <th className="py-3.5 px-4 border-b border-zinc-800 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredCriticalProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-emerald-800 font-semibold">
                        Todos os produtos estão com níveis de estoque operacional adequados!
                      </td>
                    </tr>
                  ) : (
                    filteredCriticalProducts.map((p) => {
                      const suggestBuy = Math.max(1, p.minStock * 2 - p.currentStock);
                      const isZeroOrNeg = p.currentStock <= 0;
                      return (
                        <tr
                          key={p.id}
                          className="odd:bg-white even:bg-zinc-50 hover:bg-amber-50/60 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-red-700 whitespace-nowrap">
                            <span className="bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                              {p.code}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-zinc-900">{p.name}</td>
                          <td className="py-3 px-4 font-medium text-zinc-700 whitespace-nowrap">
                            {p.group}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-red-700 tabular-nums whitespace-nowrap">
                            {p.currentStock} un
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-zinc-800 whitespace-nowrap">
                            {p.minStock} un
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-800 tabular-nums whitespace-nowrap">
                            +{suggestBuy} un
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold ${
                                isZeroOrNeg ? 'text-red-700' : 'text-amber-700'
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

      {/* Email Share Modal */}
      {isEmailModalOpen && lastPdfResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 text-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold">Enviar Relatório em PDF por E-mail</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>PDF gerado e salvo no seu dispositivo</span>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-800 truncate">
                    {lastPdfResult.filename}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => buildPdfExport()}
                  className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 rounded text-[11px] font-semibold text-emerald-900 shrink-0"
                >
                  Baixar PDF de novo
                </button>
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Destinatário (E-mail)
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="exemplo@empresa.com.br"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Assunto do E-mail
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Mensagem
                </label>
                <textarea
                  rows={5}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Ao abrir seu aplicativo de e-mail, lembre-se de anexar o arquivo{' '}
                  <strong className="font-mono text-zinc-700">{lastPdfResult.filename}</strong>.
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-3.5 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg font-medium"
                >
                  Fechar
                </button>

                {canSharePdfFile && (
                  <button
                    type="button"
                    onClick={handleNativeSharePdf}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Compartilhar PDF Direto</span>
                  </button>
                )}

                <a
                  href={mailtoHref}
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Abrir Cliente de E-mail</span>
                </a>
              </div>
            </div>
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
