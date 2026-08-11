/**
 * 运动科学工具箱 —— 1RM（最大重复次数）预测工具
 *
 * 提供两种经过循证验证的 1RM 预测方法：
 *
 * 1. 传统预测法（重量 × 次数）：基于次极限负荷（submaximal）训练组
 *    通过经验公式外推 1RM，取多公式综合平均提高可靠性。
 *    公式来源：Epley 1985；Brzycki 1993；Lander 1985；Mayhew et al. 1992；
 *             O'Conner et al. 1989；Wathan 1994。
 *
 * 2. 速度法（VBT，Velocity-Based Training）：基于平均速度（mean velocity）
 *    与负荷之间的线性关系外推 1RM（González-Badillo & Sánchez-Medina 2010；
 *    Jidovtseff et al. 2011）。每个动作具有典型的 1RM 速度阈值
 *    （Minimal Velocity Threshold, MVT），回归线外推到 MVT 对应的负荷即为 1RM。
 */

/** 一组传统法数据：（重量, 次数） */
export interface RepSet {
  weight: number; // kg
  reps: number;   // 次
}

/** 一组速度法数据：（负荷, 平均速度） */
export interface VelocityPoint {
  load: number;    // kg
  velocity: number; // m/s（杠铃平均速度）
}

/** 传统预测法中的一个经验公式 */
export interface OneRMFormula {
  key: string;
  label: string;
  source: string;
  /** 适用次数范围提示 */
  repRange: string;
  /** 由重量与次数估算 1RM（kg） */
  estimate: (weight: number, reps: number) => number;
}

/** 传统预测法公式库 */
export const TRADITIONAL_FORMULAS: OneRMFormula[] = [
  {
    key: 'epley',
    label: 'Epley 公式',
    source: 'Epley 1985',
    repRange: '1–12 次',
    estimate: (w, r) => w * (1 + 0.0333 * r),
  },
  {
    key: 'brzycki',
    label: 'Brzycki 公式',
    source: 'Brzycki 1993',
    repRange: '1–10 次',
    estimate: (w, r) => (w * 36) / (37 - r),
  },
  {
    key: 'lander',
    label: 'Lander 公式',
    source: 'Lander 1985',
    repRange: '1–12 次',
    estimate: (w, r) => (w * 100) / (101.3 - 2.67123 * r),
  },
  {
    key: 'mayhew',
    label: 'Mayhew 公式',
    source: 'Mayhew et al. 1992',
    repRange: '2–12 次',
    estimate: (w, r) => (w * 100) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  },
  {
    key: 'oconner',
    label: "O'Conner 公式",
    source: "O'Conner et al. 1989",
    repRange: '≥ 10 次',
    estimate: (w, r) => w * (1 + 0.025 * r),
  },
  {
    key: 'wathan',
    label: 'Wathan 公式',
    source: 'Wathan 1994',
    repRange: '1–12 次',
    estimate: (w, r) => (w * 100) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  },
];

/** 速度法动作参考模板（MVT 为文献典型 1RM 速度阈值，个体间存在差异） */
export interface ExerciseTemplate {
  key: string;
  label: string;
  /** 1RM 速度阈值（m/s） */
  mvt: number;
  desc: string;
}

export const EXERCISE_TEMPLATES: ExerciseTemplate[] = [
  {
    key: 'bench',
    label: '卧推（Bench Press）',
    mvt: 0.15,
    desc: '上肢推力动作，文献典型 1RM 速度阈值约 0.15 m/s（González-Badillo et al.）',
  },
  {
    key: 'squat',
    label: '深蹲（Back Squat）',
    mvt: 0.30,
    desc: '下肢动作，文献典型 1RM 速度阈值约 0.30 m/s（González-Badillo et al.）',
  },
  {
    key: 'deadlift',
    label: '硬拉（Deadlift）',
    mvt: 0.30,
    desc: '髋膝主导动作，文献典型 1RM 速度阈值约 0.30 m/s',
  },
  {
    key: 'overhead',
    label: '站姿推举（Overhead Press）',
    mvt: 0.20,
    desc: '上肢推力动作，文献典型 1RM 速度阈值约 0.20 m/s',
  },
];

/** 传统法结果：载荷处方（%1RM → 重量与目标次数） */
export interface LoadPrescription {
  pct: number;    // %1RM
  weight: number; // kg
  repsRange: [number, number]; // 目标次数区间
}

