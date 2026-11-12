import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
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
  Clock,
  Layers,
  Send,
} from 'lucide-react';

export const ExitsTab: React.FC = () => {
  const {
    products,
    movements,
    addMovement,
    currentUser,
    users,
    managedLists,
    negativeRequests,
    createNegativeStockRequest,
    approveNegativeStockRequest,
    rejectNegativeStockRequest,
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State (strictly: Data, Produto inteligente, Quantidade, Funcionário que retirou, Destino/Obra, Observações)
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    withdrawnBy: '',
    destination: managedLists.destinations[0] || 'Canteiro Central QHS',
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

  // Active employees for the "Funcionário que retirou o material" select
  const activeEmployees = useMemo(() => {
    return users.filter((u) => u.active);
  }, [users]);

  const handleOpenAdd = () => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const firstProd = products[0];
    const defaultWithdrawn = activeEmployees[0]?.name || currentUser.name;

    setFormData({
      productId: firstProd ? firstProd.id : '',
      quantity: 1,
      withdrawnBy: defaultWithdrawn,
      destination: managedLists.destinations[0] || 'Canteiro Central QHS',
      date: formattedDate,
      notes: '',
    });
    setProductSearchInput(firstProd ? `${firstProd.code} - ${firstProd.name}` : '');
    setIsProductDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSelectProduct = (prod: Product) => {
    setFormData((prev) => ({ ...prev, productId: prod.id }));
    // Do NOT show the current stock quantity next to the product name during product selection
    setProductSearchInput(`${prod.code} - ${prod.name}`);
    setIsProductDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || formData.quantity <= 0 || !formData.withdrawnBy) {
      return;
    }

    const prod = products.find((p) => p.id === formData.productId);
    if (!prod) return;

    // RULE: If requested quantity > available stock, block normal exit and offer Admin authorization
    if (prod.currentStock < formData.quantity) {
      // Open Solicitation Modal
      setSolicitationReason(
        `Solicitação de saída de ${formData.quantity} un de ${prod.name} para a obra "${formData.destination}". Saldo disponível: ${prod.currentStock} un.`
      );
      setIsSolicitationModalOpen(true);
      return;
    }

    const res = addMovement({
      productId: prod.id,
      type: 'SAIDA',
      quantity: Number(formData.quantity),
      date: formData.date,
      withdrawnBy: formData.withdrawnBy,
      destination: formData.destination,
      notes: formData.notes,
    });

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Saída de ${formData.quantity} un de "${prod.name}" para "${formData.destination}" registrada! Saldo restante: ${res.stockAfter} un.`,
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
    if (!formData.productId || !selectedProduct) return;

    const res = createNegativeStockRequest({
      productId: selectedProduct.id,
      requestedQuantity: Number(formData.quantity),
      withdrawnBy: formData.withdrawnBy,
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
            Controle de retiradas com identificação obrigatória do funcionário, destino e proteção contra estoque negativo.
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

                  {currentUser.isAdmin ? (
                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
                  ) : (
                    <div className="shrink-0 text-[11px] text-amber-800 font-semibold italic bg-amber-50 px-2 py-1 rounded">
                      Aguardando parecer do Administrador
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por produto, código, funcionário que retirou ou obra..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-red-600 bg-zinc-50/50"
          />
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          Total de saídas: <strong>{filteredExits.length}</strong>
        </div>
      </div>

      {/* SECTION 6: Tabela Principal de Saídas com Coluna "Funcionário que retirou o material" */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-200 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="py-3 px-4">Data & Horário</th>
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Nome do Produto</th>
              <th className="py-3 px-4">Grupo</th>
              <th className="py-3 px-4 text-right">Qtd. Retirada</th>
              <th className="py-3 px-4 text-right">Saldo Restante</th>
              <th className="py-3 px-4 font-bold text-red-400">Funcionário que Retirou</th>
              <th className="py-3 px-4">Obra / Destino</th>
              <th className="py-3 px-4">Responsável Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredExits.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-zinc-400">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 6: Modal Nova Saída (Sem campo de requisição, sem quantidade ao lado do nome) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white">
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

              {/* 3. CAMPO OBRIGATÓRIO: FUNCIONÁRIO QUE RETIROU O MATERIAL */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  FUNCIONÁRIO QUE RETIROU O MATERIAL *
                </label>
                <select
                  required
                  value={formData.withdrawnBy}
                  onChange={(e) => setFormData({ ...formData, withdrawnBy: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white font-medium"
                >
                  <option value="">Selecione o colaborador responsável pela retirada...</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.role} - {emp.department})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Colaborador cadastrado na área administrativa responsável pelo material.
                </span>
              </div>

              {/* 4. Obra de Destino / Frente de Serviço */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Obra de Destino / Canteiro *
                </label>
                <select
                  required
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-white"
                >
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
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono tabular-nums font-bold text-red-700 focus:outline-none focus:border-red-600"
                />
              </div>

              {/* Informação da Quantidade Disponível na Parte Inferior do Formulário (conforme solicitado) */}
              {selectedProduct && (
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  selectedProduct.currentStock < formData.quantity
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                }`}>
                  <div>
                    <span className="block font-medium">Quantidade disponível no estoque físico:</span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Produto: {selectedProduct.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm tabular-nums">
                      {selectedProduct.currentStock} un
                    </span>
                    {selectedProduct.currentStock < formData.quantity && (
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
                  {selectedProduct && selectedProduct.currentStock < formData.quantity
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between px-5 py-3.5 bg-red-600 text-white">
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
                <p>Quantidade desejada: <strong>{formData.quantity} un</strong></p>
                <p>Déficit resultante: <strong className="text-red-700">{formData.quantity - selectedProduct.currentStock} un</strong></p>
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
    </div>
  );
};
