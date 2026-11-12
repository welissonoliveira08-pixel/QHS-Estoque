import React from 'react';
import { useApp } from '../context/AppContext';
import { X, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';

export const ProductPhotoModal: React.FC = () => {
  const { selectedProductForModal, setSelectedProductForModal } = useApp();

  if (!selectedProductForModal) return null;

  const product = selectedProductForModal;
  const isBelowMin = product.currentStock <= product.minStock;
  const isZero = product.currentStock === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={() => setSelectedProductForModal(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-900 text-white">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-red-600 text-white rounded">
              {product.code}
            </span>
            <span className="text-xs text-zinc-300">QHS Engenharia · Almoxarifado</span>
          </div>
          <button
            onClick={() => setSelectedProductForModal(null)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image Container */}
          <div className="bg-zinc-100 relative min-h-[260px] md:min-h-[320px] flex items-center justify-center p-4 border-b md:border-b-0 md:border-r border-zinc-200">
            {product.photoUrl ? (
              <img
                src={product.photoUrl}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full max-h-[320px] object-contain rounded-md"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
                <Layers className="w-16 h-16 stroke-1 text-zinc-300 mb-2" />
                <span className="text-xs font-medium text-zinc-500">Sem fotografia cadastrada</span>
                <span className="text-[11px] text-zinc-400 mt-1">A consulta e o controle de estoque funcionam normalmente sem foto.</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                  Grupo: {product.group}
                </span>
                <h3 className="text-lg font-bold text-zinc-900 mt-1 leading-snug">
                  {product.name}
                </h3>
              </div>

              {/* Specs & Stock Details */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Código do Produto:</span>
                  <span className="font-mono font-bold text-zinc-800">{product.code}</span>
                </div>

                <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Grupo:</span>
                  <span className="font-medium text-zinc-800">{product.group}</span>
                </div>

                <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Estoque Atual:</span>
                  <span
                    className={`font-mono font-bold text-sm tabular-nums flex items-center gap-1.5 ${
                      isZero
                        ? 'text-red-700 font-extrabold'
                        : isBelowMin
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {isBelowMin ? (
                      <AlertTriangle className="w-4 h-4 inline" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 inline" />
                    )}
                    {product.currentStock} itens
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-2 border-b border-zinc-100">
                  <span className="text-zinc-500">Estoque Mínimo de Segurança:</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-zinc-700">
                    {product.minStock} itens
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-2">
                  <span className="text-zinc-500">Situação:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      isZero
                        ? 'bg-red-100 text-red-700'
                        : isBelowMin
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isZero ? 'Esgotado' : isBelowMin ? 'Reposição Necessária' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                Cadastro: {product.createdAt}
              </span>
              <button
                onClick={() => setSelectedProductForModal(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

