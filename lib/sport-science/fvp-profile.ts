/**
 * 运动科学工具箱 —— FVP Profile（力-速度-功率剖面）
 *
 * 基于 Jean-Benoît Morin & Pierre Samozino 团队研究的力-速度-功率剖面评估方法，
 * 用于评估运动员的加速能力、功率输出特征与力速平衡状态。
 *
 * 核心方程（Samozino et al. 2012/2016; Morin & Samozino 2016; Jiménez-Reyes et al. 2017）：
 *   - 力-速度线性关系：F(v) = F₀ −（F₀/v₀）·v
 *   - 功率-速度抛物线：P(v) = F(v)·v
 *   - 最大功率：Pmax = F₀·v₀ / 4（出现在 v = v₀/2 处）
 *   - 力-速度斜率：SFV = −F₀/v₀
 *   - 力速失衡指数：FVimb = 100 × |1 − SFV/SFV_opt|（0% 表示力速平衡）
 */

export type FVPTestMode = 'sprint' | 'jump';

/** 数据点模式：一组（速度，力）实测数据 */
export interface FVPPoint {
  velocity: number; // m/s
  force: number;    // N
}

export interface FVPInputs {
  /** 测试模式：sprint 水平冲刺 / jump 垂直跳跃 */
  mode: FVPTestMode;
  /** 体重（kg） */
  bodyMass: number;
  /** 理论最大力 F₀（N，速度为零时的力） */
  f0: number;
  /** 理论最大速度 v₀（m/s，力为零时的速度） */
  v0: number;
  /** 参考最优斜率 SFV_opt（相对斜率，s⁻¹，负值） */
  sopt: number;
  /** 数据点模式下的拟合优度 R²（直接参数模式为 null） */
  r2?: number | null;
}

/** 运动项目参考模板（文献参考区间与参考最优斜率） */
export interface FVPTemplate {
  key: string;
  label: string;
  refF0Rel: [number, number]; // N/kg 参考区间
  refV0: [number, number];    // m/s 参考区间
  refSopt: number;            // 参考最优斜率（相对，s⁻¹，负值）
  desc: string;
}

/** 运动项目参考模板（参考值基于 Morin/Samozino 团队研究中的典型人群数据） */
export const FVP_TEMPLATES: FVPTemplate[] = [
  {
    key: 'sprint',
    label: '冲刺型（短跑、橄榄球外线）',
    refF0Rel: [7.0, 10.0],
    refV0: [9.0, 11.5],
    refSopt: -0.85,
    desc: '以水平冲刺力-速度剖面为主，训练有素人群典型 F₀ 7–10 N/kg、v₀ 9–11.5 m/s',
  },
  {
    key: 'team',
    label: '团队型（足球、篮球等集体项目）',
    refF0Rel: [5.5, 8.5],
    refV0: [8.0, 10.0],
    refSopt: -0.75,
    desc: '集体项目运动员典型剖面，兼顾起步加速与最高速度能力',
  },
  {
    key: 'jump',
    label: '跳跃型（垂直爆发力）',
    refF0Rel: [24.0, 38.0],
    refV0: [4.0, 6.0],
    refSopt: -6.0,
    desc: '垂直方向力-速度剖面（如负重深蹲跳测试），典型 F₀ 24–38 N/kg、v₀ 4–6 m/s',
  },
];

/** 剖面类型 */
export type ProfileType = 'balanced' | 'force-dominant' | 'velocity-dominant';

/** 功率区间（最优性能区） */
export interface FVPZone {
  name: string;
  vMin: number | null;
  vMax: number | null;
  pMin: number | null;
  pMax: number | null;
  desc: string;
}

