import React from 'react';
import { useApp } from '../context/AppContext';
import { TabId } from '../types';
import {
  LayoutDashboard,
  Package,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  BarChart3,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  MapPin,
  X,
} from 'lucide-react';

interface NavItem {
  id: TabId;
  label: string;
  description: string;
  icon: React.ElementType;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral e indicadores',
    icon: LayoutDashboard,
  },
  {
    id: 'produtos',
    label: 'Cadastro de Produtos',
    description: 'Catálogo, estoque e fotos',
    icon: Package,
  },
  {
    id: 'entradas',
    label: 'Entradas',
    description: 'Recebimento de materiais e NF',
    icon: ArrowDownRight,
  },
  {
    id: 'saidas',
    label: 'Saídas',
    description: 'Requisições para obras e projetos',
    icon: ArrowUpRight,
  },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    description: 'Funcionários de obra e retiradas',
    icon: Users,
  },
  {
    id: 'destinos',
    label: 'Clientes e Destinos',
    description: 'Clientes e locais de destino',
    icon: MapPin,
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    description: 'Extratos e balanços de estoque',
    icon: FileText,
  },
  {
    id: 'estatisticas',
    label: 'Estatísticas',
    description: 'Curva ABC, giro e consumo',
    icon: BarChart3,
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    description: 'Permissões de usuários e fotos',
    icon: Settings,
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const {
    activeTab,
    setActiveTab,
    canAccessTab,
    currentUser,
    pendingAccessRequestsCount,
    pendingDeletionRequestsCount,
    pendingNegativeRequestsCount,
  } = useApp();

  const totalAdminPending =
    pendingAccessRequestsCount +
    pendingDeletionRequestsCount +
    pendingNegativeRequestsCount;

  // Filtrar apenas as abas autorizadas para o usuário logado
  const allowedNavItems = ALL_NAV_ITEMS.filter((item) =>
    canAccessTab(item.id, currentUser)
  );

  const handleSelectTab = (tab: TabId) => {
    setActiveTab(tab);
    onCloseMobile?.();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div className="p-4 space-y-6 overflow-y-auto">
        {/* Mobile Drawer Header */}
        <div className="flex items-center justify-between lg:hidden pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xs border border-red-500">
              QHS
            </div>
            <div>
              <div className="text-xs font-extrabold text-white leading-none">
                QHS <span className="text-red-500">ENGENHARIA</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Menu de Navegação</div>
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div>
          <div className="px-3 pb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span>Módulos Autorizados</span>
            <span className="font-mono text-[10px] text-zinc-400">
              {allowedNavItems.length} de {ALL_NAV_ITEMS.length}
            </span>
          </div>

          <nav className="space-y-1">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const showBadge =
                item.id === 'configuracoes' && currentUser.isAdmin && totalAdminPending > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-red-600 text-white shadow-xs font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive
                          ? 'text-white'
                          : 'text-zinc-400 group-hover:text-red-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {showBadge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isActive ? 'bg-white text-red-600' : 'bg-red-600 text-white'
                      }`}
                    >
                      {totalAdminPending}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Notice when some tabs are blocked */}
        {!currentUser.isAdmin && ALL_NAV_ITEMS.length > allowedNavItems.length && (
          <div className="mx-2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-400 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-300 font-medium mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>Menu Personalizado</span>
            </div>
            <p className="leading-tight text-zinc-400">
              {ALL_NAV_ITEMS.length - allowedNavItems.length} aba(s) ocultadas de acordo com as permissões atribuídas a seu usuário.
            </p>
          </div>
        )}
      </div>

      {/* User profile footer */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs text-zinc-200 truncate">
              {currentUser.name}
            </div>
            <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
              {currentUser.isAdmin ? (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Admin Total
                </span>
              ) : (
                <span className="truncate">{currentUser.role}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-zinc-950 text-zinc-300 border-r border-zinc-800 flex-col select-none print:hidden">
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[82vw] bg-zinc-950 text-zinc-300 border-r border-zinc-800 flex flex-col h-full shadow-2xl select-none">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
