/**
 * 体能测试记录页 —— /fitness/records
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FitnessRecord {
  id: number;
  athleteId: number;
  testId: number;
  value: number;
  testDate: string;
  test: { id: number; name: string; unit: string; category: string; direction: string };
  athlete: { id: number; name: string };
}

export default function FitnessRecordsPage() {
  const [records, setRecords] = useState<FitnessRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [athleteFilter, setAthleteFilter] = useState('');
  const [testFilter, setTestFilter] = useState('');
  const [athletes, setAthletes] = useState<{ id: number; name: string }[]>([]);
  const [tests, setTests] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (athleteFilter) params.set('athleteId', athleteFilter);
      if (testFilter) params.set('testId', testFilter);

      const res = await fetch(`/api/fitness/records?${params}`);
      const json = await res.json();
      if (json.success) {
        setRecords(json.data.records);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  }, [page, athleteFilter, testFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetch('/api/athletes?pageSize=100').then(r => r.json()).then(j => {
      if (j.success) setAthletes(j.data.athletes);
    });
    fetch('/api/fitness/tests').then(r => r.json()).then(j => {
      if (j.success) setTests(j.data);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">体能测试记录</h2>
        <Button><Plus className="h-4 w-4" />录入测试</Button>
      </div>

      <div className="ams-card p-4">
        <div className="flex items-center gap-3">
          <select value={athleteFilter} onChange={(e) => { setAthleteFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部运动员</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={testFilter} onChange={(e) => { setTestFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部测试</option>
            {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">暂无体能测试记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">运动员</th>
                    <th className="px-4 py-3 text-left ams-table-header">测试项目</th>
                    <th className="px-4 py-3 text-left ams-table-header">数值</th>
                    <th className="px-4 py-3 text-left ams-table-header">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                      <td className="px-4 py-3 text-ams-text-secondary">{new Date(r.testDate).toLocaleDateString('zh-CN')}</td>
                      <td className="px-4 py-3 text-ams-text-primary">{r.athlete.name}</td>
                      <td className="px-4 py-3 text-ams-text-secondary">
                        <span className="text-xs text-ams-text-muted">{r.test.category}</span>
                        <div>{r.test.name}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-ams-primary">
                        {r.value}<span className="text-sm text-ams-text-secondary ml-1">{r.test.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.test.direction === 'HIGHER_BETTER' ? (
                          <span className="text-ams-success">越高越好</span>
                        ) : (
                          <span className="text-ams-warning">越低越好</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
                <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchRecords(); }}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(page + 1); fetchRecords(); }}>下一页</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