export interface FVPResult {
  mode: FVPTestMode;
  bodyMass: number;
  /** 理论最大力（N） */
  f0: number;
  /** 相对最大力（N/kg） */
  f0Rel: number;
  /** 理论最大速度（m/s） */
  v0: number;
  /** 最大功率（W） */
  pmax: number;
  /** 相对最大功率（W/kg） */
  pmaxRel: number;
  /** 力-速度斜率（绝对，N·s/m，负值） */
  sfv: number;
  /** 力-速度斜率（相对，s⁻¹，负值） */
  sfvRel: number;
  /** 参考最优斜率（相对，s⁻¹，负值） */
  sopt: number;
  /** 力速失衡指数（%） */
  fvimb: number;
  /** 实际斜率与最优斜率之比 SFV/SFV_opt */
  ratio: number;
  /** 剖面类型 */
  profileType: ProfileType;
  /** 剖面类型中文名 */
  profileLabel: string;
  /** 剖面解读 */
  profileDesc: string;
  /** 最大功率对应的最优速度 v = v₀/2（m/s） */
  vOpt: number;
  /** 最大功率对应的最优力 F = F₀/2（N） */
  fOpt: number;
  /**
   * 最佳力速曲线（F-Vopt）参数：与实测曲线共享最大功率点（v₀/2, F₀/2）、
   * 斜率取参考最优值 SFV_opt 的力-速度直线。
   * F_opt(v) = F₀/2 + SFV_opt·(v − v₀/2)
   */
  /** 最优曲线纵轴截距（v = 0 时的理论最大力，N） */
  f0Opt: number;
  /** 最优曲线横轴截距（F = 0 时的理论最大速度，m/s） */
  v0Opt: number;
  /** 最优功率区（功率 ≥ 90% Pmax）的速度区间 */
  power90: { vMin: number; vMax: number };
  /** 分级功率区间（供表格展示） */
  zones: FVPZone[];
  /** 拟合优度 R²（数据点模式） */
  r2: number | null;
  /** 实测力-速度曲线数据点（v 从 0 到 v₀，v₀ 处力 = 0 与横轴相交） */
  curve: { v: number; f: number; p: number }[];
  /**
   * 最佳力速曲线（F-Vopt）独立数据点：v 从 0 延伸到最优最大速度 v0Opt
   * （力 = 0 处与横轴相交），超出部分为 null（曲线终止）
   */
  curveOpt: { v: number; fOpt: number | null }[];
  /** 训练建议列表 */
  recommendations: string[];
}

/** 输入校验，返回中文错误信息列表（空数组表示通过） */
export function validateFVPInputs(inputs: Partial<FVPInputs>): string[] {
  const errors: string[] = [];
  const { bodyMass, f0, v0, sopt } = inputs;

  if (typeof bodyMass !== 'number' || !Number.isFinite(bodyMass) || bodyMass <= 0 || bodyMass > 300) {
    errors.push('体重须为 0–300 kg 之间的数值');
  }
  if (typeof f0 !== 'number' || !Number.isFinite(f0) || f0 <= 0) {
    errors.push('理论最大力 F₀ 须为大于 0 的数值（N）');
  }
  if (typeof v0 !== 'number' || !Number.isFinite(v0) || v0 <= 0) {
    errors.push('理论最大速度 v₀ 须为大于 0 的数值（m/s）');
  }
  if (typeof sopt !== 'number' || !Number.isFinite(sopt) || sopt >= 0) {
    errors.push('参考最优斜率 SFV_opt 须为负值（s⁻¹）');
  }

  if (
    errors.length === 0 &&
    bodyMass !== undefined &&
    f0 !== undefined &&
    v0 !== undefined &&
    sopt !== undefined
  ) {
    const sfvRel = -(f0 / bodyMass) / v0;
    if (Math.abs(sfvRel) > Math.abs(sopt) * 6) {
      errors.push('输入参数组合异常：实测力速斜率远小于参考最优斜率，请检查 F₀/v₀/体重 与运动项目是否匹配');
    }
  }

  return errors;
}

