import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AccessDenied } from './components/AccessDenied';
import { ProductPhotoModal } from './components/ProductPhotoModal';
import { DashboardTab } from './components/tabs/DashboardTab';
import { ProductsTab } from './components/tabs/ProductsTab';
import { EntriesTab } from './components/tabs/EntriesTab';
import { ExitsTab } from './components/tabs/ExitsTab';
import { ReportsTab } from './components/tabs/ReportsTab';
import { StatisticsTab } from './components/tabs/StatisticsTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { TabId } from './types';

const VALID_TABS: TabId[] = [
  'dashboard',
  'produtos',
  'entradas',
  'saidas',
  'relatorios',
  'estatisticas',
  'configuracoes',
];

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, canAccessTab } = useApp();

  // 1. Listen for hashchange events from the browser once on mount
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as TabId;
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };

    // If an initial hash is in the URL on first load, navigate to it
    if (window.location.hash) {
      onHashChange();
    }

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setActiveTab]);

  // 2. Synchronize URL hash when activeTab changes, without triggering a hashchange loop
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
    <div className="min-h-screen bg-zinc-100 flex flex-col font-sans">
      {/* Top Header conforming to QHS Visual Identity and Top Bar Contract */}
      <Header />

      {/* Main Workspace: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation (Filters out unauthorized tabs) */}
        <Sidebar />

        {/* Primary Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveTab()}
        </main>
      </div>

      {/* Product Zoom & Spec Modal */}
      <ProductPhotoModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