export interface TraditionalResult {
  method: 'traditional';
  /** 综合 1RM（所有公式 × 所有组均值，kg） */
  oneRM: number;
  /** 各公式 1RM（多组数据取平均） */
  perFormula: { key: string; label: string; source: string; oneRM: number }[];
  /** 各组输入明细 */
  sets: { weight: number; reps: number; oneRM: number }[];
  /** %1RM 载荷处方表 */
  prescription: LoadPrescription[];
  /** 组间估算变异系数（%，>5% 提示一致性欠佳） */
  cv: number;
  warnings: string[];
}

export interface VelocityResult {
  method: 'velocity';
  /** 外推 1RM（kg） */
  oneRM: number;
  /** 1RM 速度阈值 MVT（m/s） */
  mvt: number;
  /** 回归截距 a（v = a + b·load） */
  intercept: number;
  /** 回归斜率 b（m/s/kg，负值） */
  slope: number;
  /** 拟合优度 R² */
  r2: number;
  /** 回归方程文本 */
  equation: string;
  /** 实测数据点（原始输入） */
  points: VelocityPoint[];
  /** 速度-负荷回归线数据点（load 从 0 到 1RM，1RM 处速度 = MVT） */
  curve: { load: number; velocity: number }[];
  /** %1RM 目标速度表 */
  velocityTable: { pct: number; velocity: number }[];
  warnings: string[];
}

/** 传统法输入校验 */
export function validateTraditionalInputs(sets: RepSet[]): string[] {
  const errors: string[] = [];
  if (sets.length === 0) {
    errors.push('请至少输入 1 组（重量，次数）数据');
    return errors;
  }
  sets.forEach((s, i) => {
    if (!Number.isFinite(s.weight) || s.weight <= 0 || s.weight > 1000) {
      errors.push(`第 ${i + 1} 组：重量须为 0–1000 kg 之间的数值`);
    }
    if (!Number.isFinite(s.reps) || s.reps < 1 || s.reps > 20) {
      errors.push(`第 ${i + 1} 组：次数须为 1–20 之间的整数`);
    }
  });
  if (errors.length === 0 && sets.some((s) => s.reps > 12)) {
    errors.push('部分组次数 > 12：次极限估算精度随次数升高而显著下降，建议使用 ≤ 12 次的数据');
  }
  if (errors.length === 0) {
    const weights = sets.map((s) => s.weight);
    const maxW = Math.max(...weights);
    const minW = Math.min(...weights);
    if (minW === maxW && sets.length > 1) {
      errors.push('多组数据重量完全一致：无法体现不同负荷下的估算一致性，建议使用不同重量的数据组');
    }
  }
  return errors;
}

/** 速度法输入校验 */
export function validateVelocityInputs(points: VelocityPoint[], mvt: number): string[] {
  const errors: string[] = [];
  if (points.length < 2) {
    errors.push('请至少输入 2 组（负荷，平均速度）数据点');
  }
  if (!Number.isFinite(mvt) || mvt <= 0 || mvt > 1) {
    errors.push('1RM 速度阈值（MVT）须为 0–1 m/s 之间的数值');
  }
  points.forEach((p, i) => {
    if (!Number.isFinite(p.load) || p.load <= 0 || p.load > 1000) {
      errors.push(`第 ${i + 1} 组：负荷须为 0–1000 kg 之间的数值`);
    }
    if (!Number.isFinite(p.velocity) || p.velocity <= 0 || p.velocity > 3) {
      errors.push(`第 ${i + 1} 组：平均速度须为 0–3 m/s 之间的数值`);
    }
  });
  if (errors.length === 0 && points.some((p) => p.velocity <= mvt)) {
    errors.push('存在速度 ≤ MVT 的数据点：该负荷已接近或达到 1RM，属极限负荷数据，请使用轻负荷（速度明显高于阈值）的数据点');
  }
  return errors;
}

/** 速度法最小二乘线性回归：v = a + b·load */
function fitVelocity(points: VelocityPoint[]): { a: number; b: number; r2: number } {
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.load;
    sumY += p.velocity;
    sumXY += p.load * p.velocity;
    sumX2 += p.load * p.load;
    sumY2 += p.velocity * p.velocity;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    throw new Error('数据点负荷值过于集中，无法拟合（请确保各负荷存在差异）');
  }
  const b = (n * sumXY - sumX * sumY) / denom;
  const a = (sumY - b * sumX) / n;

  if (b >= 0) {
    throw new Error('拟合结果异常：平均速度应随负荷增大而线性下降（斜率应为负值），请检查数据');
  }
  if (a <= 0) {
    throw new Error('拟合结果异常：无法外推 1RM，请检查数据点');
  }

  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const p of points) {
    const yHat = a + b * p.load;
    ssRes += (p.velocity - yHat) ** 2;
    ssTot += (p.velocity - meanY) ** 2;
  }
  const r2 = ssTot < 1e-9 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { a, b, r2 };
}

