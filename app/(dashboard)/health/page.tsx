'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, HeartPulse } from 'lucide-react';
import LoadMonitorView from './components/LoadMonitorView';
import InjuriesView from './components/InjuriesView';

function HealthModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'load';

  const handleTabChange = (value: string) => {
    router.push(`?tab=${value}`);
  };

  const tabs = [
    { id: 'load', label: '负荷监控', icon: Activity },
    { id: 'injuries', label: '伤病管理', icon: HeartPulse },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ams-text-primary">伤病与负荷监控</h1>
          <p className="mt-1 text-sm text-ams-text-muted">
            基于 RPE 与训练时长统计训练量，自动计算急慢性负荷比（ACWR）
          </p>
        </div>
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
          {activeTab === 'load' && <LoadMonitorView />}
          {activeTab === 'injuries' && <InjuriesView />}
        </div>
      </div>
    </div>
  );
}

export default function HealthModulePage() {
  return (
    <Suspense>
      <HealthModuleContent />
    </Suspense>
  );
}
