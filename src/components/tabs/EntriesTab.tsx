import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
  ArrowDownRight,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  X,
  Package,
  Layers,
} from 'lucide-react';

export const EntriesTab: React.FC = () => {
  const { products, movements, addMovement, currentUser } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State (strictly: Data, Produto inteligente, Quantidade recebida, Observação)
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 1,
    date: '',
    notes: '',
  });

  // Intelligent Search in modal
  const [productSearchInput, setProductSearchInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Entries filtered from movements
  const entries = useMemo(() => {
    return movements.filter((m) => m.type === 'ENTRADA');
  }, [movements]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const q = searchFilter.toLowerCase();
      return (
        e.productName.toLowerCase().includes(q) ||
        e.productCode.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    });
  }, [entries, searchFilter]);

  // Intelligent product matching list
  const productSuggestions = useMemo(() => {
    if (!productSearchInput.trim()) {
      return products;
    }
    const q = productSearchInput.toLowerCase().trim();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [products, productSearchInput]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === formData.productId) || null;
  }, [products, formData.productId]);

  const handleOpenAdd = () => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Default select first product or empty
    const firstProd = products[0];
    setFormData({
      productId: firstProd ? firstProd.id : '',
      quantity: 1,
      date: formattedDate,
      notes: '',
    });
    setProductSearchInput(firstProd ? `${firstProd.code} - ${firstProd.name}` : '');
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSelectProduct = (prod: Product) => {
    setFormData((prev) => ({ ...prev, productId: prod.id }));
    // Do NOT show the current stock quantity next to the product name during entry form filling
    setProductSearchInput(`${prod.code} - ${prod.name}`);
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId || formData.quantity <= 0) return;

    const prod = products.find((p) => p.id === formData.productId);
    if (!prod) return;

    const res = addMovement({
      productId: prod.id,
      type: 'ENTRADA',
      quantity: Number(formData.quantity),
      date: formData.date,
      notes: formData.notes,
    });

    if (res.success) {
      setSuccessMessage(
        `Entrada de ${formData.quantity} un de "${prod.name}" registrada! Saldo em estoque após a entrada: ${res.stockAfter} un.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <ArrowDownRight className="w-5 h-5" />
            </span>
            Entradas no Almoxarifado
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Registro de recebimento de materiais com cálculo automático do estoque resultante após cada entrada.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Nova Entrada
        </button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar histórico por produto, código ou observação..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-600 bg-zinc-50/50"
          />
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          Total de entradas: <strong>{filteredEntries.length}</strong>
        </div>
      </div>

      {/* SECTION 5: Tabela de Histórico de Entradas com "Qtd. Recebida" E "Estoque após a Entrada" SEPARADAMENTE */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-200 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="py-3 px-4">Data & Horário</th>
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Nome do Produto</th>
              <th className="py-3 px-4">Grupo</th>
              <th className="py-3 px-4 text-right">Qtd. Recebida</th>
              <th className="py-3 px-4 text-right">Estoque Após a Entrada</th>
              <th className="py-3 px-4">Responsável</th>
              <th className="py-3 px-4">Observações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-zinc-400">
                  <Layers className="w-8 h-8 mx-auto text-zinc-300 stroke-1 mb-1" />
                  Nenhum registro de entrada encontrado.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-zinc-500 whitespace-nowrap">
                    {entry.date}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-zinc-900 whitespace-nowrap">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      {entry.productCode}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-zinc-900">
                    {entry.productName}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-700 text-[11px]">
                      {entry.group}
                    </span>
                  </td>

                  {/* Informação 1: Quantidade recebida */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                    +{entry.quantity} un
                  </td>

                  {/* Informação 2: Quantidade que ficou disponível no estoque após aquela entrada */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 tabular-nums whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                      {entry.stockAfterMovement} un
                    </span>
                  </td>

                  <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">
                    {entry.responsibleUser}
                  </td>
                  <td className="py-3 px-4 text-zinc-500 text-[11px] max-w-xs truncate">
                    {entry.notes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION 4: Modal de Nova Entrada Simplificado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                Registrar Entrada de Material
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 1. Data da Entrada */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Data e Horário *
                </label>
                <input
                  type="text"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-emerald-600 font-mono"
                  placeholder="YYYY-MM-DD HH:mm"
                />
              </div>

              {/* 2. Barra de Pesquisa Inteligente de Produtos (Nome ou Código) */}
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
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchInput(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    placeholder="Digite o código (ex: QHS-EXT) ou nome (ex: Extintor, Placa)..."
                    className="w-full pl-9 pr-8 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-emerald-600 font-medium"
                  />
                  {productSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchInput('');
                        setFormData((prev) => ({ ...prev, productId: '' }));
                        setIsDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Suggestions List (WITHOUT displaying stock quantity next to the name) */}
                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto divide-y divide-zinc-100">
                      {productSuggestions.length === 0 ? (
                        <div className="p-3 text-xs text-zinc-500 text-center">
                          Nenhum produto encontrado para "{productSearchInput}"
                        </div>
                      ) : (
                        productSuggestions.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectProduct(prod)}
                            className="w-full text-left p-2.5 hover:bg-emerald-50 text-xs flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="font-semibold text-zinc-900">
                                {prod.name}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">
                                Código: {prod.code} · Grupo: {prod.group}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                              Selecionar
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Informações preenchidas automaticamente ao selecionar */}
              {selectedProduct && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Produto selecionado:</span>
                    <span className="font-semibold text-zinc-900">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Código / Grupo:</span>
                    <span className="font-mono text-zinc-800">{selectedProduct.code} · {selectedProduct.group}</span>
                  </div>
                </div>
              )}

              {/* 3. Quantidade Recebida */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Quantidade Recebida (Unidades) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono tabular-nums font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* 4. Observação */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Observação
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  placeholder="Informações adicionais sobre o recebimento..."
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Confirmar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
