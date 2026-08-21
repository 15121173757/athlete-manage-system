'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Search, UserPlus, Download, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gender } from '@/types';
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
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
};

export default function AthletesPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [sportOptions, setSportOptions] = useState<{ sport: string; count: number }[]>([]);
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
      if (sportFilter) params.set('sport', sportFilter);

      const res = await fetch(`/api/athletes?${params}`);
      const json = await res.json();
      if (json.success) {
        setAthletes(json.data.athletes);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
      } else {
        setError(json.error?.message || '加载失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, genderFilter, sportFilter]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  // 加载全部运动员以派生「项目」筛选选项（含各项目人数）
  useEffect(() => {
    fetch('/api/athletes?pageSize=1000')
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        const counts = new Map<string, number>();
        for (const a of (j.data.athletes || []) as Athlete[]) {
          const s = a.sport || '未登记';
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
        setSportOptions(
          [...counts.entries()]
            .map(([sport, count]) => ({ sport, count }))
            .sort((x, y) => x.sport.localeCompare(y.sport, 'zh-CN'))
        );
      })
      .catch(() => {});
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该运动员吗？此操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/athletes/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchAthletes();
      } else {
        alert(json.error?.message || '删除失败');
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

  /** 是否存在激活的筛选条件（项目 / 性别 / 搜索关键词） */
  const isFilterActive = Boolean(sportFilter || genderFilter || search);

  /** 清除全部筛选条件并回到第一页 */
  const clearFilters = () => {
    setSportFilter('');
    setGenderFilter('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
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
            value={sportFilter}
            onChange={(e) => { setSportFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
          >
            <option value="">全部项目</option>
            {sportOptions.map((s) => (
              <option key={s.sport} value={s.sport}>{s.sport}（{s.count}人）</option>
            ))}
          </select>
          <select
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setPage(1); }}
            className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
          >
            <option value="">全部性别</option>
            <option value="MALE">男</option>
            <option value="FEMALE">女</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </div>

        {/* 筛选状态：展示当前筛选条件、匹配数量，并支持清除 */}
        {isFilterActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ams-border pt-3">
            <span className="text-xs text-ams-text-muted">当前筛选：</span>
            {sportFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                项目：{sportFilter}
                <button
                  onClick={() => { setSportFilter(''); setPage(1); }}
                  className="hover:text-ams-primary/70"
                  aria-label="清除项目筛选"
                >
                  ✕
                </button>
              </span>
            )}
            {genderFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                性别：{genderLabels[genderFilter] || genderFilter}
                <button
                  onClick={() => { setGenderFilter(''); setPage(1); }}
                  className="hover:text-ams-primary/70"
                  aria-label="清除性别筛选"
                >
                  ✕
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs font-medium text-ams-primary">
                关键词：{search}
                <button
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="hover:text-ams-primary/70"
                  aria-label="清除搜索关键词"
                >
                  ✕
                </button>
              </span>
            )}
            <span className="ml-auto text-sm font-medium text-ams-text-primary">
              共匹配 {total} 名运动员
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              清除全部筛选
            </Button>
          </div>
        )}
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
                    <th className="px-3 py-3 text-left ams-table-header whitespace-nowrap">身高</th>
                    <th className="px-3 py-3 text-left ams-table-header whitespace-nowrap">体重</th>
                    <th className="px-4 py-3 text-left ams-table-header">项目</th>
                    <th className="px-4 py-3 text-left ams-table-header">入队日期</th>
                    <th className="px-4 py-3 text-center ams-table-header">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((a) => {
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
                        <td className="px-3 py-3 text-ams-text-secondary whitespace-nowrap">
                          {a.height != null ? `${a.height} cm` : '-'}
                        </td>
                        <td className="px-3 py-3 text-ams-text-secondary whitespace-nowrap">
                          {a.weight != null ? `${a.weight} kg` : '-'}
                        </td>
                        <td className="px-4 py-3 text-ams-text-secondary">{a.sport}</td>
                        <td className="px-4 py-3 text-ams-text-secondary">
                          {new Date(a.joinDate).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
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