/**
 * 数据点模式：最小二乘线性回归拟合力-速度关系
 * F(v) = F₀ −（F₀/v₀）·v  →  y = a + b·x（x = v，y = F；a = F₀，b = −F₀/v₀）
 */
export function fitFVP(points: FVPPoint[]): { f0: number; v0: number; r2: number } {
  const n = points.length;
  if (n < 2) {
    throw new Error('至少需要 2 组（速度，力）数据点才能进行线性拟合');
  }
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.velocity;
    sumY += p.force;
    sumXY += p.velocity * p.force;
    sumX2 += p.velocity * p.velocity;
    sumY2 += p.force * p.force;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    throw new Error('数据点速度值过于集中，无法拟合（请确保速度存在差异）');
  }
  const b = (n * sumXY - sumX * sumY) / denom; // 斜率（应为负值）
  const a = (sumY - b * sumX) / n;             // 截距 F₀

  if (b >= 0 || a <= 0) {
    throw new Error('拟合结果异常：力-速度关系应呈负线性（力随速度增大而减小），请检查数据');
  }

  const f0 = a;
  const v0 = -a / b;
  // 决定系数 R²
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const p of points) {
    const yHat = a + b * p.velocity;
    ssRes += (p.force - yHat) ** 2;
    ssTot += (p.force - meanY) ** 2;
  }
  const r2 = ssTot < 1e-9 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { f0, v0, r2 };
}

/** 功率-速度抛物线 P(v) = F₀·v −（F₀/v₀）·v² */
function powerAt(f0: number, v0: number, v: number): number {
  return f0 * v - (f0 / v0) * v * v;
}

/**
 * 计算力-速度-功率剖面（MORIN/Samozino 方法）
 * 前置条件：已通过 validateFVPInputs 校验
 */
