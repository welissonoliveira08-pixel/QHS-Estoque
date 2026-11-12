import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, ArrowLeft, Lock, UserCheck } from 'lucide-react';
import { TabId } from '../types';

interface AccessDeniedProps {
  requestedTab: TabId;
}

const TAB_LABELS: Record<TabId, string> = {
  dashboard: 'Dashboard',
  produtos: 'Cadastro de Produtos',
  entradas: 'Entradas no Estoque',
  saidas: 'Saídas e Requisições',
  relatorios: 'Relatórios do Almoxarifado',
  estatisticas: 'Estatísticas de Inventário',
  configuracoes: 'Configurações e Permissões',
};

export const AccessDenied: React.FC<AccessDeniedProps> = ({ requestedTab }) => {
  const { currentUser, setCurrentUserId, users, setActiveTab, availableTabsForCurrentUser } = useApp();

  const handleGoToFirstAllowed = () => {
    if (availableTabsForCurrentUser.length > 0) {
      setActiveTab(availableTabsForCurrentUser[0]);
    }
  };

  const handleSwitchToAdmin = () => {
    setCurrentUserId('user-admin');
    setActiveTab(requestedTab);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-8 shadow-xs text-center">
        <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-5 text-red-600">
          <Lock className="w-7 h-7" />
        </div>

        <span className="text-xs font-semibold text-red-600 uppercase tracking-widest">
          Acesso Restrito · Controle de Permissões QHS
        </span>

        <h2 className="text-xl font-bold text-zinc-900 mt-2 mb-3">
          Permissão Insuficiente para {TAB_LABELS[requestedTab] || requestedTab}
        </h2>

        <p className="text-sm text-zinc-600 leading-relaxed mb-6">
          O usuário <strong className="text-zinc-900 font-semibold">{currentUser.name}</strong> ({currentUser.department}) 
          não possui autorização para acessar esta aba. O administrador do sistema gerencia individualmente 
          as permissões de visualização e operação de cada colaborador.
        </p>

        <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-4 text-left text-xs text-zinc-600 mb-6 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-500">Colaborador:</span>
            <span className="font-semibold text-zinc-900">{currentUser.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Função:</span>
            <span className="font-medium text-zinc-800">{currentUser.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Aba solicitada:</span>
            <span className="font-semibold text-red-700">{TAB_LABELS[requestedTab]}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-zinc-200">
            <span className="text-zinc-500">Status de autorização:</span>
            <span className="font-semibold text-red-600">Bloqueado individualmente</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoToFirstAllowed}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Aba Autorizada
          </button>

          {!currentUser.isAdmin && (
            <button
              onClick={handleSwitchToAdmin}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors"
              title="Alternar para o perfil do Administrador Henrique Vasconcelos para testar liberação"
            >
              <UserCheck className="w-4 h-4 text-red-600" />
              Simular Acesso como Administrador
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
