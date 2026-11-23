import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';

export const DestinationsTab: React.FC = () => {
  const {
    managedLists,
    addDestination,
    editDestination,
    deleteDestination,
    canAccessTab,
    setActiveTab,
  } = useApp();

  const [newDestinationName, setNewDestinationName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDestination, setEditingDestination] = useState<{
    oldName: string;
    currentVal: string;
  } | null>(null);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

  const showNotice = (text: string, isError = false) => {
    setNotice({ text, isError });
    setTimeout(() => setNotice(null), 4000);
  };

  const filteredDestinations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = [...managedLists.destinations].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!q) return list;
    return list.filter((dest) => dest.toLowerCase().includes(q));
  }, [managedLists.destinations, searchTerm]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDestinationName.trim();
    if (!trimmed) return;
    const ok = addDestination(trimmed);
    if (ok) {
      showNotice(`"${trimmed}" cadastrado em Clientes e Locais de Destino!`);
      setNewDestinationName('');
    } else {
      showNotice(`"${trimmed}" já está cadastrado na lista.`, true);
    }
  };

  const handleSaveEdit = () => {
    if (!editingDestination) return;
    const trimmed = editingDestination.currentVal.trim();
    if (!trimmed) {
      showNotice('Informe um nome válido.', true);
      return;
    }
    if (
      trimmed.toLowerCase() !== editingDestination.oldName.toLowerCase() &&
      managedLists.destinations.some((d) => d.toLowerCase() === trimmed.toLowerCase())
    ) {
      showNotice(`Já existe um destino chamado "${trimmed}".`, true);
      return;
    }
    const ok = editDestination(editingDestination.oldName, trimmed);
    if (ok) {
      showNotice(`Destino atualizado para "${trimmed}".`);
      setEditingDestination(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteName) return;
    const target = confirmDeleteName;
    setConfirmDeleteName(null);
    deleteDestination(target);
    showNotice(`"${target}" removido da lista de Clientes e Locais de Destino.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-zinc-900 text-white rounded-lg">
              <MapPin className="w-5 h-5 text-red-500" />
            </span>
            Clientes e Locais de Destino
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Visualize e cadastre clientes e locais de destino disponíveis nas saídas de materiais do almoxarifado.
          </p>
        </div>

        {canAccessTab('saidas') && (
          <button
            type="button"
            onClick={() => setActiveTab('saidas')}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowUpRight className="w-4 h-4 text-red-400" />
            Ir para Saídas de Materiais
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium border ${
            notice.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notice.isError ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Add Form */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            Cadastrar Novo Cliente ou Local de Destino
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            O cadastro fica imediatamente disponível no campo de seleção de saídas.
          </p>
        </div>

        <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            required
            value={newDestinationName}
            onChange={(e) => setNewDestinationName(e.target.value)}
            placeholder="Ex: Cliente Construtora Alpha · Obra Centro"
            className="flex-1 px-3.5 py-2.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 bg-white"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar Cliente / Destino
          </button>
        </form>
      </div>

      {/* Listing */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-zinc-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900">
              Locais Cadastrados
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-mono font-bold text-zinc-700 tabular-nums">
              {managedLists.destinations.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente ou local..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600 bg-zinc-50 focus:bg-white"
            />
          </div>
        </div>

        {managedLists.destinations.length === 0 ? (
          <div className="text-center py-10 px-4 bg-zinc-50 border border-dashed border-zinc-300 rounded-xl space-y-2">
            <MapPin className="w-7 h-7 text-zinc-400 mx-auto" />
            <p className="text-xs font-semibold text-zinc-700">
              Nenhum cliente ou local de destino cadastrado ainda.
            </p>
            <p className="text-[11px] text-zinc-500">
              Utilize o campo acima para cadastrar o primeiro cliente ou local de destino.
            </p>
          </div>
        ) : filteredDestinations.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            Nenhum destino encontrado para &ldquo;{searchTerm}&rdquo;.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredDestinations.map((dest) => {
              const isEditing = editingDestination?.oldName === dest;
              return (
                <div
                  key={dest}
                  className="bg-zinc-50/70 hover:bg-white p-3 rounded-lg border border-zinc-200 flex items-center justify-between gap-2 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editingDestination.currentVal}
                        onChange={(e) =>
                          setEditingDestination({
                            ...editingDestination,
                            currentVal: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit();
                          } else if (e.key === 'Escape') {
                            setEditingDestination(null);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-red-500 rounded bg-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded shrink-0"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDestination(null)}
                        className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded shrink-0"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span className="text-xs font-medium text-zinc-800 truncate">{dest}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingDestination({ oldName: dest, currentVal: dest })
                          }
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded"
                          title="Editar nome"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteName(dest)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Excluir destino"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-bold">Excluir Cliente / Local de Destino</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteName(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-700 leading-relaxed">
                Deseja excluir &ldquo;<strong>{confirmDeleteName}</strong>&rdquo; da lista de Clientes e Locais de Destino? As saídas já registradas anteriormente manterão o histórico preservado.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteName(null)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