export function calculateFVP(inputs: FVPInputs): FVPResult {
  const { mode, bodyMass, f0, v0, sopt, r2 } = inputs;

  const f0Rel = f0 / bodyMass;              // N/kg
  const pmax = (f0 * v0) / 4;               // W
  const pmaxRel = pmax / bodyMass;          // W/kg
  const sfv = -(f0 / v0);                   // N·s/m（绝对斜率）
  const sfvRel = -(f0Rel / v0);             // s⁻¹（相对斜率）

  const vOpt = v0 / 2;
  const fOpt = f0 / 2;

  // 力速失衡指数：FVimb = 100 × |1 − SFV/SFV_opt|
  const ratio = sfvRel / sopt;              // 两者均为负值
  const fvimb = Math.abs(1 - ratio) * 100;

  // 剖面类型判定（±10% 视为平衡，与文献分类一致）
  let profileType: ProfileType;
  let profileLabel: string;
  let profileDesc: string;
  if (ratio > 1.1) {
    profileType = 'force-dominant';
    profileLabel = '力主导（速度缺陷）';
    profileDesc =
      '实际力-速度斜率比参考最优更陡，力量能力强而速度能力相对不足。训练应优先发展最大收缩速度与爆发力，将剖面右移趋近最优。';
  } else if (ratio < 0.9) {
    profileType = 'velocity-dominant';
    profileLabel = '速度主导（力量缺陷）';
    profileDesc =
      '实际力-速度斜率比参考最优更平，速度能力强而最大力量相对不足。训练应优先发展最大力量（F₀），将剖面左移趋近最优。';
  } else {
    profileType = 'balanced';
    profileLabel = '平衡（力速均衡）';
    profileDesc =
      '实际力-速度斜率接近参考最优，力与速度能力均衡。训练重点应放在整体提升最大功率 Pmax（剖面整体右移）。';
  }

  // 最优功率区：P(v) ≥ 90% Pmax → 4x² − 4x + 0.9 = 0 的两根
  const x1 = (4 - Math.sqrt(1.6)) / 8; // ≈ 0.3419
  const x2 = (4 + Math.sqrt(1.6)) / 8; // ≈ 0.6581
  const power90 = { vMin: x1 * v0, vMax: x2 * v0 };

  // 分级功率区间
  const zones: FVPZone[] = [
    { name: '低功率区', vMin: 0, vMax: power90.vMin, pMin: 0, pMax: powerAt(f0, v0, power90.vMin), desc: '低速度高力输出区间，功率输出低于峰值的 90%，适用于力量-速度谱系的力端训练' },
    { name: '最优功率区', vMin: power90.vMin, vMax: power90.vMax, pMin: powerAt(f0, v0, power90.vMin), pMax: powerAt(f0, v0, power90.vMax), desc: '功率输出 ≥ 最大功率的 90%，是发展最大功率的最优速度区间（约 34%–66% v₀）' },
    { name: '高功率区', vMin: power90.vMax, vMax: v0, pMin: powerAt(f0, v0, power90.vMax), pMax: 0, desc: '高速度低力输出区间，功率输出随速度增大而下降，适用于速度端训练' },
  ];

  // 最佳力速曲线（F-Vopt）：与实测曲线共享最大功率点（v₀/2, F₀/2），
  // 斜率取参考最优值 SFV_opt。力轴为绝对力（N），故需将相对最优斜率
  // （s⁻¹，按体重归一化）换算为绝对斜率（N·s/m）：absSopt = sopt × 体重
  //   F_opt(v) = F₀/2 + absSopt·(v − v₀/2)
  const absSopt = sopt * bodyMass;          // 绝对最优斜率（N·s/m，负值）
  const f0Opt = f0 / 2 - absSopt * (v0 / 2); // v = 0 时的理论最大力（N）
  const v0Opt = vOpt - fOpt / absSopt;       // F = 0 时的理论最大速度（m/s）

  // 实测力-速度曲线数据点（v 从 0 到 v₀，末端力 = 0，即与横轴交点）
  const curve: { v: number; f: number; p: number }[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const v = (v0 * i) / steps;
    const f = f0 - (f0 / v0) * v;
    curve.push({ v, f, p: f * v });
  }

  // 最佳力速曲线独立数据点：v 延伸到最优最大速度 v0Opt（力 = 0 与横轴相交），
  // 超出交点后为 null 使曲线终止；并精确插入交点数据点（v0Opt, 0），
  // 确保曲线与横轴交点处与参考圆点无缝相接
  const maxV = Math.max(v0, v0Opt) * 1.06; // 图表横轴显示范围（含右侧留白）
  const curveOpt: { v: number; fOpt: number | null }[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = (maxV * i) / steps;
    const fOptVal = f0Opt + absSopt * v;
    curveOpt.push({ v, fOpt: v <= v0Opt ? fOptVal : null });
  }
  curveOpt.push({ v: v0Opt, fOpt: 0 });
  curveOpt.sort((a, b) => a.v - b.v);

  // 训练建议（Jiménez-Reyes et al. 2017 基于 FVimb 的个体化训练干预）
  const recommendations: string[] = [];
  if (profileType === 'force-dominant') {
    recommendations.push('优先发展速度能力（速度缺陷）：采用低负荷（< 30% 1RM）快速伸缩复合训练、抛掷类动作、负负荷（助力）与冲刺技术训练。');
    recommendations.push('训练目标：在不损失最大力量的前提下提高 v₀，使力-速度剖面斜率趋于平缓，向参考最优靠拢。');
  } else if (profileType === 'velocity-dominant') {
    recommendations.push('优先发展最大力量（力量缺陷）：采用大负荷（> 70% 1RM）深蹲/硬拉等力量训练，持续 6–12 周以提升 1RM 与 1RM/体重比。');
    recommendations.push('训练目标：提高 F₀，使力-速度剖面斜率变陡，向参考最优靠拢。');
  } else {
    recommendations.push('力速平衡良好：采用宽负荷谱系训练（大重量 + 最优负荷 + 低负荷爆发力），整体右移剖面以提升最大功率 Pmax。');
    recommendations.push('监测建议：定期复测剖面，保持 FVimb 在 ±10% 以内，同时关注 Pmax 的持续提升。');
  }
  if (fvimb > 40) {
    recommendations.push(`当前力速失衡指数较高（${fvimb.toFixed(0)}%），建议优先集中纠正失衡方向后再进入综合功率训练阶段。`);
  }

  return {
    mode,
    bodyMass,
    f0,
    f0Rel,
    v0,
    pmax,
    pmaxRel,
    sfv,
    sfvRel,
    sopt,
    fvimb,
    ratio,
    profileType,
    profileLabel,
    profileDesc,
    vOpt,
    fOpt,
    f0Opt,
    v0Opt,
    power90,
    zones,
    r2: r2 ?? null,
    curve,
    curveOpt,
    recommendations,
  };
}

