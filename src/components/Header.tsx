import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Eye, EyeOff, User, ChevronDown, Check, Building2, Sliders } from 'lucide-react';
import { TabId } from '../types';

export const Header: React.FC = () => {
  const {
    currentUser,
    users,
    setCurrentUserId,
    settings,
    updateSettings,
    activeTab,
    setActiveTab,
  } = useApp();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const tabTitles: Record<TabId, string> = {
    dashboard: 'Painel Geral de Controle',
    produtos: 'Catálogo de Produtos & Estoque',
    entradas: 'Entradas de Materiais & NF-e',
    saidas: 'Requisições & Saídas de Materiais',
    relatorios: 'Relatórios do Almoxarifado',
    estatisticas: 'Estatísticas & Análise de Giro',
    configuracoes: 'Permissões & Configurações',
  };

  const handleTogglePhotos = () => {
    updateSettings({ showProductPhotos: !settings.showProductPhotos });
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950 text-white border-b border-zinc-800 shadow-xs">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 h-16">
        {/* Zone 1: Brand Wordmark QHS ENGENHARIA */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center text-white font-black tracking-tight text-sm shadow-md shadow-red-950/40 border border-red-500">
            QHS
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-sm sm:text-base leading-none text-white whitespace-nowrap">
              QHS <span className="text-red-500 font-bold">ENGENHARIA</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase mt-0.5 whitespace-nowrap">
              Almoxarifado & Materiais
            </span>
          </div>
        </div>

        {/* Zone 2: Breadcrumb & Context */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
          <span className="text-zinc-500">Módulo</span>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-200 font-medium">{tabTitles[activeTab]}</span>
          <span aria-hidden="true">·</span>
          <span className="text-zinc-400 font-mono text-[11px]">Unidade Central</span>
        </div>

        {/* Zone 3: Actions (Photos Toggle & RBAC User Switcher) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Quick Toggle for Product Photos */}
          <button
            onClick={handleTogglePhotos}
            title={settings.showProductPhotos ? 'Clique para ocultar fotos nos produtos' : 'Clique para exibir fotos nos produtos'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              settings.showProductPhotos
                ? 'bg-zinc-900 text-zinc-100 border-zinc-700 hover:border-zinc-500'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            {settings.showProductPhotos ? (
              <>
                <Eye className="w-3.5 h-3.5 text-red-500" />
                <span className="hidden sm:inline">Fotos:</span>
                <span className="text-emerald-400 font-bold">Ativadas</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden sm:inline">Fotos:</span>
                <span className="text-zinc-400">Ocultas</span>
              </>
            )}
          </button>

          {/* User Switcher Dropdown (To test individual permissions instantly) */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-white transition-colors"
              title="Trocar usuário para testar permissões individuais das abas"
            >
              <div className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] border border-red-500/30">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-semibold text-zinc-200">{currentUser.name.split(' ')[0]}</span>
                  {currentUser.isAdmin ? (
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">({currentUser.role})</span>
                  )}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-800">
                  <div className="p-3 bg-zinc-950">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Simulador de Usuário (Permissões RBAC)
                    </p>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Selecione um colaborador para ver as abas e acessos liberados para ele:
                    </p>
                  </div>

                  <div className="py-1 max-h-64 overflow-y-auto">
                    {users.map((user) => {
                      const isSelected = user.id === currentUser.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            setCurrentUserId(user.id);
                            setUserDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800 ${
                            isSelected ? 'bg-zinc-800/80 text-white' : 'text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                user.isAdmin
                                  ? 'bg-red-600 text-white'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                                {user.name}
                                {user.isAdmin && (
                                  <span className="text-[9px] bg-red-600 text-white px-1 py-0.2 rounded font-bold">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {user.department}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-red-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {currentUser.isAdmin && (
                    <div className="p-2 bg-zinc-950">
                      <button
                        onClick={() => {
                          setActiveTab('configuracoes');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 font-semibold"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        Gerenciar Permissões de Usuários
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
