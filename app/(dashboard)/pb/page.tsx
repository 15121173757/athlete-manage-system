'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trophy, TrendingUp } from 'lucide-react';
import PBRecordsView from './components/PBRecordsView';
import PBTrendView from './components/PBTrendView';

function PBModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'records';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'records', label: 'PB纪录', icon: Trophy },
    { id: 'trend', label: 'PB变化趋势', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ams-text-primary">PB追踪</h1>
      </div>

      <div className="space-y-6">
        {/* Tab Headers */}
        <div className="flex gap-1 p-1 bg-ams-surface border border-ams-border rounded-ams">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-ams text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-ams-primary text-white shadow-sm'
                  : 'text-ams-text-secondary hover:text-ams-text-primary hover:bg-ams-surface-hover'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'records' && <PBRecordsView />}
          {activeTab === 'trend' && <PBTrendView />}
        </div>
      </div>
    </div>
  );
}

export default function PBModulePage() {
  return (
    <Suspense>
      <PBModuleContent />
    </Suspense>
  );
}
