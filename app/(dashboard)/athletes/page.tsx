'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Search, UserPlus, Download, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gender, AthleteStatus } from '@/types';
import { useRef } from 'react';

interface Athlete {
  id: number;
  name: string;
  gender: Gender;
  birthDate: string;
  height: number | null;
  weight: number | null;
  sport: string;
  position: string | null;
  joinDate: string;
  status: AthleteStatus;
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '在队', color: 'text-ams-success' },
  RECOVERING: { label: '休养', color: 'text-ams-warning' },
  LEFT: { label: '离队', color: 'text-ams-text-muted' },
};

export default function AthletesPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: Array<{ row: number; name: string; reason: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/athletes/import', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        setImportResult(json.data);
        fetchAthletes();
      } else {
        setError(json.error?.message || '导入失败');
      }
    } catch {
      setError('网络错误');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportExcel = () => {
    window.location.href = '/api/athletes/export?format=excel';
  };

  const handleExportPDF = (athleteId: number) => {
    window.open(`/api/athletes/export?format=pdf&athleteId=${athleteId}`, '_blank');
  };

  const fetchAthletes = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (search) params.set('search', search);
      if (genderFilter) params.set('gender', genderFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/athletes?${params}`);
      const json = await res.json();
      if (json.success) {
        setAthletes(json.data.athletes);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      } else {
        setError(json.error || '加载失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, genderFilter, statusFilter]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该运动员吗？此操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/athletes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchAthletes();
      } else {
        alert(json.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  /**
   * 整行点击导航：点击行内任意区域（姓名链接、编辑/删除按钮除外）跳转至运动员详情页。
   * 通过 closest 判断点击目标是否为可交互元素，避免与原有链接/按钮行为冲突。
   */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;
    router.push(`/athletes/${id}`);
  };

  const handleSearch = () => {
    setPage(1);
    fetchAthletes();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ams-text-primary">运动员档案</h2>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            导入
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            导出Excel
          </Button>
          <Link href="/athletes/new">
            <Button>
              <UserPlus className="h-4 w-4" />
              新建运动员
            </Button>
          </Link>
        </div>
      </div>

      {importResult && (
        <div className="ams-card p-4 border-l-4 border-l-ams-primary">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-ams-text-primary">
                导入完成：成功 {importResult.success} 条，失败 {importResult.failed} 条
              </span>
              {importResult.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="text-xs text-ams-danger">
                      第 {err.row} 行 - {err.name}：{err.reason}
                    </div>
                  ))}
                  {importResult.errors.length > 5 && (
                    <div className="text-xs text-ams-text-muted">...还有 {importResult.errors.length - 5} 条错误</div>
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>关闭</Button>
          </div>
        </div>
      )}

      <div className="ams-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索姓名或项目..."
              className="w-64 rounded-ams bg-ams-background border border-ams-border py-2 pl-10 pr-4 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
            />
          </div>
          <select
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部性别</option>
            <option value="MALE">男</option>
            <option value="FEMALE">女</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
          >
            <option value="">全部状态</option>
            <option value="ACTIVE">在队</option>
            <option value="RECOVERING">休养</option>
            <option value="LEFT">离队</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </div>
      </div>

      <div className="ams-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
        ) : error ? (
          <div className="p-8 text-center text-ams-danger">{error}</div>
        ) : athletes.length === 0 ? (
          <div className="p-8 text-center text-ams-text-secondary">
            暂无运动员记录，点击右上角新建
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ams-border">
                    <th className="px-4 py-3 text-left ams-table-header">姓名</th>
                    <th className="px-4 py-3 text-left ams-table-header">性别</th>
                    <th className="px-4 py-3 text-left ams-table-header">出生日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">身高/体重</th>
                    <th className="px-4 py-3 text-left ams-table-header">项目</th>
                    <th className="px-4 py-3 text-left ams-table-header">入队日期</th>
                    <th className="px-4 py-3 text-left ams-table-header">状态</th>
                    <th className="px-4 py-3 text-right ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((a) => {
                    const s = statusLabels[a.status] || { label: a.status, color: 'text-ams-text-secondary' };
                    return (
                      <tr
                        key={a.id}
                        onClick={(e) => handleRowClick(e, a.id)}
                        className="cursor-pointer border-b border-ams-border/50 transition-colors duration-150 hover:bg-ams-primary/10"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/athletes/${a.id}`} className="text-ams-text-primary hover:text-ams-primary">
                            {a.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">{genderLabels[a.gender] || a.gender}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          {new Date(a.birthDate).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          {a.height ? `${a.height}cm` : '-'} / {a.weight ? `${a.weight}kg` : '-'}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">{a.sport}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          {new Date(a.joinDate).toLocaleDateString('zh-CN')}
                        </td>
                        <td className={`px-4 py-3 font-medium ${s.color}`}>{s.label}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/athletes/${a.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    上一页
                  </Button>
                  <span className="flex items-center text-sm text-ams-text-secondary px-2">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}