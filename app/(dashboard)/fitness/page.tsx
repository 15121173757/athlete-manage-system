'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, ClipboardList, FileText } from 'lucide-react';
import FitnessTestsView from './components/FitnessTestsView';
import FitnessPlansView from './components/FitnessPlansView';
import FitnessRecordsView from './components/FitnessRecordsView';

function FitnessModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tests';

  const handleTabChange = (value: string) => {
    router.push(`?tab=${value}`);
  };

  const tabs = [
    { id: 'plans', label: '测试计划', icon: ClipboardList },
    { id: 'records', label: '测试记录', icon: FileText },
    { id: 'tests', label: '测试库', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ams-text-primary">体能测试管理</h1>
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
          {activeTab === 'tests' && <FitnessTestsView />}
          {activeTab === 'plans' && <FitnessPlansView />}
          {activeTab === 'records' && <FitnessRecordsView />}
        </div>
      </div>
    </div>
  );
}

export default function FitnessModulePage() {
  return (
    <Suspense>
      <FitnessModuleContent />
    </Suspense>
  );
}

