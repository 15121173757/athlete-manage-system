'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TrendingUp, Download, RotateCcw, X, Search, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Athlete {
  id: number;
  name: string;
}

interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: string;
  isPBTrackable: boolean;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface TrendSeries {
  exerciseId: number;
  exerciseName: string;
  unit: string;
  trackType: string;
  points: TrendPoint[];
}

/** 趋势验证告警（后端 validateTrendRecords 输出） */
interface TrendWarning {
  level: 'INFO' | 'WARNING' | 'ERROR';
  code: string;
  message: string;
  detail?: string;
}

/** 数据完整性校验报告 */
interface TrendValidation {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  invalidRecordIds: number[];
  skippedByRangeStart: number;
  sameDayMerged: number;
  warnings: TrendWarning[];
  isClean: boolean;
}

/** 趋势查询统计信息（用于数据加载状态与完整度提示） */
interface TrendStats {
  totalRecords: number;
  totalPoints: number;
  startDate: string | null;
  endDate: string | null;
  /** 数据完整性校验报告 */
  validation?: TrendValidation;
}

/** 5 条对比线配色（深色主题下鲜明可辨） */
const LINE_COLORS = ['#FF6B35', '#4DD0E1', '#FFD54F', '#81C784', '#BA68C8'];

/** 滚轮缩放参数 */
const ZOOM_STEP = 0.9; // 每次滚轮事件的缩放系数（上滚 ×0.9 放大，下滚 ÷0.9 缩小）
const MIN_VISIBLE_POINTS = 2; // 最小可视数据点数，防止过度放大导致图表失真

/** 内存缓存：以查询参数为键缓存趋势结果，重复查询直接命中 */
const trendCache = new Map<string, { series: TrendSeries[]; stats: TrendStats }>();

/** 将多个项目的时间序列合并为 recharts 所需的统一 data 数组（按日期前向填充最近一次训练值） */
function mergeSeriesToChartData(
  series: TrendSeries[],
  startDate = '',
  endDate = ''
) {
  const dateSet = new Set<string>();
  for (const s of series) {
    for (const p of s.points) dateSet.add(p.date);
  }
  // 将用户所选时间范围的起止日期纳入 X 轴，保证折线完整覆盖所选区间（区间内无数据时前向填充保持）
  if (endDate) dateSet.add(endDate);
  if (startDate) dateSet.add(startDate);
  const dates = Array.from(dateSet).sort();

  return dates.map((date) => {
    const row: Record<string, string | number> = { date };
    for (const s of series) {
      // points 已按日期升序，取 <= 当前日期的最后一个值（前向填充）
      let value: number | undefined;
      for (const p of s.points) {
        if (p.date <= date) value = p.value;
        else break;
      }
      if (value !== undefined) row[s.exerciseName] = value;
    }
    return row;
  });
}

/** 自定义时间范围滑条：完全受控，自管理 pointer/mouse 事件，替代 recharts Brush */
interface TimeRangeSliderProps {
  total: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  onReset: () => void;
}

