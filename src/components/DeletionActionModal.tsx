import React, { useState, useEffect } from 'react';
import { AlertTriangle, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import { DeletionRecordType } from '../types';

export interface DeletionTarget {
  recordType: DeletionRecordType;
  targetId: string;
  targetCode: string;
  targetName: string;
  targetDetails: string;
  quantity: number;
  modalTitle?: string;
  summaryText: React.ReactNode;
  stockImpactWarning?: React.ReactNode;
}

interface DeletionActionModalProps {
  target: DeletionTarget | null;
  canDeleteDirectly: boolean;
  hasPendingRequest?: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmDirectDelete: () => Promise<void> | void;
  onSubmitRequest: (reason: string) => Promise<void> | void;
}

export const DeletionActionModal: React.FC<DeletionActionModalProps> = ({
  target,
  canDeleteDirectly,
  hasPendingRequest = false,
  isSubmitting,
  onClose,
  onConfirmDirectDelete,
  onSubmitRequest,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setError(null);
  }, [target?.targetId, target?.recordType]);

  if (!target) return null;

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || hasPendingRequest) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Informe uma justificativa clara (mínimo 3 caracteres) explicando o motivo da exclusão.');
      return;
    }
    setError(null);
    await onSubmitRequest(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs print:hidden">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white">
          <div className="flex items-center gap-2">
            {canDeleteDirectly ? (
              <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <h3 className="text-sm font-bold">
              {canDeleteDirectly
                ? target.modalTitle || 'Confirmar Exclusão'
                : 'Solicitar Exclusão ao Administrador'}
            </h3>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {canDeleteDirectly ? (
          <div className="p-5 space-y-4">
            <div className="text-xs text-zinc-700 leading-relaxed">
              {target.summaryText}
            </div>

            {target.stockImpactWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>{target.stockImpactWarning}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onConfirmDirectDelete()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isSubmitting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRequestSubmit} className="p-5 space-y-4">
            <div className="text-xs text-zinc-700 leading-relaxed">
              {target.summaryText}
            </div>

            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] text-zinc-700 leading-relaxed">
              Seu usuário não possui permissão de exclusão direta. Esta solicitação ficará aguardando análise e aprovação do{' '}
              <strong className="text-zinc-900">Administrador principal</strong>.
            </div>

            {hasPendingRequest ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Já existe uma solicitação de exclusão pendente para este registro aguardando parecer do Administrador.
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-800 mb-1">
                  Justificativa da Exclusão *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Explique o motivo pelo qual este registro precisa ser excluído..."
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-red-600"
                />
                {error && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">{error}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              {!hasPendingRequest && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Enviando...' : 'Solicitar Exclusão'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