/** 反推目标次数（Epley 公式）：给定 %1RM，reps = (1/(pct/100) − 1)/0.0333 */
function targetReps(pct: number): number {
  return (100 / pct - 1) / 0.0333;
}

/**
 * 传统法：计算 1RM（多组数据 × 多公式，综合取平均）
 * 前置条件：已通过 validateTraditionalInputs 校验
 */
export function calculateTraditional(sets: RepSet[]): TraditionalResult {
  // 每组 × 每公式的 1RM 估算
  const perFormulaSum = new Map<string, number>();
  TRADITIONAL_FORMULAS.forEach((f) => perFormulaSum.set(f.key, 0));

  const setDetails = sets.map((s) => {
    let sum = 0;
    const formulaValues: number[] = [];
    TRADITIONAL_FORMULAS.forEach((f) => {
      const est = f.estimate(s.weight, s.reps);
      perFormulaSum.set(f.key, (perFormulaSum.get(f.key) ?? 0) + est);
      formulaValues.push(est);
      sum += est;
    });
    return { weight: s.weight, reps: s.reps, oneRM: sum / TRADITIONAL_FORMULAS.length };
  });

  const nSets = sets.length;
  const perFormula = TRADITIONAL_FORMULAS.map((f) => ({
    key: f.key,
    label: f.label,
    source: f.source,
    oneRM: (perFormulaSum.get(f.key) ?? 0) / nSets,
  }));

  // 综合 1RM：所有公式 × 所有组的均值
  const allValues = setDetails.flatMap((d, i) =>
    TRADITIONAL_FORMULAS.map((f) => f.estimate(sets[i].weight, sets[i].reps))
  );
  const oneRM = allValues.reduce((s, v) => s + v, 0) / allValues.length;

  // 组间估算变异系数（以每组综合 1RM 计）
  const mean = setDetails.reduce((s, d) => s + d.oneRM, 0) / setDetails.length;
  const sd = Math.sqrt(setDetails.reduce((s, d) => s + (d.oneRM - mean) ** 2, 0) / setDetails.length);
  const cv = mean > 0 ? (sd / mean) * 100 : 0;

  const warnings: string[] = [];
  if (cv > 5) {
    warnings.push(`各组估算结果间变异系数为 ${cv.toFixed(1)}%（> 5%）：不同负荷组的 1RM 估算差异较大，建议检查动作技术稳定性或采用更多数据组综合评估`);
  }
  if (sets.some((s) => s.reps > 12)) {
    warnings.push('存在次数 > 12 的数据：估算结果已按 O\'Conner 等长次数公式补偿，但总体可靠性下降，建议以 ≤ 12 次数据为准');
  }

  // %1RM 载荷处方表
  const PCTS = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const prescription: LoadPrescription[] = PCTS.map((pct) => {
    const weight = (oneRM * pct) / 100;
    const reps = targetReps(pct);
    return {
      pct,
      weight,
      repsRange: [Math.max(1, Math.round(reps) - 1), Math.round(reps) + 1],
    };
  });

  return { method: 'traditional', oneRM, perFormula, sets: setDetails, prescription, cv, warnings };
}

/**
 * 速度法（VBT）：线性回归 v = a + b·load，外推到 MVT 对应负荷得到 1RM
 * 前置条件：已通过 validateVelocityInputs 校验
 */
