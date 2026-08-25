/**
 * 报告数据过滤工具 —— 报告中心（AMS）
 *
 * 职责：依据「已选指标 keys」过滤并排序统一聚合结果，
 * 供前端渲染与 PDF 导出复用（纯函数，无服务端依赖）。
 */

import type { ReportData } from './types';

/** 按 keys 顺序过滤并排序报告中的 kpis / charts / tables */
export function filterReportData(report: ReportData, keys: string[]): ReportData {
  const keySet = new Set(keys);
  const order = new Map(keys.map((k, i) => [k, i]));
  const sortByOrder = (a: { key: string }, b: { key: string }): number =>
    (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER);

  return {
    ...report,
    kpis: report.kpis.filter((k) => keySet.has(k.key)).sort(sortByOrder),
    charts: report.charts.filter((c) => keySet.has(c.key)).sort(sortByOrder),
    tables: report.tables.filter((t) => keySet.has(t.key)).sort(sortByOrder),
  };
}
