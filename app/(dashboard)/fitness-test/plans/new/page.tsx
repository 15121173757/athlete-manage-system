'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Check,
  Clock,
  Users,
  ClipboardList,
  Package,
  Trash2,
  Save,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  normalizeTestCategory,
  isExerciseCategory,
} from '@/lib/fitness/test-types';

interface FitnessTest {
  id: number;
  name: string;
  category: string;
  unit: string;
  equipment: string | null;
}

interface Athlete {
  id: number;
  name: string;
  sport: string;
}

interface SelectedItem {
  testId: number;
  test: FitnessTest;
  sortOrder: number;
  allocatedMinutes: number | null;
}

const inputClass =
  'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';

export default function NewFitnessTestPlanPage() {
  const router = useRouter();
  const [tests, setTests] = useState<FitnessTest[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [form, setForm] = useState({
    name: '',
    testDate: new Date().toISOString().split('T')[0],
    startTime: '',
    estimatedDuration: '',
    location: '',
    weather: '',
    venueCondition: '',
    notes: '',
  });
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [testCategoryFilter, setTestCategoryFilter] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/fitness/tests')
      .then((r) => r.json())
      .then((j) => {
        if (j.success)
          // 数据源为测试库（fitness_tests）；分类做归一化，
          // 将历史短分类（练习库风格）映射到测试库标准分类
          setTests(
            j.data.map((t: FitnessTest) => ({
              ...t,
              category: normalizeTestCategory(t.category),
            }))
          );
      });
    fetch('/api/athletes?pageSize=200')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setAthletes(j.data.athletes);
      });
  }, []);

  const categories = useMemo(
    () => [
      ...new Set(
        // 数据筛选：仅从测试库分类中提取，排除练习库分类
        tests
          .filter((t) => !isExerciseCategory(t.category))
          .map((t) => t.category)
      ),
    ],
    [tests]
  );

  const filteredTests = tests.filter((t) => {
    // 数据筛选：严格排除练习库分类（严格区分测试库与练习库数据源）
    if (isExerciseCategory(t.category)) return false;
    if (
      testSearch &&
      !t.name.toLowerCase().includes(testSearch.toLowerCase())
    )
      return false;
    if (testCategoryFilter && t.category !== testCategoryFilter) return false;
    return true;
  });

  // 队伍（运动项目）维度选项：按项目分组统计人数，供多选筛选
  const teamOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of athletes) {
      const team = a.sport || '未登记';
      counts.set(team, (counts.get(team) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([team, count]) => ({ team, count }))
      .sort((x, y) => x.team.localeCompare(y.team, 'zh-CN'));
  }, [athletes]);

  const filteredAthletes = athletes.filter((a) => {
    if (
      selectedTeams.length > 0 &&
      !selectedTeams.includes(a.sport || '未登记')
    ) {
      return false;
    }
    if (!athleteSearch) return true;
    return a.name.toLowerCase().includes(athleteSearch.toLowerCase());
  });

  const totalAllocatedMinutes = selectedItems.reduce(
    (sum, i) => sum + (i.allocatedMinutes || 0),
    0
  );

  // 器材汇总：从已选测试的 equipment 字段聚合
  const equipmentSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of selectedItems) {
      const eqStr = item.test.equipment;
      if (!eqStr) continue;
      const names = eqStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const name of names) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [selectedItems]);

  const toggleTest = (test: FitnessTest) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.testId === test.id);
      if (exists) {
        return prev.filter((i) => i.testId !== test.id);
      }
      return [
        ...prev,
        {
          testId: test.id,
          test,
          sortOrder: prev.length,
          allocatedMinutes: null,
        },
      ];
    });
  };

  const updateItem = (testId: number, updates: Partial<SelectedItem>) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.testId === testId ? { ...i, ...updates } : i))
    );
  };

  const moveItem = (testId: number, direction: 'up' | 'down') => {
    setSelectedItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((i) => i.testId === testId);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const aOrder = a.sortOrder;
      a.sortOrder = b.sortOrder;
      b.sortOrder = aOrder;
      return [...sorted];
    });
  };

  const toggleParticipant = (athleteId: number) => {
    setParticipantIds((prev) =>
      prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId]
    );
  };

  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  const toggleSelectAllAthletes = () => {
    if (filteredAthletes.every((a) => participantIds.includes(a.id))) {
      setParticipantIds((prev) =>
        prev.filter((id) => !filteredAthletes.find((a) => a.id === id))
      );
    } else {
      setParticipantIds((prev) => [
        ...new Set([...prev, ...filteredAthletes.map((a) => a.id)]),
      ]);
    }
  };

  /** 构建提交负载：草稿带 status=DRAFT，正式创建不带 status（由后端按执行时间自动判定） */
  const buildPayload = (draft: boolean) => {
    const sortedItems = [...selectedItems].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    return {
      name: form.name.trim(),
      testDate: form.testDate,
      startTime: form.startTime || null,
      estimatedDuration: form.estimatedDuration
        ? parseInt(form.estimatedDuration)
        : null,
      location: form.location || null,
      weather: form.weather || null,
      venueCondition: form.venueCondition || null,
      notes: form.notes || null,
      ...(draft ? { status: 'DRAFT' } : {}),
      items: sortedItems.map((i, idx) => ({
        testId: i.testId,
        sortOrder: idx,
        allocatedMinutes: i.allocatedMinutes,
      })),
      participantIds,
    };
  };

  const submitPlan = async (draft: boolean) => {
    if (!form.name.trim()) {
      setError('请输入计划名称');
      return;
    }
    if (!form.testDate) {
      setError('请选择测试日期');
      return;
    }
    if (!draft && selectedItems.length === 0) {
      setError('请至少选择一个测试项目');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/fitness/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(draft)),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/fitness-test/plans/${json.data.id}`);
      } else {
        setError(json.error?.message || (draft ? '保存草稿失败' : '创建失败'));
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitPlan(false);
  };

  /** 存为草稿：仅要求名称与测试日期，练习项目/参与人员可暂缺 */
  const handleSaveDraft = () => {
    submitPlan(true);
  };

  const allFilteredSelected = filteredAthletes.length > 0 && filteredAthletes.every((a) => participantIds.includes(a.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {/* replace 替换当前历史条目：离开新建页后不保留该条目，避免形成导航循环 */}
        <Link href="/fitness-test/plans" replace>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-ams-text-primary">新建测试计划</h2>
      </div>

      {error && (
        <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. 基本信息 */}
        <div className="ams-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-ams-text-primary">基本信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                计划名称 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：2026年8月夏训期体能测试"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                测试日期 *
              </label>
              <input
                type="date"
                value={form.testDate}
                onChange={(e) => setForm({ ...form, testDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                开始时间
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                预计时长（分钟）
              </label>
              <input
                type="number"
                min={1}
                value={form.estimatedDuration}
                onChange={(e) =>
                  setForm({ ...form, estimatedDuration: e.target.value })
                }
                placeholder="例如：120"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                测试地点
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="例如：训练基地田径场"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                天气状况
              </label>
              <input
                type="text"
                value={form.weather}
                onChange={(e) => setForm({ ...form, weather: e.target.value })}
                placeholder="例如：晴 25℃"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                场地条件
              </label>
              <input
                type="text"
                value={form.venueCondition}
                onChange={(e) =>
                  setForm({ ...form, venueCondition: e.target.value })
                }
                placeholder="例如：塑胶跑道干燥，力量房通风良好"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-ams-text-primary mb-1.5">
                备注
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="其他需要说明的事项"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* 2. 参与人员 */}
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">参与人员</h3>
            <span className="text-xs text-ams-text-muted">
              已选 {participantIds.length} / {athletes.length} 人
            </span>
          </div>

          {/* 队伍多选筛选 */}
          <div className="relative mb-3">
            <button
              type="button"
              onClick={() => setTeamMenuOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ams-text-muted" />
                {selectedTeams.length === 0
                  ? '全部队伍'
                  : `已选 ${selectedTeams.length} 个队伍`}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-ams-text-muted transition-transform ${
                  teamMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {teamMenuOpen && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-ams border border-ams-border bg-ams-surface shadow-lg">
                <div
                  onClick={() => setSelectedTeams([])}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-ams-surface-hover"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      selectedTeams.length === 0
                        ? 'border-ams-primary bg-ams-primary text-white'
                        : 'border-ams-border'
                    }`}
                  >
                    {selectedTeams.length === 0 && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm text-ams-text-primary">
                    全部队伍（{athletes.length} 人）
                  </span>
                </div>
                {teamOptions.map((t) => {
                  const checked = selectedTeams.includes(t.team);
                  return (
                    <div
                      key={t.team}
                      onClick={() => toggleTeam(t.team)}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-ams-surface-hover"
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          checked
                            ? 'border-ams-primary bg-ams-primary text-white'
                            : 'border-ams-border'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm text-ams-text-primary">
                        {t.team}
                      </span>
                      <span className="ml-auto text-xs text-ams-text-muted">
                        {t.count} 人
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
            <input
              type="text"
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="搜索运动员姓名..."
              className={inputClass.replace('px-3', 'pl-10 pr-4')}
            />
          </div>

          <div
            onClick={toggleSelectAllAthletes}
            className="flex items-center gap-3 rounded-ams border border-ams-border p-3 mb-2 cursor-pointer hover:bg-ams-surface-hover"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded border ${
                allFilteredSelected
                  ? 'border-ams-primary bg-ams-primary text-white'
                  : 'border-ams-border'
              }`}
            >
              {allFilteredSelected && <Check className="h-3 w-3" />}
            </div>
            <span className="text-sm font-medium text-ams-text-primary">
              全选
              {athleteSearch || selectedTeams.length > 0
                ? `（当前筛选 ${filteredAthletes.length} 人）`
                : ''}
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-ams border border-ams-border">
            {filteredAthletes.length === 0 ? (
              <div className="py-8 text-center text-ams-text-muted text-sm">
                暂无匹配的运动员
              </div>
            ) : (
              <div className="divide-y divide-ams-border/50">
                {filteredAthletes.map((a) => {
                  const checked = participantIds.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleParticipant(a.id)}
                      className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-ams-surface-hover ${
                        checked ? 'bg-ams-primary/5' : ''
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          checked
                            ? 'border-ams-primary bg-ams-primary text-white'
                            : 'border-ams-border'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <Users className="h-3.5 w-3.5 text-ams-text-muted" />
                      <span className="text-sm text-ams-text-primary">{a.name}</span>
                      <span className="ml-auto rounded-full bg-ams-primary/10 px-2 py-0.5 text-[11px] text-ams-primary">
                        {a.sport || '未登记'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. 测试项目选择 */}
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">
              测试项目选择
            </h3>
            <span className="text-xs text-ams-text-muted">
              已选 {selectedItems.length} 项 · 合计分配{' '}
              <span className="text-ams-primary font-medium">
                {totalAllocatedMinutes}
              </span>{' '}
              分钟
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ams-text-muted" />
              <input
                type="text"
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="搜索测试项目..."
                className={inputClass.replace('px-3', 'pl-10 pr-4')}
              />
            </div>
            <select
              value={testCategoryFilter}
              onChange={(e) => setTestCategoryFilter(e.target.value)}
              className="rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary"
            >
              <option value="">全部分类</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredTests.length === 0 ? (
            <div className="py-8 text-center text-ams-text-muted text-sm">
              暂无匹配的测试项目
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {filteredTests.map((t) => {
                const checked = selectedItems.some((i) => i.testId === t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTest(t)}
                    className={`flex items-center gap-3 rounded-ams border p-3 cursor-pointer transition-colors ${
                      checked
                        ? 'border-ams-primary bg-ams-primary/10'
                        : 'border-ams-border bg-ams-surface hover:bg-ams-surface-hover'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        checked
                          ? 'border-ams-primary bg-ams-primary text-white'
                          : 'border-ams-border'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ams-text-primary truncate">
                        {t.name}
                      </div>
                      <div className="text-xs text-ams-text-muted truncate">
                        {t.category} · {t.unit}
                        {t.equipment && ` · 器材：${t.equipment}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="rounded-ams border border-ams-border">
              <div className="border-b border-ams-border px-3 py-2 text-xs font-medium text-ams-text-secondary">
                已选项目（按顺序执行）
              </div>
              <div className="divide-y divide-ams-border/50">
                {[...selectedItems]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((item, idx, arr) => (
                    <div
                      key={item.testId}
                      className="flex items-center gap-3 p-3"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-ams bg-ams-primary/20 text-ams-primary text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ams-text-primary truncate">
                          {item.test.name}
                        </div>
                        <div className="text-xs text-ams-text-muted">
                          {item.test.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveItem(item.testId, 'up')}
                          disabled={idx === 0}
                          className="rounded px-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30 text-xs"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(item.testId, 'down')}
                          disabled={idx === arr.length - 1}
                          className="rounded px-1 text-ams-text-muted hover:bg-ams-surface-hover disabled:opacity-30 text-xs"
                        >
                          ▼
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-ams-text-muted" />
                        <input
                          type="number"
                          min={1}
                          value={item.allocatedMinutes ?? ''}
                          onChange={(e) =>
                            updateItem(item.testId, {
                              allocatedMinutes: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                          placeholder="分钟"
                          className="w-20 rounded-ams bg-ams-background border border-ams-border px-2 py-1 text-xs text-ams-text-primary"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleTest(item.test)}
                        className="text-ams-danger h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. 器材汇总 */}
        <div className="ams-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ams-text-primary">器材汇总</h3>
            <span className="text-xs text-ams-text-muted">
              根据已选测试项目自动生成
            </span>
          </div>

          {equipmentSummary.length === 0 ? (
            <div className="py-8 text-center text-ams-text-muted text-sm">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              暂无器材需求，请先选择测试项目
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {equipmentSummary.map((eq) => (
                <div
                  key={eq.name}
                  className="flex items-center justify-between rounded-ams border border-ams-border bg-ams-surface p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 text-ams-primary shrink-0" />
                    <span className="text-sm text-ams-text-primary truncate">
                      {eq.name}
                    </span>
                  </div>
                  <span className="ml-2 rounded-full bg-ams-primary/20 px-2 py-0.5 text-xs font-medium text-ams-primary">
                    ×{eq.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/fitness-test/plans">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isLoading}>
            <Save className="h-4 w-4" />
            存为草稿
          </Button>
          <Button type="submit" disabled={isLoading}>
            <ClipboardList className="h-4 w-4" />
            {isLoading ? '创建中...' : '创建计划'}
          </Button>
        </div>
      </form>
    </div>
  );
}