/** 生成综合报告文本（性能指标 + 训练建议） */
export function buildFVPReport(result: FVPResult, athleteName?: string): string {
  const lines: string[] = [];
  const header = athleteName ? `${athleteName} — 力-速度-功率（FVP）剖面分析报告` : '力-速度-功率（FVP）剖面分析报告';
  lines.push(header);
  lines.push('='.repeat(header.length));
  lines.push(`测试模式：${result.mode === 'sprint' ? '水平冲刺' : '垂直跳跃'}`);
  lines.push(`体重：${result.bodyMass.toFixed(1)} kg`);
  lines.push('');
  lines.push('【剖面关键参数】');
  lines.push(`  理论最大力 F₀：${result.f0.toFixed(1)} N（${result.f0Rel.toFixed(1)} N/kg）`);
  lines.push(`  理论最大速度 v₀：${result.v0.toFixed(2)} m/s`);
  lines.push(`  最大功率 Pmax：${result.pmax.toFixed(0)} W（${result.pmaxRel.toFixed(1)} W/kg）`);
  lines.push(`  力-速度斜率 SFV：${result.sfvRel.toFixed(2)} s⁻¹（相对）；最优斜率 SFV_opt：${result.sopt.toFixed(2)} s⁻¹（相对，即绝对 ${(Math.abs(result.sopt) * result.bodyMass).toFixed(1)} N·s/m）`);
  lines.push(`  最佳力速曲线（F-Vopt）：F_opt = ${result.f0Opt.toFixed(1)} − ${(Math.abs(result.sopt) * result.bodyMass).toFixed(1)}·v（与实测曲线共享最大功率点，斜率取参考最优值）`);
  lines.push(`  最优功率速度：v = ${result.vOpt.toFixed(2)} m/s，F = ${result.fOpt.toFixed(0)} N`);
  lines.push(`  最优功率区（≥90% Pmax）：${result.power90.vMin.toFixed(2)} – ${result.power90.vMax.toFixed(2)} m/s`);
  if (result.r2 != null) {
    lines.push(`  线性拟合优度 R²：${result.r2.toFixed(3)}（建议 ≥ 0.95）`);
  }
  lines.push('');
  lines.push('【力速失衡分析】');
  lines.push(`  参考最优斜率 SFV_opt：${result.sopt.toFixed(2)} s⁻¹`);
  lines.push(`  力速失衡指数 FVimb：${result.fvimb.toFixed(1)}%`);
  lines.push(`  剖面类型：${result.profileLabel}`);
  lines.push(`  ${result.profileDesc}`);
  lines.push('');
  lines.push('【训练建议】');
  result.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  lines.push('');
  lines.push('依据：Samozino et al. 2012/2016；Morin & Samozino 2016；Jiménez-Reyes et al. 2017（Front. Physiol. 7:677）。');
  lines.push('注：本报告为基于输入参数的自动计算分析，具体训练安排请结合教练员专业判断与运动员实际情况。');
  return lines.join('\n');
}
