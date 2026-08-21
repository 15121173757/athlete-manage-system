'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Dumbbell,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Trophy,
  Check,
  X,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  computeTSA,
  scoreLevel,
  AbilityScoreItem,
} from '@/lib/modules/fitness/abilityAnalysis';
import { FITNESS_TEST_CATEGORIES } from '@/lib/fitness/test-types';

interface AthleteOption {
  id: number;
  name: string;
  sport: string;
}

interface NormOption {
  normName: string;
  mean: number;
  stdDev: number;
}

interface AbilityItem {
  testId: number;
  name: string;
  unit: string;
  direction: string;
  value: number;
  rawValue: string;
  norms: NormOption[] | null;
}

interface CategoryGroup {
  category: string;
  items: AbilityItem[];
}

const directionLabels: Record<string, string> = {
  HIGHER_BETTER: '越高越好',
  LOWER_BETTER: '越低越好',
};

// 多运动员对比的差异化颜色（与 Legend/TSA 卡/明细共用同一索引）
const ATHLETE_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
const MAX_ATHLETES = 5;

const inputClass =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary appearance-none';

export default function AbilityAnalysisPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [athleteError, setAthleteError] = useState('');

  const [sport, setSport] = useState('');
  const [athleteIds, setAthleteIds] = useState<number[]>([]);

  // 每名运动员各自的分析数据（测试成绩分组）
  const [dataByAthlete, setDataByAthlete] = useState<Record<number, CategoryGroup[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  // 已选素质类别（默认全选公共类别）
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // 用户取消勾选的测试
  const [excludedTests, setExcludedTests] = useState<Set<number>>(new Set());
  // 每个测试选定的常模下标（所有运动员共用同一常模口径，保证对比公平）
  const [normByTest, setNormByTest] = useState<Record<number, number>>({});

  // ==================== 队伍/运动员 ====================
  useEffect(() => {
    let cancelled = false;
    fetch('/api/athletes?pageSize=500')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success && Array.isArray(j.data?.athletes)) {
          setAthletes(
            j.data.athletes.map((a: { id: number; name: string; sport: string }) => ({
              id: a.id,
              name: a.name,
              sport: a.sport,
            }))
          );
        } else {
          setAthleteError('运动员列表加载失败');
        }
      })
      .catch(() => {
        if (!cancelled) setAthleteError('运动员列表加载失败，请检查网络');
      })
      .finally(() => {
        if (!cancelled) setLoadingAthletes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sports = useMemo(() => {
    const set = new Set(athletes.map((a) => a.sport).filter(Boolean));
    return [...set].sort();
  }, [athletes]);

  const filteredAthletes = useMemo(
    () => (sport ? athletes.filter((a) => a.sport === sport) : athletes),
    [athletes, sport]
  );

  const selectedAthletes = useMemo(
    () => athleteIds.map((id) => athletes.find((a) => a.id === id)).filter((a): a is AthleteOption => Boolean(a)),
    [athletes, athleteIds]
  );

  // ==================== 分析数据（多运动员并行加载） ====================
  useEffect(() => {
    if (athleteIds.length === 0) {
      // 函数式更新：仅当存在残留数据时重置；值不变时返回原引用，React 会跳过重渲染，
      // 避免每次 effect 都创建新对象引用导致依赖循环（Maximum update depth）
      setDataByAthlete((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setSelectedCategories((prev) => (prev.length > 0 ? [] : prev));
      setExcludedTests((prev) => (prev.size > 0 ? new Set() : prev));
      setNormByTest((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      setLoadingData(false);
      return;
    }
    const missing = athleteIds.filter((id) => !dataByAthlete[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    setLoadingData(true);
    setDataError('');
    Promise.all(
      missing.map((id) =>
        fetch(`/api/fitness/analysis/results?athleteId=${id}`)
          .then((r) => r.json())
          .then((j) => ({ id, j }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        setDataByAthlete((prev) => {
          const next = { ...prev };
          for (const { id, j } of results) {
            if (j.success) next[id] = Array.isArray(j.data?.groups) ? j.data.groups : [];
          }
          return next;
        });
        const failed = results.filter((r) => !r.j.success).length;
        if (failed > 0) setDataError(`有 ${failed} 名运动员的分析数据加载失败`);
      })
      .catch(() => {
        if (!cancelled) setDataError('分析数据加载失败，请检查网络');
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteIds, dataByAthlete]);

  const handleSportChange = (value: string) => {
    setSport(value);
    setAthleteIds([]);
    setDataByAthlete({});
    setSelectedCategories([]);
    setExcludedTests(new Set());
    setNormByTest({});
  };

  const toggleAthlete = (id: number) => {
    setAthleteIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ATHLETES) return prev;
      return [...prev, id];
    });
  };

  const selectAllInSport = () => {
    setAthleteIds((prev) => {
      const next = [...prev];
      for (const a of filteredAthletes) {
        if (next.length >= MAX_ATHLETES) break;
        if (!next.includes(a.id)) next.push(a.id);
      }
      return next;
    });
  };

  const clearAthletes = () => {
    setAthleteIds([]);
  };

  // ==================== 交集测试与维度 ====================
  // 每名运动员的成绩映射：athleteId -> testId -> {value, rawValue}
  const scoreByAthlete = useMemo(() => {
    const map: Record<number, Record<number, { value: number; rawValue: string }>> = {};
    for (const [id, groups] of Object.entries(dataByAthlete)) {
      map[Number(id)] = {};
      for (const grp of groups) {
        for (const it of grp.items) {
          map[Number(id)][it.testId] = { value: it.value, rawValue: it.rawValue };
        }
      }
    }
    return map;
  }, [dataByAthlete]);

  // 公共测试：所有已加载运动员共有的测试（交集），常模以任一运动员的配置为准
  const publicGroups = useMemo<CategoryGroup[]>(() => {
    if (athleteIds.length === 0) return [];
    if (athleteIds.some((id) => !dataByAthlete[id])) return [];
    const result: CategoryGroup[] = [];
    for (const grp of dataByAthlete[athleteIds[0]] ?? []) {
      const items: AbilityItem[] = [];
      for (const it of grp.items) {
        const allHave = athleteIds.every((id) => Boolean(scoreByAthlete[id]?.[it.testId]));
        if (allHave) items.push(it);
      }
      if (items.length > 0) result.push({ category: grp.category, items });
    }
    return result;
  }, [athleteIds, dataByAthlete, scoreByAthlete]);

  const publicCategories = useMemo(() => publicGroups.map((g) => g.category), [publicGroups]);

  // 默认全选公共类别
  useEffect(() => {
    if (publicCategories.length > 0 && selectedCategories.length === 0) {
      setSelectedCategories(publicCategories);
    }
  }, [publicCategories, selectedCategories]);

  const publicTestCount = useMemo(() => publicGroups.reduce((s, g) => s + g.items.length, 0), [publicGroups]);

  // ==================== 计算（每名运动员独立 computeTSA） ====================
  const buildItemsFor = useCallback(
    (athleteId: number): { items: AbilityScoreItem[]; skipped: { name: string; reason: string }[] } => {
      const items: AbilityScoreItem[] = [];
      const skipped: { name: string; reason: string }[] = [];
      for (const grp of publicGroups) {
        if (!selectedCategories.includes(grp.category)) continue;
        for (const it of grp.items) {
          if (excludedTests.has(it.testId)) continue;
          const normList = it.norms ?? [];
          const norm = normList[normByTest[it.testId] ?? 0];
          const score = scoreByAthlete[athleteId]?.[it.testId];
          if (!norm) {
            skipped.push({ name: it.name, reason: '该测试暂无常模配置' });
            continue;
          }
          if (!score) {
            skipped.push({ name: it.name, reason: '该运动员暂无成绩' });
            continue;
          }
          items.push({
            testId: it.testId,
            testName: it.name,
            category: grp.category,
            unit: it.unit,
            direction: it.direction,
            value: score.value,
            norm,
          });
        }
      }
      return { items, skipped };
    },
    [publicGroups, selectedCategories, excludedTests, normByTest, scoreByAthlete]
  );

  // 每名运动员：TSA + 维度分 + 明细
  const series = useMemo(() => {
    return athleteIds.map((id, i) => {
      const athlete = athletes.find((a) => a.id === id);
      const { items, skipped } = buildItemsFor(id);
      const out = computeTSA(items);
      const byCat = new Map(out.dimensions.map((d) => [d.category, d.score]));
      return {
        id,
        name: athlete?.name ?? `运动员${id}`,
        color: ATHLETE_COLORS[i % ATHLETE_COLORS.length],
        tsa: out.tsa,
        tsaPercentile: out.percentile,
        detail: out.dimensions,
        skipped,
        radar: publicCategories.map((c) => ({
          category: c,
          score: byCat.has(c) ? (byCat.get(c) as number) : null,
        })),
      };
    });
  }, [athleteIds, athletes, publicCategories, buildItemsFor]);

  const skippedSummary = useMemo(() => {
    const map = new Map<string, { name: string; reason: string }[]>();
    for (const s of series) {
      if (s.skipped.length > 0) map.set(s.name, s.skipped);
    }
    return [...map.entries()];
  }, [series]);

  // 雷达图数据：行 = 维度，列 = 各运动员
  const radarData = useMemo(() => {
    return publicCategories.map((c) => {
      const row: Record<string, string | number | null> = { category: c };
      for (const s of series) {
        row[s.name] = s.radar.find((r) => r.category === c)?.score ?? null;
      }
      return row;
    });
  }, [publicCategories, series]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleTest = (testId: number) => {
    setExcludedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  };

  const handleBack = () => {
    router.replace('/fitness-test');
  };

  const allLoaded = athleteIds.length > 0 && athleteIds.every((id) => Boolean(dataByAthlete[id]));
  const hasData = allLoaded && publicGroups.length > 0;
  const hasSelection = series.some((s) => s.detail.length > 0);

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            aria-label="返回上一级"
            title="返回上一级"
            className="inline-flex items-center gap-1.5 rounded-ams px-2.5 py-1.5 text-sm font-medium text-ams-text-secondary transition-all duration-150 hover:scale-[1.04] hover:bg-ams-surface-hover hover:text-ams-text-primary active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ams-text-primary">运动能力分析</h1>
            <p className="text-xs text-ams-text-muted">基于测试成绩与常模计算 Z 分数与综合评分（TSA），支持多人对比</p>
          </div>
        </div>
      </div>

      {/* 第一步：队伍与运动员（多选） */}
      <div className="ams-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ams-text-primary">1. 选择运动员</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ams-text-muted">运动项目（队伍）</label>
            <div className="relative">
              <select
                value={sport}
                onChange={(e) => handleSportChange(e.target.value)}
                className={`${inputClass} pr-8`}
              >
                <option value="">全部项目</option>
                {sports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ams-text-muted">
              运动员（可多选，最多 {MAX_ATHLETES} 人，取公共测试对比）
            </label>
            {sport ? (
              <>
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-ams border border-ams-border p-2 pr-1">
                  {filteredAthletes.map((a) => {
                    const checked = athleteIds.includes(a.id);
                    const disabled = !checked && athleteIds.length >= MAX_ATHLETES;
                    return (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-ams px-2.5 py-1.5 text-sm transition-colors ${
                          checked
                            ? 'bg-ams-primary/10 text-ams-primary'
                            : 'text-ams-text-secondary hover:bg-ams-surface-hover'
                        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleAthlete(a.id)}
                          className="h-4 w-4 shrink-0 accent-ams-primary"
                        />
                        <span className="truncate">{a.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllInSport}
                      className="text-xs text-ams-primary hover:underline"
                    >
                      全选当前项目（前 {MAX_ATHLETES} 人）
                    </button>
                    <button onClick={clearAthletes} className="text-xs text-ams-text-muted hover:underline">
                      清空
                    </button>
                  </div>
                  <span className="text-xs text-ams-text-muted">已选 {athleteIds.length} 人</span>
                </div>
                {athleteIds.length >= MAX_ATHLETES && (
                  <p className="mt-1 text-xs text-ams-warning">已达上限，最多同时对比 {MAX_ATHLETES} 名运动员</p>
                )}
              </>
            ) : (
              <p className="rounded-ams border border-ams-border/60 px-3 py-4 text-xs text-ams-text-muted">
                请先选择运动项目以加载运动员列表
              </p>
            )}
          </div>
        </div>
        {loadingAthletes ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-ams-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载运动员列表...
          </div>
        ) : athleteError ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-ams-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {athleteError}
          </div>
        ) : null}
      </div>

      {/* 第二步：素质维度（静态定位，位于第一步下方，不随页面滚动移动；未选运动员时全灰，选后动态高亮） */}
      <div className="ams-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ams-text-primary">2. 选择素质维度</h2>
        {selectedAthletes.length === 0 ? (
          <p className="mb-3 text-xs text-ams-text-muted">
            请先在上方选择运动员，系统将根据所选运动员的实际数据自动高亮可分析的素质维度（当前为灰度不可选状态）
          </p>
        ) : (
          <p className="mb-3 text-xs text-ams-text-muted">
            已根据 {selectedAthletes.length} 名运动员的公共测试数据高亮可分析维度（
            {selectedAthletes.map((a) => a.name).join('、')}），可多选
          </p>
        )}
        {loadingData ? (
          <div className="flex items-center gap-2 py-4 text-sm text-ams-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载分析数据...
          </div>
        ) : dataError ? (
          <div className="flex items-center gap-2 py-4 text-sm text-ams-danger">
            <AlertTriangle className="h-4 w-4" /> {dataError}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {FITNESS_TEST_CATEGORIES.map((cat) => {
                const isPublic = publicCategories.includes(cat);
                const active = selectedCategories.includes(cat);
                const enabled = hasData && isPublic;
                const itemCount = publicGroups.find((g) => g.category === cat)?.items.length;
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={!enabled}
                    onClick={() => enabled && toggleCategory(cat)}
                    title={enabled ? undefined : '选择运动员后可按实际数据选择'}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      !enabled
                        ? 'cursor-not-allowed border-ams-border/60 text-ams-text-muted opacity-45 grayscale'
                        : active
                          ? 'border-ams-primary bg-ams-primary/10 text-ams-primary'
                          : 'border-ams-border text-ams-text-secondary hover:border-ams-primary/50 hover:text-ams-text-primary'
                    }`}
                  >
                    {active ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : enabled ? (
                      <X className="h-3.5 w-3.5" />
                    ) : null}
                    {cat}
                    {isPublic ? <span className="text-xs opacity-70">{itemCount}项</span> : null}
                  </button>
                );
              })}
            </div>
            {!hasData && selectedAthletes.length > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1 rounded-ams border border-ams-border/60 px-4 py-5 text-center">
                <Users className="h-7 w-7 text-ams-text-muted" />
                <div className="text-sm text-ams-text-secondary">所选运动员暂无公共测试成绩</div>
                <div className="text-xs text-ams-text-muted">
                  请先通过「测试成绩录入」为已执行的测试计划录入成绩
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 第三步：测试与常模选择 */}
      {selectedAthletes.length > 0 && hasData && selectedCategories.length > 0 && (
        <div className="ams-card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ams-text-primary">3. 选择测试与常模</h2>
          <p className="mb-3 text-xs text-ams-text-muted">
            测试为公共测试（所有对比运动员均有成绩），常模口径统一（所有运动员共用，保证对比公平）
          </p>
          <div className="space-y-4">
            {publicGroups
              .filter((grp) => selectedCategories.includes(grp.category))
              .map((grp) => (
                <div key={grp.category} className="rounded-ams border border-ams-border/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-ams-primary" />
                    <span className="text-sm font-medium text-ams-text-primary">{grp.category}</span>
                  </div>
                  <div className="divide-y divide-ams-border/40">
                    {grp.items.map((it) => {
                      const excluded = excludedTests.has(it.testId);
                      const norms = it.norms ?? [];
                      const normIdx = normByTest[it.testId] ?? 0;
                      return (
                        <div key={it.testId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={!excluded}
                              onChange={() => toggleTest(it.testId)}
                              className="h-4 w-4 shrink-0 accent-ams-primary"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-ams-text-primary">{it.name}</span>
                              <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                                {selectedAthletes.map((a, i) => {
                                  const score = scoreByAthlete[a.id]?.[it.testId];
                                  return (
                                    <span
                                      key={a.id}
                                      className="inline-flex items-center gap-1"
                                      style={{ color: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }}
                                    >
                                      <span
                                        className="inline-block h-1.5 w-1.5 rounded-full"
                                        style={{ background: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }}
                                      />
                                      {a.name} {score ? `${score.rawValue} ${it.unit}` : '—'} ·{' '}
                                      {directionLabels[it.direction] || it.direction}
                                    </span>
                                  );
                                })}
                              </span>
                            </span>
                          </label>
                          <div className="flex items-center gap-2 pl-7 sm:pl-0">
                            {norms.length > 0 ? (
                              <>
                                <span className="shrink-0 text-xs text-ams-text-muted">常模</span>
                                <select
                                  value={normIdx}
                                  disabled={excluded}
                                  onChange={(e) =>
                                    setNormByTest((prev) => ({
                                      ...prev,
                                      [it.testId]: Number(e.target.value),
                                    }))
                                  }
                                  className="w-full rounded-ams bg-ams-background border border-ams-border px-2 py-1.5 text-xs text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary disabled:opacity-50 sm:w-auto"
                                >
                                  {norms.map((n, i) => (
                                    <option key={`${n.normName}-${i}`} value={i}>
                                      {n.normName}（均值 {n.mean}，σ {n.stdDev}）
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-ams-warning">
                                <AlertTriangle className="h-3.5 w-3.5" /> 暂无常模
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {skippedSummary.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-ams-warning">
              {skippedSummary.map(([name, list]) => (
                <div key={name} className="flex flex-wrap items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="font-medium">{name}：</span>
                  {list.map((s) => (
                    <span key={s.name}>
                      {s.name}（{s.reason}）
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 结果：TSA 对比 + 多系列雷达图 + 明细分块 */}
      {hasSelection && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* TSA 对比 */}
            <div className="ams-card p-6">
              <div className="flex items-center gap-2 text-sm text-ams-text-muted">
                <Trophy className="h-4 w-4 text-ams-primary" />
                运动能力综合评分（TSA）
              </div>
              <div className="mt-3 space-y-3">
                {series.map((s) => {
                  const level = s.tsa !== null ? scoreLevel(s.tsa) : null;
                  return (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span className="w-20 truncate text-sm text-ams-text-secondary">{s.name}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-2xl font-bold" style={{ color: s.color }}>
                            {s.tsa ?? '—'}
                          </span>
                          {level && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                level.color === 'text-ams-success'
                                  ? 'bg-ams-success/10'
                                  : level.color === 'text-ams-primary'
                                    ? 'bg-ams-primary/10'
                                    : level.color === 'text-ams-warning'
                                      ? 'bg-ams-warning/10'
                                      : 'bg-ams-danger/10'
                              } ${level.color}`}
                            >
                              {level.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ams-text-muted">
                          百分等级{' '}
                          {s.tsaPercentile != null ? `${s.tsaPercentile}%` : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-xs text-ams-text-muted">
                基于 {publicCategories.length} 个维度 · 公共测试 {publicTestCount} 项
              </div>
            </div>

            {/* 雷达图 */}
            <div className="ams-card p-4 lg:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-ams-text-primary">素质维度雷达图（多人对比）</h2>
              {radarData.length >= 3 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fill: '#8CA3B8', fontSize: 12 }} />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: '#8CA3B8', fontSize: 10 }}
                        tickCount={6}
                      />
                      {series.map((s) => (
                        <Radar
                          key={s.id}
                          name={s.name}
                          dataKey={s.name}
                          stroke={s.color}
                          fill={s.color}
                          fillOpacity={0.16}
                          strokeWidth={2}
                          dot={{ r: 3, fill: s.color, strokeWidth: 1 }}
                          isAnimationActive={false}
                        />
                      ))}
                      <Legend
                        content={({ payload }) => (
                          <ul className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs text-ams-text-secondary">
                            {payload?.map((p, i) => (
                              <li key={String(p.value)} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ background: ATHLETE_COLORS[i % ATHLETE_COLORS.length] }}
                                />
                                {String(p.value)}
                              </li>
                            ))}
                          </ul>
                        )}
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          value == null || value === '' ? '无数据' : `${value} 分`,
                          name,
                        ]}
                        labelFormatter={(label) => `${label}`}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center text-center">
                  <BarChart3 className="mb-2 h-8 w-8 text-ams-text-muted" />
                  <div className="text-sm text-ams-text-secondary">
                    当前仅选择 {radarData.length} 个维度，雷达图至少需要 3 个维度
                  </div>
                  <div className="mt-1 text-xs text-ams-text-muted">
                    已选维度得分：
                    {series
                      .map((s) => `${s.name} ${s.radar.map((r) => `${r.category} ${r.score ?? '—'} 分`).join('，')}`)
                      .join('；') || '无'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 计算明细（按运动员分块） */}
          <div className="space-y-4">
            {series.map((s) => (
              <div key={s.id} className="ams-card overflow-hidden">
                <h2 className="flex items-center gap-2 border-b border-ams-border/50 px-5 py-3 text-sm font-semibold text-ams-text-primary">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />
                  {s.name} 计算明细
                  <span className="ml-auto text-xs font-normal text-ams-text-muted">
                    TSA：<span className="font-medium" style={{ color: s.color }}>{s.tsa ?? '—'}</span>
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-ams-surface text-xs text-ams-text-muted">
                      <tr>
                        <th className="px-4 py-2 font-medium">素质维度</th>
                        <th className="px-4 py-2 font-medium">测试项目</th>
                        <th className="px-4 py-2 font-medium">成绩</th>
                        <th className="px-4 py-2 font-medium">常模</th>
                        <th className="px-4 py-2 font-medium">均值</th>
                        <th className="px-4 py-2 font-medium">标准差</th>
                        <th className="px-4 py-2 font-medium">Z 分数</th>
                        <th className="px-4 py-2 font-medium">百分位数</th>
                        <th className="px-4 py-2 font-medium">标准分（T）</th>
                        <th className="px-4 py-2 font-medium">维度得分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ams-border/40">
                      {s.detail.map((dim) =>
                        dim.items.map((item, idx) => (
                          <tr key={`${item.testId}-${idx}`} className="text-ams-text-secondary">
                            {idx === 0 ? (
                              <td rowSpan={dim.items.length} className="px-4 py-2.5 font-medium text-ams-text-primary">
                                {dim.category}
                                <div className="text-xs text-ams-text-muted">
                                  {dim.score} 分 / {dim.itemCount} 项 · 百分等级 {dim.percentile}%
                                </div>
                              </td>
                            ) : null}
                            <td className="px-4 py-2.5">{item.testName}</td>
                            <td className="px-4 py-2.5">
                              {item.value} {item.unit}
                            </td>
                            <td className="px-4 py-2.5">{item.normName}</td>
                            <td className="px-4 py-2.5">{item.mean}</td>
                            <td className="px-4 py-2.5">{item.stdDev}</td>
                            <td className="px-4 py-2.5">{item.zScore}</td>
                            <td className="px-4 py-2.5">{item.percentile}%</td>
                            <td className="px-4 py-2.5 font-medium text-ams-text-primary">{item.tScore}</td>
                            <td className="px-4 py-2.5">{dim.score}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-ams border border-ams-border/50 px-5 py-2.5 text-xs text-ams-text-muted">
            计算口径：Z = (成绩 − 常模均值) / 常模标准差（「越低越好」取反）；单项标准分 T = 50 + 10Z（0~100）；
            维度得分 = 该维度所选测试 T 分均值；TSA = 各维度得分等权平均。百分位数 = Φ(Z) × 100；
            维度百分等级 = Φ(该维度测试 Z 算术平均)；TSA 百分等级 = Φ((TSA − 50) / 10)（维度等权）。
            多运动员对比使用公共测试与统一常模，保证可比性。
          </div>
        </div>
      )}
    </div>
  );
}