function TimeRangeSlider({ total, start, end, onChange, onReset }: TimeRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // dragRef 保存当前拖动会话；存在即代表「正在拖动」
  const dragRef = useRef<{ mode: 'start' | 'end' | 'slide'; grabStart: number; grabIndex: number; span: number } | null>(null);

  // 用 ref 反映最新 start/end/onChange，避免闭包读到旧值
  const startRef = useRef(start);
  const endRef = useRef(end);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    startRef.current = start;
    endRef.current = end;
    onChangeRef.current = onChange;
  }, [start, end, onChange]);

  const posToIndex = (clientX: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (total - 1));
  };

  // window 级 mousemove：仅在 dragRef 存在（拖动中）时生效，读取最新 ref 值避免闭包旧值
  const onMove = (e: MouseEvent) => {
    const d = dragRef.current;
    const el = trackRef.current;
    if (!d || !el) return;
    const idx = posToIndex(e.clientX, el);
    const totalSpan = total - 1;
    let ns: number;
    let ne: number;
    if (d.mode === 'slide') {
      // 保持窗口宽度整体平移
      ns = Math.min(Math.max(d.grabStart + (idx - d.grabIndex), 0), Math.max(0, totalSpan - d.span));
      ne = ns + d.span;
    } else if (d.mode === 'start') {
      ns = Math.min(idx, endRef.current - MIN_VISIBLE_POINTS);
      ne = endRef.current;
    } else {
      ne = Math.max(idx, startRef.current + MIN_VISIBLE_POINTS);
      ns = startRef.current;
    }
    onChangeRef.current(Math.max(0, ns), Math.min(totalSpan, ne));
  };

  // 释放（含窗口外/失焦兜底）：同步清空拖动状态并解除全部监听，确保滑块必然停止
  const onStop = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onStop);
    window.removeEventListener('blur', onStop);
    document.removeEventListener('mouseleave', onStop);
  };

  const beginDrag = (mode: 'start' | 'end' | 'slide', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = trackRef.current;
    if (!el || total <= 1) return;
    dragRef.current = {
      mode,
      grabStart: startRef.current,
      grabIndex: posToIndex(e.clientX, el),
      span: endRef.current - startRef.current,
    };
    // 同步绑定监听器：立即生效，避免「快速释放来不及解绑」的时序间隙
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onStop);
    window.addEventListener('blur', onStop);
    document.addEventListener('mouseleave', onStop);
  };

  if (total <= 1) return null;

  const pct = (i: number) => (total <= 1 ? 0 : (i / (total - 1)) * 100);
  const leftPct = pct(start);
  const rightPct = pct(end);

  return (
    <div className="mt-2 select-none" title="拖拽手柄调整时间范围 · 双击复位">
      <div
        ref={trackRef}
        role="group"
        aria-label="时间范围比例尺"
        className="relative h-6 w-full cursor-pointer rounded-md bg-ams-surface/60"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
        onMouseDown={(e) => beginDrag('slide', e)}
      >
        {/* 已选时间范围高亮 */}
        <div
          className="absolute bottom-0 top-0 rounded-md bg-ams-primary/30"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />
        {/* 起始手柄 */}
        <div
          role="slider"
          aria-label="起始范围手柄"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, total - 1)}
          aria-valuenow={start}
          className="absolute top-1/2 z-10 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-ams-primary shadow-md"
          style={{ left: `${leftPct}%` }}
          onMouseDown={(e) => beginDrag('start', e)}
        />
        {/* 结束手柄 */}
        <div
          role="slider"
          aria-label="结束范围手柄"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, total - 1)}
          aria-valuenow={end}
          className="absolute top-1/2 z-10 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-ams-primary shadow-md"
          style={{ left: `${rightPct}%` }}
          onMouseDown={(e) => beginDrag('end', e)}
        />
      </div>
    </div>
  );
}

