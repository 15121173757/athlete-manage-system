/**
 * 指标注册表 —— 报告中心（AMS）
 *
 * 职责：
 * 1. 集中声明各报告类型可展示的全部指标（MetricDefinition）
 * 2. 供配置面板渲染、供聚合结果校验与前端分发使用
 *
 * 扩展方式：
 * 新增报告类型或为现有报告新增指标时，只需在此处补充指标定义，
 * 并在对应聚合服务中输出同名 key 的数据块即可。
 */

import type { MetricDefinition, ReportType } from './types';

// ============================================================
// 训练报告指标
//
// 指标分类依据体能训练领域核心 KPI 体系（外部负荷 / 内部负荷 / 负荷分布）：
// - 训练负荷（外部负荷）：频次（次数/天数）、总量（容量）、单次负荷（平均容量）
// - 训练强度：组数、次数、平均负荷（强度）、平均 RPE（内部负荷主观疲劳度）
// - 负荷分布：容量趋势、负荷强度趋势、RPE 强度分布、分类负荷占比
// ============================================================

const TRAINING_METRICS: MetricDefinition[] = [
  // 训练负荷（外部负荷）
  { key: 'totalSessions', label: '训练次数', group: '训练负荷', kind: 'kpi', description: '筛选范围内的训练记录条数' },
  { key: 'trainingDays', label: '训练天数', group: '训练负荷', kind: 'kpi', description: '去重后的实际训练日期数（训练频率）' },
  { key: 'totalVolume', label: '训练总容量', group: '训练负荷', kind: 'kpi', description: '各记录 组数×次数×负荷 之和' },
  { key: 'avgVolumePerSession', label: '平均每次容量', group: '训练负荷', kind: 'kpi', description: '总容量 ÷ 训练次数' },
  // 训练强度（内部 / 外部负荷）
  { key: 'totalSets', label: '总组数', group: '训练强度', kind: 'kpi' },
  { key: 'totalReps', label: '总次数', group: '训练强度', kind: 'kpi' },
  { key: 'avgLoad', label: '平均负荷', group: '训练强度', kind: 'kpi', description: '各记录实际负荷平均值（kg）' },
  { key: 'avgRpe', label: '平均 RPE', group: '训练强度', kind: 'kpi', description: '主观疲劳度平均值（1-10）' },
  // 负荷分布（图表）
  { key: 'volumeTrend', label: '训练容量趋势', group: '负荷分布', kind: 'chart', chartType: 'bar', description: '按日期累计训练容量' },
  { key: 'intensityTrend', label: '负荷强度趋势', group: '负荷分布', kind: 'chart', chartType: 'line', description: '按日期平均负荷变化' },
  { key: 'rpeDistribution', label: 'RPE 强度分布', group: '负荷分布', kind: 'chart', chartType: 'bar', description: '各 RPE 等级的训练次数分布' },
  { key: 'loadByCategory', label: '分类负荷分布', group: '负荷分布', kind: 'chart', chartType: 'pie', description: '按项目分类统计负荷占比' },
  // 明细数据
  { key: 'records', label: '训练记录明细', group: '明细数据', kind: 'table' },
  { key: 'personalBests', label: '个人最佳纪录', group: '明细数据', kind: 'table' },
];

// ============================================================
// 测试报告指标
// ============================================================

const FITNESS_METRICS: MetricDefinition[] = [
  { key: 'totalRecords', label: '测试记录数', group: '概览指标', kind: 'kpi' },
  { key: 'totalAthletes', label: '参与运动员', group: '概览指标', kind: 'kpi' },
  { key: 'totalTests', label: '测试项目数', group: '概览指标', kind: 'kpi' },
  { key: 'avgValue', label: '平均成绩', group: '概览指标', kind: 'kpi', description: '全部数值型成绩的平均值' },
  { key: 'scoreTrend', label: '成绩趋势', group: '图表', kind: 'chart', chartType: 'line', description: '按测试日期展示成绩变化（需指定运动员）' },
  { key: 'testAvg', label: '各项目平均成绩', group: '图表', kind: 'chart', chartType: 'bar', description: '各测试项目平均成绩对比' },
  { key: 'records', label: '测试记录明细', group: '明细数据', kind: 'table' },
];

// ============================================================
// 伤病报告指标
// ============================================================

const INJURY_METRICS: MetricDefinition[] = [
  { key: 'totalInjuries', label: '伤病总数', group: '概览指标', kind: 'kpi' },
  { key: 'activeInjuries', label: '进行中伤病', group: '概览指标', kind: 'kpi', description: '受伤或康复中的伤病数' },
  { key: 'recovered', label: '已痊愈', group: '概览指标', kind: 'kpi' },
  { key: 'avgRecoveryDays', label: '平均恢复天数', group: '概览指标', kind: 'kpi', description: '已痊愈伤病的平均恢复周期' },
  { key: 'injuryByBodyPart', label: '伤病部位分布', group: '图表', kind: 'chart', chartType: 'pie' },
  { key: 'injuryByType', label: '伤病类型分布', group: '图表', kind: 'chart', chartType: 'bar' },
  { key: 'injuries', label: '伤病记录明细', group: '明细数据', kind: 'table' },
];

// ============================================================
// 注册表
// ============================================================

export const METRIC_REGISTRY: Record<ReportType, MetricDefinition[]> = {
  training: TRAINING_METRICS,
  fitness: FITNESS_METRICS,
  injury: INJURY_METRICS,
};

/** 查询某报告类型的全部指标定义 */
export function getMetrics(reportType: ReportType): MetricDefinition[] {
  return METRIC_REGISTRY[reportType] ?? [];
}

/** 查询某报告类型的指标 key 集合 */
export function getMetricKeys(reportType: ReportType): string[] {
  return getMetrics(reportType).map((m) => m.key);
}
