import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthGate } from './components/AuthGate';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AccessDenied } from './components/AccessDenied';
import { ProductPhotoModal } from './components/ProductPhotoModal';
import { DashboardTab } from './components/tabs/DashboardTab';
import { ProductsTab } from './components/tabs/ProductsTab';
import { EntriesTab } from './components/tabs/EntriesTab';
import { ExitsTab } from './components/tabs/ExitsTab';
import { CollaboratorsTab } from './components/tabs/CollaboratorsTab';
import { DestinationsTab } from './components/tabs/DestinationsTab';
import { ReportsTab } from './components/tabs/ReportsTab';
import { StatisticsTab } from './components/tabs/StatisticsTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { TabId } from './types';

const VALID_TABS: TabId[] = [
  'dashboard',
  'produtos',
  'entradas',
  'saidas',
  'colaboradores',
  'destinos',
  'relatorios',
  'estatisticas',
  'configuracoes',
];

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl max-w-lg w-full p-6 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-red-700">
              Erro de Comunicação com o Banco de Dados
            </h2>
            <p className="text-xs text-zinc-600 break-words font-mono bg-zinc-50 p-3 rounded border border-zinc-200">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, canAccessTab } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // 1. Listen for hashchange events from the browser once on mount
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };

    if (window.location.hash) {
      onHashChange();
    }

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setActiveTab]);

  // 2. Synchronize URL hash when activeTab changes
  useEffect(() => {
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  const isAccessAllowed = canAccessTab(activeTab);

  const renderActiveTab = () => {
    if (!isAccessAllowed) {
      return <AccessDenied requestedTab={activeTab} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'produtos':
        return <ProductsTab />;
      case 'entradas':
        return <EntriesTab />;
      case 'saidas':
        return <ExitsTab />;
      case 'colaboradores':
        return <CollaboratorsTab />;
      case 'destinos':
        return <DestinationsTab />;
      case 'relatorios':
        return <ReportsTab />;
      case 'estatisticas':
        return <StatisticsTab />;
      case 'configuracoes':
        return <SettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col font-sans overflow-x-hidden">
      <Header onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />

      <div className="flex-1 flex min-w-0 relative">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveTab()}
        </main>
      </div>

      <ProductPhotoModal />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AuthGate>
          <MainLayout />
        </AuthGate>
      </AppProvider>
    </ErrorBoundary>
  );
}

