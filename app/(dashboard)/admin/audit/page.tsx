/**
 * 审计日志页 —— /admin/audit
 */

'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuditLog {
  id: number;
  userId: number;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
  user: { id: number; name: string; username: string };
}

const actionLabels: Record<string, string> = {
  CREATE_ATHLETE: '创建运动员',
  UPDATE_ATHLETE: '更新运动员',
  DELETE_ATHLETE: '删除运动员',
  CREATE_TRAINING_PLAN: '创建训练计划',
  UPDATE_TRAINING_PLAN: '更新训练计划',
  DELETE_TRAINING_PLAN: '删除训练计划',
  CREATE_TRAINING_RECORD: '创建训练记录',
  CREATE_FITNESS_RECORD: '创建体能记录',
  CREATE_INJURY: '创建伤病记录',
  UPDATE_INJURY: '更新伤病记录',
  IMPORT_ATHLETES: '批量导入运动员',
  CREATE_USER: '创建用户',
  UPDATE_USER: '更新用户',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (actionFilter) params.set('action', actionFilter);
      if (typeFilter) params.set('targetType', typeFilter);

      const res = await fetch(`/api/audit?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.logs);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      }
    } catch { /* empty */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => { fetchLogs(); }, [page]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-ams-text-primary">审计日志</h2>

      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部操作</option>
            {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary">
            <option value="">全部类型</option>
            <option value="Athlete">运动员</option>
            <option value="TrainingPlan">训练计划</option>
            <option value="TrainingRecord">训练记录</option>
            <option value="FitnessRecord">体能记录</option>
            <option value="Injury">伤病记录</option>
            <option value="User">用户</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchLogs}>刷新</Button>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">暂无日志记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">时间</th>
                    <th className="px-4 py-3 text-left ams-table-header">操作人</th>
                    <th className="px-4 py-3 text-left ams-table-header">操作</th>
                    <th className="px-4 py-3 text-left ams-table-header">目标类型</th>
                    <th className="px-4 py-3 text-left ams-table-header">目标ID</th>
                    <th className="px-4 py-3 text-left ams-table-header">详情</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-ams-border/50 hover:bg-ams-surface-hover">
                      <td className="px-4 py-3 text-ams-text-secondary whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-ams-text-primary">{log.user?.name || '未知'}</td>
                      <td className="px-4 py-3 text-ams-text-secondary">
                        {actionLabels[log.action] || log.action}
                      </td>
                      <td className="px-4 py-3 text-ams-text-secondary">{log.targetType}</td>
                      <td className="px-4 py-3 text-ams-text-muted">{log.targetId || '-'}</td>
                      <td className="px-4 py-3 text-ams-text-muted max-w-[300px] truncate">
                        {log.detail || '-'}
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