export function calculateVelocity(points: VelocityPoint[], mvt: number): VelocityResult {
  const { a, b, r2 } = fitVelocity(points);

  // v = MVT 时的负荷即 1RM
  const oneRM = (a - mvt) / -b;
  if (!Number.isFinite(oneRM) || oneRM <= Math.max(...points.map((p) => p.load))) {
    throw new Error('拟合外推结果异常：1RM 应大于最大实测负荷，请检查数据点与 MVT 设置');
  }
  // 防止过度外推（1RM 超过最大负荷 30% 通常不可靠）
  const maxLoad = Math.max(...points.map((p) => p.load));
  if (oneRM > maxLoad * 1.5) {
    throw new Error(`外推 1RM（${oneRM.toFixed(1)} kg）超过最大实测负荷（${maxLoad.toFixed(1)} kg）50%：外推距离过大，结果不可靠，建议补充更接近 1RM 的负荷数据`);
  }

  // 速度-负荷回归线（load 0 → 1RM）
  const steps = 60;
  const curve: { load: number; velocity: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const load = (oneRM * i) / steps;
    curve.push({ load, velocity: a + b * load });
  }

  // %1RM 目标速度表（60–95%，VBT 常用训练区间）
  const PCTS = [95, 90, 85, 80, 75, 70, 65, 60];
  const velocityTable = PCTS.map((pct) => ({
    pct,
    velocity: a + b * ((oneRM * pct) / 100),
  }));

  const warnings: string[] = [];
  if (r2 < 0.95) {
    warnings.push(`线性拟合优度 R² = ${r2.toFixed(3)}，低于 0.95：速度-负荷关系线性欠佳，建议检查数据采集质量或动作一致性，结果仅作参考`);
  }
  if (points.length < 3) {
    warnings.push('仅使用 2 个数据点：线性拟合无自由度冗余，建议补充至 3–5 个不同负荷的数据点以提高可靠性');
  }

  return {
    method: 'velocity',
    oneRM,
    mvt,
    intercept: a,
    slope: b,
    r2,
    equation: `V = ${a.toFixed(3)} ${b < 0 ? '−' : '+'} ${Math.abs(b).toFixed(4)}·L`,
    points,
    curve,
    velocityTable,
    warnings,
  };
}

/** 生成综合报告文本（传统法） */
export function buildTraditionalReport(result: TraditionalResult, athleteName?: string): string {
  const lines: string[] = [];
  const header = athleteName ? `${athleteName} — 1RM 预测报告（传统法）` : '1RM 预测报告（传统法）';
  lines.push(header);
  lines.push('='.repeat(header.length));
  lines.push(`数据组：${result.sets.length} 组`);
  result.sets.forEach((s, i) => lines.push(`  组 ${i + 1}：重量 ${s.weight.toFixed(1)} kg × ${s.reps} 次 → 估算 1RM ${s.oneRM.toFixed(1)} kg`));
  lines.push('');
  lines.push(`综合 1RM：${result.oneRM.toFixed(1)} kg（${result.oneRM.toFixed(1)} kg 平均值）`);
  lines.push('');
  lines.push('【各公式估算】');
  result.perFormula.forEach((f) => lines.push(`  ${f.label}（${f.source}）：${f.oneRM.toFixed(1)} kg`));
  lines.push('');
  lines.push('【%1RM 载荷处方】');
  lines.push(`  ${'%1RM'.padEnd(6)} ${'重量(kg)'.padEnd(10)} 目标次数`);
  result.prescription.forEach((p) => lines.push(`  ${String(p.pct).padEnd(6)} ${p.weight.toFixed(1).padEnd(10)} ${p.repsRange[0]}-${p.repsRange[1]} 次`));
  lines.push('');
  lines.push('【注意事项】');
  result.warnings.forEach((w) => lines.push(`  - ${w}`));
  lines.push('');
  lines.push('依据：Epley 1985；Brzycki 1993；Lander 1985；Mayhew et al. 1992；O\'Conner et al. 1989；Wathan 1994。');
  lines.push('注：经验公式对个体存在系统偏差，正式训练前建议择机实测 1RM 校准。');
  return lines.join('\n');
}

/** 生成综合报告文本（速度法） */
export function buildVelocityReport(result: VelocityResult, athleteName?: string): string {
  const lines: string[] = [];
  const header = athleteName ? `${athleteName} — 1RM 预测报告（速度法 VBT）` : '1RM 预测报告（速度法 VBT）';
  lines.push(header);
  lines.push('='.repeat(header.length));
  lines.push(`速度-负荷回归：${result.equation}`);
  lines.push(`拟合优度 R²：${result.r2.toFixed(3)}（建议 ≥ 0.95）`);
  lines.push(`1RM 速度阈值（MVT）：${result.mvt.toFixed(2)} m/s`);
  lines.push('');
  lines.push(`外推 1RM：${result.oneRM.toFixed(1)} kg`);
  lines.push('');
  lines.push('【%1RM 目标速度】');
  lines.push(`  ${'%1RM'.padEnd(6)} ${'目标速度(m/s)'.padEnd(14)}`);
  result.velocityTable.forEach((v) => lines.push(`  ${String(v.pct).padEnd(6)} ${v.velocity.toFixed(3).padEnd(14)}`));
  lines.push('');
  lines.push('【注意事项】');
  result.warnings.forEach((w) => lines.push(`  - ${w}`));
  lines.push('');
  lines.push('依据：González-Badillo & Sánchez-Medina 2010；Jidovtseff et al. 2011；González-Badillo et al. 2017。');
  lines.push('注：MVT 存在个体差异，建议定期校准；训练中用目标速度指导负荷设定。');
  return lines.join('\n');
}
