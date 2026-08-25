/**
 * 测试报告聚合服务 —— 报告中心（AMS）
 *
 * 职责：基于体能测试成绩（FitnessTestResult / FitnessTest）聚合出统一形态的报告数据。
 * 成绩结果由 FitnessTestResult 承载（按测试计划归集），
 * 数值型成绩用于统计与图表，等级型 / 描述型仅进入明细表。
 */

import { prisma } from '@/lib/db/prisma';
import type { ReportData, ReportQuery, ReportScope } from './types';
import { resolveAthleteNames, buildReportTitle } from './reportCommon';

const fmt = (n: number): string => {
  if (!isFinite(n)) return '-';
  return Number(n.toFixed(2)).toString();
};

const RECORD_COLUMNS = [
  { key: 'date', label: '测试日期' },
  { key: 'athlete', label: '运动员' },
  { key: 'test', label: '测试项目' },
  { key: 'category', label: '分类' },
  { key: 'value', label: '成绩' },
];

/** 数值型成绩展示（含单位） */
function displayValue(r: {
  value: number | null;
  gradeValue: string | null;
  textValue: string | null;
  unit: string;
}): string {
  if (r.value != null) return `${fmt(r.value)} ${r.unit}`.trim();
  if (r.gradeValue) return r.gradeValue;
  if (r.textValue) return r.textValue;
  return '-';
}

export async function aggregateFitnessReport(query: ReportQuery): Promise<ReportData> {
  const { athleteIds, testId, startDate, endDate } = query;
  const scope: ReportScope = query.scope ?? 'TEAM';

  const where: Record<string, unknown> = {};
  if (athleteIds && athleteIds.length) where.athleteId = { in: athleteIds };
  if (testId) where.testId = testId;

  const results = await prisma.fitnessTestResult.findMany({
    where,
    include: {
      athlete: { select: { name: true } },
      test: { select: { name: true, category: true, unit: true, resultType: true } },
      plan: { select: { testDate: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 日期范围按「测试计划日期」过滤
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const filtered = results.filter((r) => {
    const d = r.plan.testDate;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  // ---- 概览指标 ----
  const numericValues = filtered
    .map((r) => r.value)
    .filter((v): v is number => v != null);
  const avgValue = numericValues.length
    ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
    : 0;
  const athleteCount = new Set(filtered.map((r) => r.athleteId)).size;
  const testCount = new Set(filtered.map((r) => r.testId)).size;

  // ---- 成绩趋势（按日期汇总数值型平均成绩）----
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const r of filtered) {
    if (r.value == null) continue;
    const d = r.plan.testDate.toISOString().slice(0, 10);
    const cur = byDay.get(d) ?? { sum: 0, count: 0 };
    cur.sum += r.value;
    cur.count += 1;
    byDay.set(d, cur);
  }
  const scoreTrend = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, value: Number((v.sum / v.count).toFixed(2)) }));

  // ---- 各项目平均成绩 ----
  const byTest = new Map<number, { name: string; sum: number; count: number }>();
  for (const r of filtered) {
    if (r.value == null) continue;
    const cur = byTest.get(r.testId) ?? { name: r.test.name, sum: 0, count: 0 };
    cur.sum += r.value;
    cur.count += 1;
    byTest.set(r.testId, cur);
  }
  const testAvg = [...byTest.values()].map((t) => ({
    name: t.name,
    value: Number((t.sum / t.count).toFixed(2)),
  }));

  // ---- 明细表 ----
  const rows = filtered.map((r) => ({
    date: r.plan.testDate.toISOString().slice(0, 10),
    athlete: r.athlete.name,
    test: r.test.name,
    category: r.test.category,
    value: displayValue({
      value: r.value,
      gradeValue: r.gradeValue,
      textValue: r.textValue,
      unit: r.test.unit,
    }),
  }));

  const athletes = await resolveAthleteNames(athleteIds);

  return {
    reportType: 'fitness',
    scope,
    title: buildReportTitle('fitness', scope, athletes),
    generatedAt: new Date().toISOString(),
    filters: { scope, athleteIds, testId, startDate, endDate },
    athletes,
    kpis: [
      { key: 'totalRecords', label: '测试记录数', value: String(filtered.length), sub: '条成绩' },
      { key: 'totalAthletes', label: '参与运动员', value: String(athleteCount), sub: '人' },
      { key: 'totalTests', label: '测试项目数', value: String(testCount), sub: '项' },
      { key: 'avgValue', label: '平均成绩', value: fmt(avgValue), sub: '数值型成绩' },
    ],
    charts: [
      { key: 'scoreTrend', label: '成绩趋势', type: 'line', xKey: 'date', series: ['value'], data: scoreTrend },
      { key: 'testAvg', label: '各项目平均成绩', type: 'bar', xKey: 'name', series: ['value'], data: testAvg },
    ],
    tables: [
      { key: 'records', label: '测试记录明细', columns: RECORD_COLUMNS, rows },
    ],
  };
}
