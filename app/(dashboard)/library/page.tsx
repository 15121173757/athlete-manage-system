'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dumbbell, Activity } from 'lucide-react';
import ExercisesView from './components/ExercisesView';
import TestsView from './components/TestsView';

function LibraryModuleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'exercises';

  const handleTabChange = (value: string) => {
    // 基于当前查询参数仅更新 tab，保留各 Tab 自身的筛选/分页状态
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'exercises', label: '练习库', icon: Dumbbell },
    { id: 'tests', label: '测试库', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ams-text-primary">动作库</h1>
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
          {activeTab === 'exercises' && <ExercisesView />}
          {activeTab === 'tests' && <TestsView />}
        </div>
      </div>
    </div>
  );
}

export default function LibraryModulePage() {
  return (
    <Suspense>
      <LibraryModuleContent />
    </Suspense>
  );
}
