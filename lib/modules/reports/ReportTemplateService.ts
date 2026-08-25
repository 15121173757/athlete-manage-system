/**
 * 报告模板服务 —— 报告中心（AMS）
 *
 * 职责：管理用户自定义的报告指标配置模板（ReportTemplate）。
 * - PERSONAL：个人模板，归属某用户，仅本人可改
 * - GLOBAL：全局默认模板，供管理员设定
 * - isDefault：同一报告类型 + 作用域下仅允许一个默认模板
 *
 * 与指标选择机制配合：模板保存的 config = { keys: string[] }，
 * 前端据此过滤报告聚合结果中对应 key 的数据块并排序渲染。
 */

import { prisma } from '@/lib/db/prisma';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/errors/ErrorPresenter';
import type { ReportMetricConfig, ReportType } from './types';
import { getMetricKeys } from './metricRegistry';
import { getReportDefinition, isReportType } from './reportRegistry';

// ============================================================
// 类型定义
// ============================================================

export interface TemplateInput {
  name: string;
  reportType: ReportType;
  scope?: 'PERSONAL' | 'GLOBAL';
  config: ReportMetricConfig;
  isDefault?: boolean;
}

export interface ReportTemplateDTO {
  id: number;
  name: string;
  reportType: ReportType;
  scope: 'PERSONAL' | 'GLOBAL';
  ownerId: number | null;
  config: ReportMetricConfig;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// 内部工具
// ============================================================

function parseConfig(raw: string): ReportMetricConfig {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.keys)) return { keys: [] };
    return { keys: parsed.keys.filter((k: unknown): k is string => typeof k === 'string') };
  } catch {
    return { keys: [] };
  }
}

function serialize<T extends { config: string }>(t: T): Omit<T, 'config'> & { config: ReportMetricConfig } {
  return { ...t, config: parseConfig(t.config) };
}

/** 校验指标 key 是否合法（过滤掉未知 key） */
function sanitizeKeys(reportType: ReportType, keys: string[]): string[] {
  const valid = new Set(getMetricKeys(reportType));
  return keys.filter((k) => valid.has(k));
}

/** 校验模板输入 */
function validateInput(input: TemplateInput): void {
  if (!input.name?.trim()) throw new ValidationError('模板名称不能为空');
  if (!isReportType(input.reportType)) throw new ValidationError('无效的报告类型');
  if (!input.config || !Array.isArray(input.config.keys)) throw new ValidationError('指标配置无效');
}

// ============================================================
// 查询
// ============================================================

/** 列出某报告类型下：本人个人模板 + 全局模板 */
export async function listReportTemplates(
  reportType: ReportType,
  ownerId: number
): Promise<ReportTemplateDTO[]> {
  if (!isReportType(reportType)) throw new ValidationError('无效的报告类型');
  const templates = await prisma.reportTemplate.findMany({
    where: {
      reportType,
      OR: [{ scope: 'PERSONAL', ownerId }, { scope: 'GLOBAL' }],
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });
  return templates.map(serialize);
}

export async function getReportTemplate(id: number): Promise<ReportTemplateDTO> {
  const t = await prisma.reportTemplate.findUnique({ where: { id } });
  if (!t) throw new NotFoundError('报告模板不存在');
  return serialize(t);
}

// ============================================================
// 写入
// ============================================================

/** 新建模板（PERSONAL 需归属当前用户） */
export async function createReportTemplate(
  ownerId: number,
  input: TemplateInput
): Promise<ReportTemplateDTO> {
  validateInput(input);
  const scope = input.scope ?? 'PERSONAL';
  const config = { keys: sanitizeKeys(input.reportType, input.config.keys) };

  const template = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.reportTemplate.updateMany({
        where: { reportType: input.reportType, scope, ...(scope === 'PERSONAL' ? { ownerId } : {}) },
        data: { isDefault: false },
      });
    }
    return tx.reportTemplate.create({
      data: {
        name: input.name.trim(),
        reportType: input.reportType,
        scope,
        ownerId: scope === 'PERSONAL' ? ownerId : null,
        config: JSON.stringify(config),
        isDefault: input.isDefault ?? false,
      },
    });
  });

  return serialize(template);
}

/** 更新模板（仅本人 PERSONAL 模板可改） */
export async function updateReportTemplate(
  id: number,
  ownerId: number,
  input: TemplateInput
): Promise<ReportTemplateDTO> {
  validateInput(input);

  const existing = await prisma.reportTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('报告模板不存在');
  if (existing.scope === 'PERSONAL' && existing.ownerId !== ownerId) {
    throw new ForbiddenError('无权修改他人的报告模板');
  }

  const scope = existing.scope;
  const config = { keys: sanitizeKeys(input.reportType, input.config.keys) };

  const template = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.reportTemplate.updateMany({
        where: { reportType: input.reportType, scope, ...(scope === 'PERSONAL' ? { ownerId } : {}) },
        data: { isDefault: false },
      });
    }
    return tx.reportTemplate.update({
      where: { id },
      data: {
        name: input.name.trim(),
        reportType: input.reportType,
        config: JSON.stringify(config),
        isDefault: input.isDefault ?? false,
      },
    });
  });

  return serialize(template);
}

/** 删除模板（仅本人 PERSONAL 模板可删） */
export async function deleteReportTemplate(id: number, ownerId: number): Promise<void> {
  const existing = await prisma.reportTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('报告模板不存在');
  if (existing.scope === 'PERSONAL' && existing.ownerId !== ownerId) {
    throw new ForbiddenError('无权删除他人的报告模板');
  }
  await prisma.reportTemplate.delete({ where: { id } });
}

// ============================================================
// 指标配置解析（供报告查询时确定展示指标）
// ============================================================

/**
 * 解析某报告类型当前生效的指标配置：
 * 优先取该用户的默认模板，其次全局默认模板，最终回退到注册表 defaultKeys。
 */
export async function resolveMetricKeys(
  reportType: ReportType,
  ownerId?: number
): Promise<string[]> {
  if (!isReportType(reportType)) throw new ValidationError('无效的报告类型');

  const template = await prisma.reportTemplate.findFirst({
    where: {
      reportType,
      isDefault: true,
      OR: ownerId != null ? [{ scope: 'PERSONAL', ownerId }, { scope: 'GLOBAL' }] : [{ scope: 'GLOBAL' }],
    },
    orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }],
  });

  if (template) {
    const keys = parseConfig(template.config).keys;
    if (keys.length) return keys;
  }

  const def = getReportDefinition(reportType);
  return def?.defaultKeys ?? getMetricKeys(reportType);
}
