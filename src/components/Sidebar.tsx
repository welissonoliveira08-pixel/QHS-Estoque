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
  AlertTriangle,
  UserCheck,
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

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    canAccessTab,
    currentUser,
    products,
    availableTabsForCurrentUser,
  } = useApp();

  // Filtrar apenas as abas autorizadas para o usuário logado
  const allowedNavItems = ALL_NAV_ITEMS.filter((item) =>
    canAccessTab(item.id, currentUser)
  );

  // Contagem de itens com estoque baixo para sinalização preventiva
  const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;

  return (
    <aside className="w-64 shrink-0 bg-zinc-950 text-zinc-300 border-r border-zinc-800 flex flex-col justify-between select-none">
      <div className="p-4 space-y-6">
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
              const isProducts = item.id === 'produtos';

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-red-600 text-white shadow-xs font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive
                          ? 'text-white'
                          : 'text-zinc-400 group-hover:text-red-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {isProducts && lowStockCount > 0 && (
                    <span
                      title={`${lowStockCount} produtos abaixo do estoque mínimo`}
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                        isActive
                          ? 'bg-white text-red-600'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {lowStockCount}
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
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40">
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
                <span>{currentUser.role}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
