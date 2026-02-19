import { useState } from 'react';
import { PalletPanel } from '../panels/PalletPanel';
import { CargoPanel } from '../panels/CargoPanel';
import { MaterialPanel } from '../panels/MaterialPanel';
import { DatabasePanel } from '../panels/DatabasePanel';
import type { SidebarTab } from '../../types';

const TABS: { id: SidebarTab; label: string; icon: string }[] = [
  { id: 'pallet', label: 'Pallet', icon: '📦' },
  { id: 'cargo', label: 'Cargo', icon: '📋' },
  { id: 'material', label: 'Material', icon: '🔧' },
  { id: 'database', label: 'DB', icon: '💾' },
];

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('pallet');

  return (
    <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
      {/* Tab buttons */}
      <div className="flex border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-750'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'pallet' && <PalletPanel />}
        {activeTab === 'cargo' && <CargoPanel />}
        {activeTab === 'material' && <MaterialPanel />}
        {activeTab === 'database' && <DatabasePanel />}
      </div>
    </div>
  );
}
