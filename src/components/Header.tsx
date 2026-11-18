import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff, ChevronDown, Check, Sliders, LogOut, Menu, KeyRound, X } from 'lucide-react';
import { TabId } from '../types';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const {
    currentUser,
    users,
    setCurrentUserId,
    settings,
    updateSettings,
    activeTab,
    setActiveTab,
    isRealAdmin,
    firebaseUser,
    signOutGoogle,
    linkOrUpdateEmailPassword,
  } = useApp();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const tabTitles: Record<TabId, string> = {
    dashboard: 'Painel Geral de Controle',
    produtos: 'Catálogo de Produtos & Estoque',
    entradas: 'Entradas de Materiais',
    saidas: 'Requisições & Saídas de Materiais',
    colaboradores: 'Colaboradores & Histórico de Retiradas',
    relatorios: 'Relatórios do Almoxarifado',
    estatisticas: 'Estatísticas & Análise de Giro',
    configuracoes: 'Permissões & Configurações',
  };

  const handleTogglePhotos = () => {
    updateSettings({ showProductPhotos: !settings.showProductPhotos });
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950 text-white border-b border-zinc-800 shadow-xs print:hidden">
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 h-14 sm:h-16">
        {/* Zone 1: Mobile Drawer Trigger + Brand Wordmark QHS ENGENHARIA */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              aria-label="Abrir menu de navegação"
              className="lg:hidden p-2 -ml-1 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-red-600 rounded-lg flex items-center justify-center text-white font-black tracking-tight text-xs sm:text-sm shadow-md shadow-red-950/40 border border-red-500 shrink-0">
            QHS
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold tracking-tight text-xs sm:text-base leading-none text-white truncate">
              QHS <span className="text-red-500 font-bold">ENGENHARIA</span>
            </span>
            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium tracking-wider uppercase mt-0.5 truncate">
              Almoxarifado
            </span>
          </div>
        </div>

        {/* Zone 2: Breadcrumb & Context */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
          <span className="text-zinc-500">Módulo</span>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-200 font-medium">{tabTitles[activeTab]}</span>
          <span aria-hidden="true">·</span>
          <span className="text-zinc-400 font-mono text-[11px]">Unidade Central</span>
        </div>

        {/* Zone 3: Actions (Photos Toggle, RBAC Switcher for Admin, & Sign Out) */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Quick Toggle for Product Photos */}
          <button
            onClick={handleTogglePhotos}
            title={settings.showProductPhotos ? 'Clique para ocultar fotos nos produtos' : 'Clique para exibir fotos nos produtos'}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              settings.showProductPhotos
                ? 'bg-zinc-900 text-zinc-100 border-zinc-700 hover:border-zinc-500'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            {settings.showProductPhotos ? (
              <>
                <Eye className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="hidden sm:inline">Fotos:</span>
                <span className="hidden xs:inline sm:inline text-emerald-400 font-bold">Ativas</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="hidden sm:inline">Fotos:</span>
                <span className="hidden xs:inline sm:inline text-zinc-400">Ocultas</span>
              </>
            )}
          </button>

          {/* User Switcher Dropdown (Only for real Admins to test individual employee permissions) */}
          {isRealAdmin ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-white transition-colors"
                title="Trocar usuário para testar permissões individuais das abas"
              >
                <div className="w-6 h-6 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] border border-red-500/30 shrink-0">
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
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-800">
                    <div className="p-3 bg-zinc-950">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Simulador de Usuário (Permissões RBAC)
                      </p>
                      <p className="text-xs text-zinc-300 mt-0.5">
                        Selecione um colaborador para visualizar as abas liberadas para ele:
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
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  user.isAdmin
                                    ? 'bg-red-600 text-white'
                                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                }`}
                              >
                                {user.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-zinc-200 flex items-center gap-1.5 truncate">
                                  <span className="truncate">{user.name}</span>
                                  {user.isAdmin && (
                                    <span className="text-[9px] bg-red-600 text-white px-1 py-0.2 rounded font-bold shrink-0">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {user.department || user.role}
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
          ) : (
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white">
              <div className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold text-[11px] border border-zinc-700">
                {currentUser.name.charAt(0)}
              </div>
              <span className="hidden md:inline font-semibold text-zinc-200">
                {currentUser.name.split(' ')[0]}
              </span>
            </div>
          )}

          {/* Set/Update App Password Button */}
          <button
            type="button"
            onClick={() => {
              setNewPassword('');
              setConfirmPassword('');
              setPasswordFeedback(null);
              setPasswordModalOpen(true);
            }}
            title="Definir ou alterar senha de login por e-mail"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-xs text-zinc-300 hover:text-white transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Senha</span>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={signOutGoogle}
            title={`Sair (${firebaseUser?.email || ''})`}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 hover:border-red-800 text-xs text-zinc-300 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white text-zinc-900 rounded-xl shadow-2xl max-w-sm w-full border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 text-white border-b border-zinc-800">
              <h3 className="text-xs font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-red-500" />
                Definir Senha de Acesso por E-mail
              </h3>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordFeedback(null);
                if (newPassword.length < 6) {
                  setPasswordFeedback({
                    type: 'error',
                    text: 'A senha deve ter pelo menos 6 caracteres.',
                  });
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPasswordFeedback({
                    type: 'error',
                    text: 'As senhas digitadas não coincidem.',
                  });
                  return;
                }
                setPasswordSaving(true);
                const res = await linkOrUpdateEmailPassword(newPassword);
                setPasswordSaving(false);
                if (res.success) {
                  setPasswordFeedback({
                    type: 'success',
                    text: res.message || 'Senha salva com sucesso!',
                  });
                  setNewPassword('');
                  setConfirmPassword('');
                } else {
                  setPasswordFeedback({
                    type: 'error',
                    text: res.message || 'Não foi possível salvar a senha.',
                  });
                }
              }}
              className="p-5 space-y-3.5"
            >
              <p className="text-xs text-zinc-600 leading-relaxed">
                Defina uma senha para entrar usando seu e-mail{' '}
                <strong className="font-mono text-zinc-900">{firebaseUser?.email}</strong> sem precisar usar o botão do Google.
              </p>

              {passwordFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs border ${
                    passwordFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {passwordFeedback.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nova Senha do Aplicativo (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                  placeholder="••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                  placeholder="Repita a senha"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
                >
                  {passwordSaving ? 'Salvando...' : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