export default function PBTrendView() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const [athleteId, setAthleteId] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 训练项目选择器（方案A：搜索多选）状态
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [stats, setStats] = useState<TrendStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const chartRef = useRef<HTMLDivElement>(null);

  // 加载筛选选项
  useEffect(() => {
    fetch('/api/athletes?pageSize=100')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAthletes(j.data.athletes); })
      .catch(() => {});
    fetch('/api/exercises?pageSize=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setExercises((j.data.exercises as Exercise[]).filter((e) => e.isPBTrackable));
        }
      })
      .catch(() => {});
  }, []);

  // 触发查询：运动员 + 至少一个项目
  useEffect(() => {
    if (!athleteId || selectedIds.length === 0) {
      setSeries([]);
      setStats(null);
      return;
    }

    const key = `${athleteId}|${[...selectedIds].sort((a, b) => a - b).join(',')}|${startDate}|${endDate}`;
    const cached = trendCache.get(key);
    if (cached) {
      setSeries(cached.series);
      setStats(cached.stats);
      setError('');
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({ athleteId, exerciseIds: selectedIds.join(',') });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    fetch(`/api/pb/trend?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          throw new Error(json.error?.message || json.message || '查询失败');
        }
        const data: TrendSeries[] = json.data.series;
        const trendStats: TrendStats = {
          ...json.data.stats,
          validation: json.data.validation,
        };
        trendCache.set(key, { series: data, stats: trendStats });
        setSeries(data);
        setStats(trendStats);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载趋势数据失败');
        setSeries([]);
        setStats(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [athleteId, selectedIds, startDate, endDate]);

  const toggleExercise = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        setNotice('最多同时选择 5 个项目进行对比');
        window.setTimeout(() => setNotice(''), 2500);
        return prev;
      }
      return [...prev, id];
    });
  };

  // 按搜索关键词过滤可追踪项目
  const filteredExercises = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(term));
  }, [exercises, searchTerm]);

  // 当前已选中的项目（用于 Tag 展示）
  const selectedExercises = useMemo(
    () => exercises.filter((e) => selectedIds.includes(e.id)),
    [exercises, selectedIds]
  );

  // 点击面板外部时收起选择器
  useEffect(() => {
    if (!isPickerOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isPickerOpen]);

  const resetFilters = () => {
    setAthleteId('');
    setSelectedIds([]);
    setStartDate('');
    setEndDate('');
    setSeries([]);
    setStats(null);
    setViewWindow(null);
    setError('');
    setNotice('');
  };

  // 将用户所选时间范围起止日期纳入 X 轴，保证折线完整覆盖所选区间
  const chartData = useMemo(
    () => mergeSeriesToChartData(series, startDate, endDate),
    [series, startDate, endDate]
  );

  // ============================================================
  // 滚轮缩放：以「可视窗口」索引范围控制 X 轴 domain，实现比例尺缩放
  // ============================================================
  const [viewWindow, setViewWindow] = useState<{ start: number; end: number } | null>(null);
  const viewWindowRef = useRef<{ start: number; end: number } | null>(null);
  useEffect(() => {
    viewWindowRef.current = viewWindow;
  }, [viewWindow]);

  // 数据变化（新查询/重置）时恢复全量视图，避免旧窗口越界
  const chartDataKey = chartData.length > 0
    ? `${chartData.length}|${chartData[0].date}|${chartData[chartData.length - 1].date}`
    : '';
  useEffect(() => {
    setViewWindow(null);
  }, [chartDataKey]);

  // 当前可视窗口的数据（用于导出与 Brush 展示）
  const visibleWindow = useMemo(() => {
    if (!viewWindow || chartData.length === 0) return { start: 0, end: chartData.length - 1 };
    const start = Math.max(0, Math.min(viewWindow.start, chartData.length - 1));
    const end = Math.max(start, Math.min(viewWindow.end, chartData.length - 1));
    return { start, end };
  }, [viewWindow, chartData.length]);

  // 当前比例尺（100% = 完整范围，>100% 表示放大）
  const zoomPercent = useMemo(() => {
    if (chartData.length <= 1) return 100;
    const visible = visibleWindow.end - visibleWindow.start + 1;
    return Math.max(100, Math.round((chartData.length / visible) * 100));
  }, [chartData.length, visibleWindow]);

  // 滚轮缩放事件（原生监听 + passive:false，保证可 preventDefault，兼容主流浏览器）
  useEffect(() => {
    const el = chartRef.current;
    if (!el || chartData.length < 2) return;
    const total = chartData.length;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = viewWindowRef.current ?? { start: 0, end: total - 1 };
      let span = cur.end - cur.start + 1;
      // 上滚放大（窗口变窄）、下滚缩小（窗口变宽）
      // 用 floor/ceil 保证每次滚轮都能改变窗口（round 在 5 点等小数据量下会自锁）
      span = e.deltaY < 0
        ? Math.floor(span * ZOOM_STEP)
        : Math.ceil(span / ZOOM_STEP);
      // 比例尺上下限：最小 2 个数据点，最大完整范围
      span = Math.min(Math.max(span, MIN_VISIBLE_POINTS), total);
      if (span === total) {
        setViewWindow(null);
        return;
      }
      // 以当前窗口中心为锚点缩放
      const mid = (cur.start + cur.end) / 2;
      const start = Math.max(0, Math.min(Math.round(mid - (span - 1) / 2), total - span));
      setViewWindow({ start, end: start + span - 1 });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [chartData.length, isLoading]);

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of series) map.set(s.exerciseName, s.unit);
    return map;
  }, [series]);

  const handleExportPNG = useCallback(() => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 320;
    const scale = 2;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 深色背景，与页面图表容器保持一致
    ctx.fillStyle = '#0A1929';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const svgText = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(svgText)));
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      const athleteName = athletes.find((a) => a.id === parseInt(athleteId))?.name || '运动员';
      link.download = `PB变化趋势_${athleteName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${svg64}`;
  }, [athleteId, athletes]);

  const seriesNames = series.map((s) => s.exerciseName);

  return (
    <div className="space-y-4">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-ams-primary" />
          <div>
            <h2 className="text-xl font-semibold text-ams-text-primary">PB 变化趋势</h2>
            <p className="text-xs text-ams-text-muted">按运动员与项目维度查看各次训练成绩随时间的波动趋势</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPNG} disabled={series.length === 0}>
          <Download className="h-4 w-4" />
          导出 PNG
        </Button>
      </div>

      {/* 筛选控制面板 */}
      <div className="ams-card p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-ams-text-muted">运动员 *</label>
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">请选择运动员</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ams-text-muted">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ams-text-muted">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
          </div>
        </div>

        {/* 项目多选（搜索 + 下拉面板，最多 5 个） */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs text-ams-text-muted">
              训练项目（可多选，最多 5 个）
            </label>
            <span className="text-xs text-ams-text-secondary">
              已选 <span className="font-medium text-ams-primary">{selectedIds.length}</span>/5
            </span>
          </div>

          <div ref={pickerRef} className="relative">
            {/* 触发器：展示已选 Tag + 展开按钮 */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsPickerOpen((v) => !v);
                setSearchTerm('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsPickerOpen((v) => !v);
                  setSearchTerm('');
                }
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-ams border border-ams-border bg-ams-background px-3 py-2 text-sm text-ams-text-primary transition-colors hover:border-ams-primary/50"
            >
              <span className="flex flex-wrap items-center gap-1.5">
                {selectedExercises.length === 0 ? (
                  <span className="text-ams-text-muted">点击选择训练项目（支持搜索）</span>
                ) : (
                  selectedExercises.map((e) => (
                    <span
                      key={e.id}
                      className="inline-flex items-center gap-1 rounded-full border border-ams-primary/40 bg-ams-primary/15 px-2 py-0.5 text-xs text-ams-primary"
                    >
                      {e.name}
                      <span className="opacity-60">({e.unit})</span>
                      <button
                        type="button"
                        aria-label={`移除 ${e.name}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          toggleExercise(e.id);
                        }}
                        className="hover:text-ams-text-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ams-text-secondary transition-transform ${isPickerOpen ? 'rotate-180' : ''}`}
              />
            </div>

            {/* 展开面板：搜索框 + 过滤列表 */}
            {isPickerOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-ams border border-ams-border bg-ams-background shadow-lg">
                <div className="border-b border-ams-border p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="搜索训练项目（如：蹲、跑、跳）"
                      autoFocus
                      className="w-full rounded-ams border border-ams-border bg-ams-background py-1.5 pl-8 pr-3 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto p-2">
                  {filteredExercises.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-ams-text-muted">未找到匹配的训练项目</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {filteredExercises.map((e) => {
                        const active = selectedIds.includes(e.id);
                        const atLimit = !active && selectedIds.length >= 5;
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => toggleExercise(e.id)}
                            className={`flex items-center justify-between gap-2 rounded-ams border px-2.5 py-1.5 text-left text-xs transition-colors ${
                              active
                                ? 'border-ams-primary bg-ams-primary/15 text-ams-primary'
                                : atLimit
                                  ? 'border-ams-border bg-ams-background text-ams-text-muted opacity-60'
                                  : 'border-ams-border bg-ams-background text-ams-text-secondary hover:border-ams-primary/50 hover:text-ams-text-primary'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate">{e.name}</span>
                              <span className="shrink-0 opacity-60">({e.unit})</span>
                            </span>
                            <span className="shrink-0">
                              {active ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <span className="text-[10px] text-ams-text-muted">{e.category}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-ams-border px-3 py-1.5">
                  <span className="text-[11px] text-ams-text-muted">
                    {filteredExercises.length > 0
                      ? `共 ${filteredExercises.length} 个匹配项目 · 已选 ${selectedIds.length}/5`
                      : '无匹配项目'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="text-[11px] font-medium text-ams-primary hover:underline"
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {notice && (
          <div className="mt-3 rounded-ams border border-ams-warning/40 bg-ams-warning/10 px-3 py-2 text-sm text-ams-warning">
            {notice}
          </div>
        )}
      </div>

      {/* 图表区 */}
      <div className="ams-card p-4">
        {/* 数据完整性校验告警（无效记录 / 自动修复等） */}
        {stats?.validation && stats.validation.warnings.length > 0 && (
          <div className="mb-3 space-y-1.5 rounded-ams border border-ams-warning/40 bg-ams-warning/10 px-3 py-2.5">
            <p className="text-xs font-medium text-ams-warning">数据校验提示</p>
            {stats.validation.warnings.map((w, i) => (
              <p key={`${w.code}-${i}`} className="text-xs text-ams-warning/90">
                {w.level === 'WARNING' ? '⚠ ' : ''}
                {w.message}
                {w.detail && <span className="block pl-3 text-ams-text-muted">{w.detail}</span>}
              </p>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-ams-text-secondary">
            <p>正在加载所选时间范围的趋势数据...</p>
            <p className="mt-1 text-xs text-ams-text-muted">正在加载各项目训练成绩数据</p>
          </div>
        ) : error ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-ams-danger">
            <p className="font-medium">加载失败</p>
            <p className="mt-1 text-sm text-ams-text-secondary">{error}</p>
          </div>
        ) : !athleteId || selectedIds.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-ams-text-secondary">
            <TrendingUp className="mb-2 h-8 w-8 text-ams-text-secondary opacity-40" />
            请先选择运动员和至少一个训练项目
          </div>
        ) : series.length === 0 || chartData.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center text-ams-text-secondary">
            <TrendingUp className="mb-2 h-8 w-8 text-ams-text-secondary opacity-40" />
            <p>所选时间范围内暂无该运动员的 PB 变化数据</p>
            {stats && (
              <p className="mt-2 text-xs text-ams-text-muted">
                已查询 {stats.startDate || '最早'} 至 {stats.endDate || '最新'}，在该范围内未找到可追踪的训练记录
              </p>
            )}
          </div>
        ) : (
          <div
            ref={chartRef}
            className="relative h-[360px] w-full"
            onDoubleClick={() => setViewWindow(null)}
            title="滚轮缩放 · 双击复位"
          >
            {/* 比例尺缩放视觉反馈 */}
            {chartData.length > 1 && (
              <div className="pointer-events-none absolute right-2 top-1 z-10 flex items-center gap-2 rounded-ams border border-ams-primary/30 bg-ams-background/90 px-2.5 py-1 text-[11px] backdrop-blur-sm">
                <span className="font-medium text-ams-primary">缩放 {zoomPercent}%</span>
                <span className="text-ams-text-muted">滚轮缩放 · 双击复位</span>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#E6EDF3', fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  stroke="#1E3A5F"
                  domain={[visibleWindow.start, visibleWindow.end]}
                />
                <YAxis
                  tick={{ fill: '#E6EDF3', fontSize: 11 }}
                  stroke="#1E3A5F"
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#132F4C',
                    border: '1px solid #1E3A5F',
                    borderRadius: 8,
                    color: '#E6EDF3',
                  }}
                  labelStyle={{ color: '#E6EDF3' }}
                  labelFormatter={(label) => `日期：${label}`}
                  formatter={(value: number | string, name: string | number) => {
                    const n = String(name);
                    const unit = unitMap.get(n) || '';
                    return [`${value} ${unit}`, n];
                  }}
                />
                <Legend wrapperStyle={{ color: '#E6EDF3', fontSize: 12 }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.exerciseId}
                    type="monotone"
                    dataKey={s.exerciseName}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS[idx % LINE_COLORS.length], strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length > 1 && (
          <TimeRangeSlider
            total={chartData.length}
            start={visibleWindow.start}
            end={visibleWindow.end}
            onChange={(s, e) => setViewWindow({ start: s, end: e })}
            onReset={() => setViewWindow(null)}
          />
        )}

        {series.length > 0 && (
          <div className="mt-2 space-y-1 text-xs">
            {stats && (
              <p className="text-ams-text-secondary">
                数据加载状态：所选时间范围（{stats.startDate || '不限'} 至 {stats.endDate || '不限'}）内共统计到{' '}
                <span className="font-medium text-ams-primary">{stats.totalRecords}</span> 条训练记录、
                <span className="font-medium text-ams-primary">{stats.totalPoints}</span> 个数据点
                {stats.totalRecords === 0 && '，范围内可能不存在可追踪的训练记录'}
              </p>
            )}
            <p className="text-ams-text-muted">
              说明：折线表示该运动员在各项目上每次训练的实际成绩（同日多次训练取当日最佳），反映成绩随时间的波动；在图表区域滚动鼠标滚轮可放大/缩小坐标轴比例尺（上滚放大、下滚缩小），拖拽底部滑块可平移/缩放时间窗口，双击图表可复位比例尺，悬停数据点查看具体数值与日期。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
