/**
 * 报告聚合公共工具 —— 报告中心（AMS）
 *
 * 职责：供三个报告聚合服务复用的公共逻辑：
 * 1. 按运动员 ID 列表解析姓名（保证标题准确反映选中运动员，即使部分人员无数据）
 * 2. 根据报告类型 / 作用域 / 运动员生成专业标题
 */

import { prisma } from '@/lib/db/prisma';
import type { ReportScope, ReportType } from './types';
import { REPORT_TYPE_LABELS, REPORT_SCOPE_LABELS } from './types';

/** 按运动员 ID 列表解析姓名（保持 ID 顺序） */
export async function resolveAthleteNames(ids: number[] | undefined): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await prisma.athlete.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const map = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => map.get(id) ?? '未知运动员');
}

/** 生成报告标题：个人报告显示运动员姓名，团队报告显示范围与人数 */
export function buildReportTitle(
  reportType: ReportType,
  scope: ReportScope,
  athletes: string[]
): string {
  const label = REPORT_TYPE_LABELS[reportType];
  if (scope === 'PERSONAL' && athletes.length === 1) {
    return `${athletes[0]} · ${label}`;
  }
  return `${label}（${REPORT_SCOPE_LABELS[scope]} · ${athletes.length} 人）`;
}
