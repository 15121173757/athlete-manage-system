/**
 * 负荷监控共享常量与文案 —— 伤病与负荷监控模块（AMS）
 *
 * 纯前端安全模块：不含数据库依赖，供客户端组件与服务端服务共同引用。
 */

export type AcwrRiskLevel = 'LOW' | 'SAFE' | 'ELEVATED' | 'HIGH' | 'NO_DATA';

export const AcwrRiskLabels: Record<AcwrRiskLevel, string> = {
  LOW: '负荷不足',
  SAFE: '舒适区',
  ELEVATED: '风险升高',
  HIGH: '高风险',
  NO_DATA: '暂无数据',
};

/** ACWR 分级的标准化评价文本（风险预警详情页展示） */
export const AcwrRiskDescriptions: Record<AcwrRiskLevel, string> = {
  LOW: '近期的训练刺激较少（急性工作量），或运动员训练不够（慢性工作量较低）；这种情况下受伤的可能性较高',
  SAFE: '这一范围代表训练条件适中，受伤风险最小（舒适圈）',
  ELEVATED: '训练负荷上升较快（急性工作量高于慢性负荷基准），受伤风险升高，建议调整训练安排并持续观察',
  HIGH: '运动员处于超负荷状态（急性工作量更强烈）；这个区间的受伤概率最高（危险区）',
  NO_DATA: '暂无足够的负荷数据计算 ACWR，请录入训练负荷（RPE × 训练时长）后重新评估',
};
