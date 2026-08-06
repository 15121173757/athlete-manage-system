'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Upload, X, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
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

interface ImportRow {
  athleteId: string;
  testIdentifier: string;
  value: string;
  testDate: string;
  notes: string;
  _raw: Record<string, string | number>;
}

export default function FitnessRecordsView() {
  const [records, setRecords] = useState<FitnessRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [athleteFilter, setAthleteFilter] = useState('');
  const [testFilter, setTestFilter] = useState('');
  const [athletes, setAthletes] = useState<{ id: number; name: string }[]>([]);
  const [tests, setTests] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const openImportModal = () => {
    setImportRows([]);
    setImportError('');
    setImportSuccess('');
    setShowImportModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });

      if (rawData.length === 0) {
        setImportError('Excel 文件为空，请检查文件内容');
        return;
      }

      const rows: ImportRow[] = rawData.map((row) => {
        const getVal = (keys: string[]): string => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(
              (rk) => rk.trim() === k
            );
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
              return String(row[foundKey]).trim();
            }
          }
          return '';
        };

        return {
          athleteId: getVal(['运动员ID', '运动员编号', 'athleteId', 'athlete_id']),
          testIdentifier: getVal(['测试项目ID', '测试项目名称', '测试项目', 'testId', 'testName', 'test']),
          value: getVal(['数值', '成绩', 'value']),
          testDate: getVal(['测试日期', '日期', 'testDate', 'date']),
          notes: getVal(['备注', '说明', 'notes', 'remark']),
          _raw: row,
        };
      });

      const invalidRows = rows.filter(
        (r) => !r.athleteId || !r.testIdentifier || !r.value || !r.testDate
      );

      if (invalidRows.length > 0) {
        setImportError(
          `共解析 ${rows.length} 行，其中 ${invalidRows.length} 行缺少必要字段（运动员ID、测试项目、数值、测试日期），请检查后重新导入`
        );
      }

      setImportRows(rows);
    } catch (err) {
      setImportError('解析 Excel 文件失败，请确保文件格式正确');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validRows = importRows.filter(
      (r) => r.athleteId && r.testIdentifier && r.value && r.testDate
    );

    if (validRows.length === 0) {
      setImportError('没有可导入的有效数据');
      return;
    }

    setIsImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const payload = validRows.map((r) => ({
        athleteId: r.athleteId,
        testIdentifier: r.testIdentifier,
        value: Number(r.value),
        testDate: r.testDate,
        notes: r.notes,
      }));

      const res = await fetch('/api/fitness/records/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: payload }),
      });

      const json = await res.json();

      if (json.success) {
        const imported = json.data?.imported || validRows.length;
        const failed = json.data?.failed || 0;
        setImportSuccess(
          `成功导入 ${imported} 条记录${failed > 0 ? `，${failed} 条导入失败` : ''}`
        );
        fetchRecords();
      } else {
        setImportError(json.error?.message || '导入失败，请重试');
      }
    } catch {
      setImportError('网络错误，导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportRows([]);
    setImportError('');
    setImportSuccess('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={openImportModal}>
          <Upload className="h-4 w-4" />
          Excel 批量导入
        </Button>
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

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeImportModal}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto ams-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-ams-text-primary">Excel 批量导入</h3>
              <Button variant="ghost" size="icon" onClick={closeImportModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="rounded-ams border border-ams-border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <FileSpreadsheet className="h-5 w-5 text-ams-primary" />
                  <span className="text-sm font-medium text-ams-text-primary">选择 Excel 文件</span>
                </div>
                <p className="text-xs text-ams-text-muted mb-3">
                  支持 .xlsx / .xls 格式，必需列：运动员ID、测试项目ID/名称、数值、测试日期、备注（可选）
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-ams-text-secondary file:mr-4 file:rounded-ams file:border-0 file:bg-ams-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-ams-primary hover:file:bg-ams-primary/20 cursor-pointer"
                />
              </div>

              {importError && (
                <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="rounded-ams border border-ams-success/30 bg-ams-success/10 px-4 py-3 text-sm text-ams-success flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {importRows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-ams-text-primary">
                      预览数据（共 {importRows.length} 行）
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-64 rounded-ams border border-ams-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-ams-background">
                        <tr className="border-b border-ams-border">
                          <th className="px-3 py-2 text-left ams-table-header">运动员ID</th>
                          <th className="px-3 py-2 text-left ams-table-header">测试项目</th>
                          <th className="px-3 py-2 text-left ams-table-header">数值</th>
                          <th className="px-3 py-2 text-left ams-table-header">测试日期</th>
                          <th className="px-3 py-2 text-left ams-table-header">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, idx) => {
                          const isInvalid = !row.athleteId || !row.testIdentifier || !row.value || !row.testDate;
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-ams-border/50 ${isInvalid ? 'bg-ams-danger/5' : ''}`}
                            >
                              <td className={`px-3 py-2 ${isInvalid ? 'text-ams-danger' : 'text-ams-text-secondary'}`}>
                                {row.athleteId || '-'}
                              </td>
                              <td className={`px-3 py-2 ${isInvalid ? 'text-ams-danger' : 'text-ams-text-secondary'}`}>
                                {row.testIdentifier || '-'}
                              </td>
                              <td className={`px-3 py-2 ${isInvalid ? 'text-ams-danger' : 'text-ams-text-secondary'}`}>
                                {row.value || '-'}
                              </td>
                              <td className={`px-3 py-2 ${isInvalid ? 'text-ams-danger' : 'text-ams-text-secondary'}`}>
                                {row.testDate || '-'}
                              </td>
                              <td className="px-3 py-2 text-ams-text-muted">
                                {row.notes || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-ams-border">
                <Button type="button" variant="outline" onClick={closeImportModal}>
                  取消
                </Button>
                <Button
                  type="button"
                  disabled={importRows.length === 0 || isImporting}
                  onClick={handleImport}
                >
                  {isImporting ? '导入中...' : '确认导入'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}