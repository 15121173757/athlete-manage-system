/**
 * 伤病管理视图 —— 伤病与负荷监控模块（Tab: 伤病管理）
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, ClipboardPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Injury {
  id: number;
  athleteId: number;
  injuryType: string;
  description: string;
  startDate: string;
  endDate: string | null;
  status: string;
  athlete: { id: number; name: string };
  recoveryPlan: { id: number; content: string; status: string } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  INJURED: { label: '受伤', color: 'text-ams-danger' },
  RECOVERING: { label: '康复中', color: 'text-ams-warning' },
  RETURNED: { label: '已回归', color: 'text-ams-success' },
};

export default function InjuriesView() {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/health/injuries?${params}`);
      const json = await res.json();
      if (json.success) {
        setInjuries(json.data.injuries);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">伤病管理</h2>
        <Button><Plus className="h-4 w-4" />新增伤病记录</Button>
      </div>

      <div className="ams-card p-4">
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部状态</option>
            <option value="INJURED">受伤</option>
            <option value="RECOVERING">康复中</option>
            <option value="RETURNED">已回归</option>
          </select>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : injuries.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">暂无伤病记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">运动员</th>
                    <th className="px-4 py-3 text-left ams-table-header">伤病类型</th>
                    <th className="px-4 py-3 text-left ams-table-header">描述</th>
                    <th className="px-4 py-3 text-left ams-table-header">开始日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-left ams-table-header">康复计划</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {injuries.map((i) => {
                    const s = statusLabels[i.status] || { label: i.status, color: 'text-ams-text-secondary' };
                    return (
                      <tr key={i.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                        <td className="px-4 py-3 text-ams-text-primary">{i.athlete.name}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">{i.injuryType}</td>
                        <td className="px-4 py-3 text-ams-text-secondary max-w-[200px] truncate">{i.description}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">{new Date(i.startDate).toLocaleDateString('zh-CN')}</td>
                        <td className={`px-4 py-3 font-medium ${s.color}`}>{s.label}</td>
                        <td className="px-4 py-3">
                          {i.recoveryPlan ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs text-ams-primary">
                              <ClipboardPlus className="h-3 w-3" />已制定
                            </span>
                          ) : (
                            <span className="text-xs text-ams-text-muted">未制定</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ams-border px-4 py-3">
                <div className="text-sm text-ams-text-secondary">共 {total} 条</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
