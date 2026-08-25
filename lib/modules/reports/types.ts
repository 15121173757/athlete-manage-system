/**
 * 报告中心 —— 类型定义（AMS）
 *
 * 职责：
 * 1. 定义报告类型、指标、聚合结果等核心数据契约
 * 2. 作为服务层 / API 层 / 前端之间的统一约定
 *
 * 设计说明：
 * - 报告数据采用「统一聚合结果」形态（kpis / charts / tables），
 *   每个块均携带唯一 key，前端依据「已选指标 keys」过滤渲染，
 *   从而支撑指标可自定义选择机制（勾选 / 排序 / 保存模板）。
 */

import type { PermissionKey } from '@/types';

// ============================================================
// 报告类型
// ============================================================

export type ReportType = 'training' | 'fitness' | 'injury';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  training: '训练报告',
  fitness: '测试报告',
  injury: '伤病报告',
};

// ============================================================
// 报告作用域（个人 / 团队）
// ============================================================

/** 报告生成对象：个人报告（单人） / 团队报告（多人） */
export type ReportScope = 'PERSONAL' | 'TEAM';

export const REPORT_SCOPE_LABELS: Record<ReportScope, string> = {
  PERSONAL: '个人报告',
  TEAM: '团队报告',
};

// ============================================================
// 指标定义
// ============================================================

/** 指标类别：概览指标 / 图表 / 明细表 */
export type MetricKind = 'kpi' | 'chart' | 'table';

/** 图表类型（recharts 对应） */
export type ChartKind = 'line' | 'bar' | 'pie' | 'radar';

/** 单个指标的定义（注册于 MetricRegistry，用于配置面板与渲染分发） */
export interface MetricDefinition {
  /** 唯一键，聚合结果中按此键匹配 */
  key: string;
  /** 展示名称 */
  label: string;
  /** 所属分组（用于配置面板分组展示） */
  group: string;
  /** 类别 */
  kind: MetricKind;
  /** 图表类型（kind 为 chart 时有效） */
  chartType?: ChartKind;
  /** 指标说明 */
  description?: string;
}

// ============================================================
// 报告指标配置（可保存为模板）
// ============================================================

/** 报告指标配置：按顺序存放已选指标 key */
export interface ReportMetricConfig {
  keys: string[];
}

// ============================================================
// 聚合结果（统一契约）
// ============================================================

/** 概览指标块 */
export interface KpiItem {
  key: string;
  label: string;
  /** 展示值（字符串，保留格式化结果） */
  value: string;
  unit?: string;
  /** 次级说明文字 */
  sub?: string;
}

/** 图表块（recharts 兼容数据） */
export interface ChartBlock {
  key: string;
  label: string;
  type: ChartKind;
  /** 折线/柱状图的 X 轴字段名 */
  xKey?: string;
  /** 数据系列字段名（饼图仅有第一个系列） */
  series: string[];
  data: Array<Record<string, unknown>>;
}

/** 明细表块 */
export interface TableBlock {
  key: string;
  label: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}

/** 统一报告聚合结果 */
export interface ReportData {
  reportType: ReportType;
  /** 报告作用域：个人 / 团队 */
  scope: ReportScope;
  title: string;
  generatedAt: string;
  /** 报告筛选条件回显 */
  filters: Record<string, unknown>;
  /** 报告涉及的运动员姓名列表（用于标题 / 头部回显） */
  athletes: string[];
  kpis: KpiItem[];
  charts: ChartBlock[];
  tables: TableBlock[];
}

// ============================================================
// 报告类型定义（ReportRegistry 注册项）
// ============================================================

/** 聚合参数（各报告类型的筛选条件松散透传） */
export interface ReportQuery {
  /** 报告作用域：个人（1 人）/ 团队（2 人及以上） */
  scope?: ReportScope;
  /** 运动员 ID 列表（个人报告 1 个，团队报告 2 个及以上） */
  athleteIds?: number[];
  exerciseId?: number;
  testId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/** 报告类型定义：声明数据源、权限、指标集合与聚合函数 */
export interface ReportTypeDefinition {
  key: ReportType;
  label: string;
  requiredPermission: PermissionKey;
  /** 该报告类型支持的作用域（伤病报告仅团队） */
  allowScopes: ReportScope[];
  /** 该报告类型的全部指标定义 */
  metrics: MetricDefinition[];
  /** 默认展示的指标 keys（未配置模板时使用） */
  defaultKeys: string[];
  /** 聚合函数：根据查询参数产出报告数据 */
  aggregate: (query: ReportQuery) => Promise<ReportData>;
}
