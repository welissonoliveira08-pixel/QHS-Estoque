import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { NegativeStockRequest, Product, StockMovement } from '../../types';
import { DeletionActionModal, DeletionTarget } from '../DeletionActionModal';
import {
  ArrowUpRight,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  HardHat,
  X,
  User,
  ShieldAlert,
  Layers,
  Send,
  Trash2,
} from 'lucide-react';

export const ExitsTab: React.FC = () => {
  const {
    products,
    movements,
    addMovement,
    deleteMovement,
    canDeleteDirectly,
    deletionRequests,
    createDeletionRequest,
    currentUser,
    collaborators,
    setActiveTab,
    managedLists,
    negativeRequests,
    createNegativeStockRequest,
    approveNegativeStockRequest,
    rejectNegativeStockRequest,
    deleteNegativeStockRequest,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exitToDelete, setExitToDelete] = useState<StockMovement | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<NegativeStockRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pendingDeletionIds = useMemo(
    () => new Set(deletionRequests.filter((r) => r.status === 'PENDENTE').map((r) => r.targetId)),
    [deletionRequests]
  );

  // Form State (strings for numeric fields so users can clear & type freely without spinners)
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    collaboratorId: '',
    destination: managedLists.destinations[0] || '',
    date: '',
    notes: '',
  });

  // Intelligent search for product selection
  const [productSearchInput, setProductSearchInput] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Negative Stock Solicitation Modal State
  const [isSolicitationModalOpen, setIsSolicitationModalOpen] = useState(false);
  const [solicitationReason, setSolicitationReason] = useState('');

  const exits = useMemo(() => {
    return movements.filter((m) => m.type === 'SAIDA');
  }, [movements]);

  const filteredExits = useMemo(() => {
    return exits.filter((e) => {
      const q = searchFilter.toLowerCase();
      return (
        e.productName.toLowerCase().includes(q) ||
        e.productCode.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        (e.withdrawnBy && e.withdrawnBy.toLowerCase().includes(q)) ||
        (e.destination && e.destination.toLowerCase().includes(q))
      );
    });
  }, [exits, searchFilter]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === formData.productId) || null;
  }, [products, formData.productId]);

  // Product suggestions without displaying current stock next to the name
  const productSuggestions = useMemo(() => {
    if (!productSearchInput.trim()) return products;
    const q = productSearchInput.toLowerCase().trim();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [products, productSearchInput]);

  // Active non-login field collaborators for the "Colaborador que retirou" select
  const activeCollaborators = useMemo(() => {
    return [...collaborators]
      .filter((c) => c.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
  }, [collaborators]);

  const selectedCollaborator = useMemo(() => {
    return activeCollaborators.find((c) => c.id === formData.collaboratorId) || null;
  }, [activeCollaborators, formData.collaboratorId]);

  const handleOpenAdd = () => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const firstProd = products[0];
    setFormError(null);

    setFormData({
      productId: firstProd ? firstProd.id : '',
      quantity: '',
      collaboratorId: '',
      destination: managedLists.destinations[0] || '',
      date: formattedDate,
      notes: '',
    });
    setProductSearchInput(firstProd ? `${firstProd.code} - ${firstProd.name}` : '');
    setIsProductDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSelectProduct = (prod: Product) => {
    setFormData((prev) => ({
      ...prev,
      productId: prod.id,
    }));
    // Do NOT show the current stock quantity next to the product name during product selection
    setProductSearchInput(`${prod.code} - ${prod.name}`);
    setIsProductDropdownOpen(false);
  };

  const parsedQuantity = Number(formData.quantity) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.productId) {
      setFormError('Selecione um produto na lista.');
      return;
    }
    if (!selectedCollaborator) {
      setFormError('Selecione o colaborador que retirou o material.');
      return;
    }
    if (!formData.quantity.trim() || Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setFormError('Informe uma quantidade maior que zero.');
      return;
    }

    const prod = products.find((p) => p.id === formData.productId);
    if (!prod) return;

    // RULE: If requested quantity > available stock, block normal exit and offer Admin authorization
    if (prod.currentStock < parsedQuantity) {
      setSolicitationReason(
        `Solicitação de saída de ${parsedQuantity} un de ${prod.name} para a obra "${formData.destination}". Saldo disponível: ${prod.currentStock} un.`
      );
      setIsSolicitationModalOpen(true);
      return;
    }

    const res = addMovement({
      productId: prod.id,
      type: 'SAIDA',
      quantity: parsedQuantity,
      date: formData.date,
      withdrawnBy: selectedCollaborator.fullName,
      collaboratorId: selectedCollaborator.id,
      destination: formData.destination,
      notes: formData.notes,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Saída de ${parsedQuantity} un de "${prod.name}" retirada por ${selectedCollaborator.fullName} para "${formData.destination}" registrada! Saldo restante: ${res.stockAfter} un.`,
      });
      setTimeout(() => setFeedback(null), 5000);
      setIsModalOpen(false);
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Falha ao processar saída.',
      });
    }
  };

  const handleSendSolicitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || !selectedProduct || !selectedCollaborator || parsedQuantity <= 0) return;

    const res = createNegativeStockRequest({
      productId: selectedProduct.id,
      requestedQuantity: parsedQuantity,
      withdrawnBy: selectedCollaborator.fullName,
      collaboratorId: selectedCollaborator.id,
      destination: formData.destination,
      reason: solicitationReason,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: 'Solicitação de liberação com saldo negativo enviada com sucesso ao Administrador.',
      });
      setTimeout(() => setFeedback(null), 6000);
      setIsSolicitationModalOpen(false);
      setIsModalOpen(false);
    }
  };

  const handleConfirmDeleteExit = async () => {
    if (!exitToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = exitToDelete;
    const res = await deleteMovement(target.id);
    setIsDeleting(false);
    setExitToDelete(null);

    if (res.success) {
      const stockInfo =
        res.productUpdated && res.newStock !== undefined
          ? ` Estoque atual de "${target.productName}": ${res.newStock} un.`
          : '';
      setFeedback({
        type: 'success',
        message: `Saída de ${target.quantity} un de "${target.productName}" excluída com sucesso.${stockInfo}`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Erro ao excluir o registro de saída.',
      });
    }
  };

  const handleRequestDeleteExit = async (reason: string) => {
    if (!exitToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = exitToDelete;
    const res = await createDeletionRequest({
      recordType: 'SAIDA',
      targetId: target.id,
      targetCode: target.productCode,
      targetName: target.productName,
      targetDetails: `Saída em ${target.date} · Retirado por: ${target.withdrawnBy || '-'} · Obra: ${target.destination || '-'}`,
      quantity: target.quantity,
      reason,
    });
    setIsDeleting(false);
    setExitToDelete(null);

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

  const handleConfirmDeleteRequest = async () => {
    if (!requestToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = requestToDelete;
    const res = await deleteNegativeStockRequest(target.id);
    setIsDeleting(false);
    setRequestToDelete(null);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Solicitação de estoque negativo do produto "${target.productName}" excluída com sucesso.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } else {
      setFeedback({
        type: 'error',
        message: res.message || 'Erro ao excluir a solicitação.',
      });
    }
  };

  const handleRequestDeleteNegReq = async (reason: string) => {
    if (!requestToDelete || isDeleting) return;
    setIsDeleting(true);
    const target = requestToDelete;
    const res = await createDeletionRequest({
      recordType: 'SOLICITACAO_NEGATIVA',
      targetId: target.id,
      targetCode: target.productCode,
      targetName: target.productName,
      targetDetails: `Solicitação estoque negativo em ${target.date} · Retirada: ${target.withdrawnBy} · Obra: ${target.destination}`,
      quantity: target.requestedQuantity,
      reason,
    });
    setIsDeleting(false);
    setRequestToDelete(null);

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

  const activeDeletionTarget: DeletionTarget | null = exitToDelete
    ? {
        recordType: 'SAIDA',
        targetId: exitToDelete.id,
        targetCode: exitToDelete.productCode,
        targetName: exitToDelete.productName,
        targetDetails: `Saída em ${exitToDelete.date} · Obra: ${exitToDelete.destination || '-'}`,
        quantity: exitToDelete.quantity,
        modalTitle: 'Confirmar Exclusão de Saída',
        summaryText: (
          <>
            {canDeleteDirectly ? 'Tem certeza que deseja excluir a saída de ' : 'Solicitar exclusão da saída de '}
            <strong className="text-red-700">-{exitToDelete.quantity} un</strong> do produto{' '}
            <strong className="text-zinc-900">"{exitToDelete.productName}"</strong>{' '}
            (<span className="font-mono font-semibold">{exitToDelete.productCode}</span>) registrada em{' '}
            <span className="font-mono">{exitToDelete.date}</span>?
          </>
        ),
        stockImpactWarning: (
          <span>
            Esta ação apagará o registro definitivamente e{' '}
            <strong>devolverá {exitToDelete.quantity} unidade(s)</strong> ao estoque atual do produto, atualizando relatórios e estatísticas automaticamente.
          </span>
        ),
      }
    : requestToDelete
    ? {
        recordType: 'SOLICITACAO_NEGATIVA',
        targetId: requestToDelete.id,
        targetCode: requestToDelete.productCode,
        targetName: requestToDelete.productName,
        targetDetails: `Solicitação pendente em ${requestToDelete.date} · Obra: ${requestToDelete.destination}`,
        quantity: requestToDelete.requestedQuantity,
        modalTitle: 'Excluir Solicitação Pendente',
        summaryText: (
          <>
            {canDeleteDirectly
              ? 'Tem certeza que deseja excluir a solicitação de estoque negativo de '
              : 'Solicitar exclusão da solicitação de estoque negativo de '}
            <strong className="text-zinc-900">{requestToDelete.requestedQuantity} un</strong> do produto{' '}
            <strong className="text-zinc-900">"{requestToDelete.productName}"</strong>? Esta ação não altera o estoque físico.
          </>
        ),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-red-100 text-red-700 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </span>
            Saídas & Requisições de Materiais
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Controle de retiradas com identificação obrigatória do colaborador que retirou, destino e proteção contra estoque negativo.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Nova Saída
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-2 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* SECTION 7: Painel de Solicitações de Estoque Negativo (Apenas Administrador pode aprovar/recusar) */}
      {negativeRequests.some((r) => r.status === 'PENDENTE') && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-700" />
              <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Solicitações de Liberação com Estoque Negativo Pendentes
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-amber-900 bg-amber-200 px-2 py-0.5 rounded">
              Apenas o Administrador pode autorizar
            </span>
          </div>

          <div className="divide-y divide-amber-200 bg-white rounded-lg border border-amber-200 overflow-hidden">
            {negativeRequests
              .filter((r) => r.status === 'PENDENTE')
              .map((req) => (
                <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {req.productCode}
                      </span>
                      <strong className="text-zinc-900">{req.productName}</strong>
                      <span className="text-zinc-500 font-mono">({req.group})</span>
                    </div>
                    <div className="text-zinc-600">
                      Disponível em estoque: <strong>{req.availableStock} un</strong> · Solicitado para retirada: <strong className="text-red-700">{req.requestedQuantity} un</strong> (Déficit: <strong>{req.deficitQuantity} un</strong>)
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Retirada por: <strong>{req.withdrawnBy}</strong> · Obra: <strong>{req.destination}</strong> · Solicitado por: <strong>{req.requestedBy}</strong> em {req.date}
                    </div>
                    {req.reason && (
                      <p className="text-[11px] text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-200">
                        Motivo: {req.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {currentUser.isAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            const res = approveNegativeStockRequest(req.id);
                            if (res.success) {
                              setFeedback({ type: 'success', message: res.message || 'Saída autorizada!' });
                              setTimeout(() => setFeedback(null), 5000);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                        >
                          Autorizar Saída Excepcional
                        </button>
                        <button
                          onClick={() => rejectNegativeStockRequest(req.id)}
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          Recusar
                        </button>
                      </>
                    ) : (
                      <div className="text-[11px] text-amber-800 font-semibold italic bg-amber-50 px-2 py-1 rounded">
                        Aguardando parecer do Administrador
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setRequestToDelete(req)}
                      title={
                        pendingDeletionIds.has(req.id)
                          ? 'Solicitação de exclusão pendente'
                          : canDeleteDirectly
                          ? 'Excluir solicitação'
                          : 'Solicitar exclusão'
                      }
                      className={`p-1.5 rounded-lg transition-colors ${
                        pendingDeletionIds.has(req.id)
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por produto, código, colaborador que retirou ou obra..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-red-600 bg-zinc-50/50"
          />
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          Total de saídas: <strong>{filteredExits.length}</strong>
        </div>
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-3">
        {filteredExits.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-400 text-xs">
            <Layers className="w-8 h-8 mx-auto text-zinc-300 stroke-1 mb-1" />
            Nenhum registro de saída encontrado.
          </div>
        ) : (
          filteredExits.map((exit) => (
            <div key={exit.id} className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 font-mono font-semibold text-zinc-900">
                      {exit.productCode}
                    </span>
                    <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-700 text-[11px]">
                      {exit.group}
                    </span>
                  </div>
                  <p className="font-semibold text-zinc-900 mt-1">{exit.productName}</p>
                  {exit.isNegativeStockAuthorized && (
                    <span className="text-[10px] text-red-600 font-semibold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded inline-block mt-1">
                      Estoque Negativo Autorizado por {exit.authorizedBy}
                    </span>
                  )}
                </div>
                <span className="font-mono font-bold text-red-600 tabular-nums shrink-0">
                  -{exit.quantity} un
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-600 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                  <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Retirou: {exit.withdrawnBy || '-'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Obra: {exit.destination || '-'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-500">
                <span>{exit.date} · Resp: {exit.responsibleUser}</span>
                <span className={`px-2 py-0.5 rounded border font-mono font-bold ${exit.stockAfterMovement < 0 ? 'bg-red-100 text-red-800 border-red-300' : 'bg-zinc-100 text-zinc-800 border-zinc-200'}`}>
                  Saldo: {exit.stockAfterMovement} un
                </span>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setExitToDelete(exit)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-colors ${
                    pendingDeletionIds.has(exit.id)
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-red-600 hover:bg-red-50 border-red-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {pendingDeletionIds.has(exit.id)
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

      {/* SECTION 6: Tabela Principal de Saídas (md+) */}
      <div className="hidden md:block bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-200 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="py-3 px-4">Data & Horário</th>
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Nome do Produto</th>
              <th className="py-3 px-4">Grupo</th>
              <th className="py-3 px-4 text-right">Qtd. Retirada</th>
              <th className="py-3 px-4 text-right">Saldo Restante</th>
              <th className="py-3 px-4 font-bold text-red-400">Colaborador que Retirou</th>
              <th className="py-3 px-4">Cliente / Destino</th>
              <th className="py-3 px-4">Responsável Registro</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredExits.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-zinc-400">
                  <Layers className="w-8 h-8 mx-auto text-zinc-300 stroke-1 mb-1" />
                  Nenhum registro de saída encontrado.
                </td>
              </tr>
            ) : (
              filteredExits.map((exit) => (
                <tr key={exit.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-zinc-500 whitespace-nowrap">
                    {exit.date}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-zinc-900 whitespace-nowrap">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      {exit.productCode}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-zinc-900">
                    <div>{exit.productName}</div>
                    {exit.isNegativeStockAuthorized && (
                      <span className="text-[10px] text-red-600 font-semibold bg-red-50 border border-red-200 px-1 rounded inline-block mt-0.5">
                        Estoque Negativo Autorizado por {exit.authorizedBy}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-700 text-[11px]">
                      {exit.group}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-red-600 tabular-nums whitespace-nowrap">
                    -{exit.quantity} un
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 tabular-nums whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded border ${exit.stockAfterMovement < 0 ? 'bg-red-100 text-red-800 border-red-300' : 'bg-zinc-100 text-zinc-800 border-zinc-200'}`}>
                      {exit.stockAfterMovement} un
                    </span>
                  </td>

                  {/* Coluna Obrigatória: Funcionário que retirou o material */}
                  <td className="py-3 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      {exit.withdrawnBy || '-'}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-zinc-700 font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <HardHat className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      {exit.destination || '-'}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-zinc-500 whitespace-nowrap text-[11px]">
                    {exit.responsibleUser}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setExitToDelete(exit)}
                      title={
                        pendingDeletionIds.has(exit.id)
                          ? 'Solicitação de exclusão pendente'
                          : canDeleteDirectly
                          ? 'Excluir registro de saída'
                          : 'Solicitar exclusão'
                      }
                      className={`p-1.5 rounded-lg transition-colors ${
                        pendingDeletionIds.has(exit.id)
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

      {/* SECTION 6: Modal Nova Saída (Sem campo de requisição, sem quantidade ao lado do nome) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white sticky top-0 z-10">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-red-400" />
                Registrar Saída de Material
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}
              {/* 1. Data e Horário */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Data e Horário *
                </label>
                <input
                  type="text"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-mono"
                  placeholder="YYYY-MM-DD HH:mm"
                />
              </div>

              {/* 2. Seleção de Produto Inteligente (SEM quantidade ao lado do nome) */}
              <div className="relative">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Pesquisar Produto (por Nome ou Código) *
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={productSearchInput}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchInput(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    placeholder="Digite código ou nome do produto..."
                    className="w-full pl-9 pr-8 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 font-medium"
                  />
                  {productSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchInput('');
                        setFormData((prev) => ({ ...prev, productId: '' }));
                        setIsProductDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isProductDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsProductDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto divide-y divide-zinc-100">
                      {productSuggestions.length === 0 ? (
                        <div className="p-3 text-xs text-zinc-500 text-center">
                          Nenhum produto encontrado
                        </div>
                      ) : (
                        productSuggestions.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectProduct(prod)}
                            className="w-full text-left p-2.5 hover:bg-red-50 text-xs flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-zinc-900">
                                {prod.name}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">
                                Código: {prod.code} · Grupo: {prod.group}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                              Selecionar
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 3. CAMPO OBRIGATÓRIO: COLABORADOR QUE RETIROU */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Colaborador que retirou *
                </label>
                {activeCollaborators.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                    <p className="font-medium">
                      Nenhum colaborador ativo cadastrado. Cadastre os funcionários antes de registrar uma saída.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setActiveTab('colaboradores');
                        }}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md font-semibold text-[11px]"
                      >
                        Ir para Colaboradores
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setActiveTab('configuracoes');
                        }}
                        className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-md font-semibold text-[11px]"
                      >
                        Cadastrar em Configurações
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <select
                      required
                      value={formData.collaboratorId}
                      onChange={(e) =>
                        setFormData({ ...formData, collaboratorId: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-medium"
                    >
                      <option value="">Selecione o colaborador que retirou...</option>
                      {activeCollaborators.map((colab) => (
                        <option key={colab.id} value={colab.id}>
                          {colab.fullName}
                          {colab.role ? ` (${colab.role})` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Funcionários ativos cadastrados (sem acesso ao aplicativo).
                    </span>
                  </>
                )}
              </div>

              {/* 4. Cliente / Local de Destino */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Cliente / Local de Destino *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setActiveTab('destinos');
                    }}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    + Gerenciar destinos
                  </button>
                </div>
                <select
                  required
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                >
                  <option value="">
                    {managedLists.destinations.length === 0
                      ? 'Cadastre em Clientes e Destinos...'
                      : 'Selecione o cliente / local de destino...'}
                  </option>
                  {managedLists.destinations.map((dest) => (
                    <option key={dest} value={dest}>
                      {dest}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Quantidade Solicitada */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Quantidade a Retirar (Unidades) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value.replace(/\D/g, '') })
                  }
                  placeholder="Ex: 5"
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono tabular-nums font-bold text-red-700 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Informação da Quantidade Disponível na Parte Inferior do Formulário */}
              {selectedProduct && (
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                  parsedQuantity > 0 && selectedProduct.currentStock < parsedQuantity
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                }`}>
                  <div>
                    <span className="block font-medium">Quantidade disponível no estoque físico:</span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Produto: {selectedProduct.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-sm tabular-nums">
                      {selectedProduct.currentStock} un
                    </span>
                    {parsedQuantity > 0 && selectedProduct.currentStock < parsedQuantity && (
                      <span className="block text-[10px] text-red-600 font-semibold">
                        Aviso: Quantidade solicitada excede o saldo!
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Observações da Aplicação
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                  placeholder="Justificativa técnica, pavimentos, urgência..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {selectedProduct && parsedQuantity > 0 && selectedProduct.currentStock < parsedQuantity
                    ? 'Solicitar Autorização ao Administrador'
                    : 'Confirmar Saída'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 7: Modal de Solicitação de Autorização ao Administrador para Estoque Negativo */}
      {isSolicitationModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between px-5 py-3.5 bg-red-600 text-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">
                  Autorização Excepcional Necessária
                </h3>
              </div>
              <button
                onClick={() => setIsSolicitationModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendSolicitation} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 space-y-1">
                <p className="font-bold">A saída solicitada excede o saldo físico:</p>
                <p>Estoque disponível: <strong>{selectedProduct.currentStock} un</strong></p>
                <p>Quantidade desejada: <strong>{parsedQuantity} un</strong></p>
                <p>Déficit resultante: <strong className="text-red-700">{parsedQuantity - selectedProduct.currentStock} un</strong></p>
              </div>

              <p className="text-zinc-600 leading-relaxed">
                Pelas regras de governança da QHS Engenharia, saídas que resultem em estoque negativo requerem autorização individual expressa do Administrador.
              </p>

              <div>
                <label className="block font-semibold text-zinc-800 mb-1">
                  Justificativa / Motivo da Liberação Urgente *
                </label>
                <textarea
                  required
                  rows={3}
                  value={solicitationReason}
                  onChange={(e) => setSolicitationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 text-xs"
                  placeholder="Explique o motivo da necessidade de retirada imediata..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsSolicitationModalOpen(false)}
                  className="px-3.5 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar Solicitação ao Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeletionActionModal
        target={activeDeletionTarget}
        canDeleteDirectly={canDeleteDirectly}
        hasPendingRequest={
          activeDeletionTarget ? pendingDeletionIds.has(activeDeletionTarget.targetId) : false
        }
        isSubmitting={isDeleting}
        onClose={() => {
          setExitToDelete(null);
          setRequestToDelete(null);
        }}
        onConfirmDirectDelete={
          exitToDelete ? handleConfirmDeleteExit : handleConfirmDeleteRequest
        }
        onSubmitRequest={
          exitToDelete ? handleRequestDeleteExit : handleRequestDeleteNegReq
        }
      />
    </div>
  );
};
