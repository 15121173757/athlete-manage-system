/**
 * 运动科学工具箱 —— 基于心率的训练强度设定
 *
 * 三种模型：
 * 1. Karvonen 模型：基于储备心率（HRR = HRmax − HRrest）
 * 2. Joe Friel 模型：基于乳酸阈值心率（LTHR）
 * 3. Max HR 模型：基于最大心率百分比（系统兜底方案）
 *
 * 最大心率统一采用公式：HRmax = 208 −（0.7 × 年龄）
 */

export type HRModel = 'karvonen' | 'friel' | 'maxhr';

export interface HRModelMeta {
  key: HRModel;
  name: string;
  formula: string;
  desc: string;
}

/** 强度级别 */
export interface HRZone {
  name: string;
  pctLabel: string;
  hrMin: number | null;
  hrMax: number | null;
  description: string;
}

export interface HRZoneResult {
  model: HRModel;
  hrMax: number;
  /** 仅 Friel 模型使用：实际采用的阈值心率（手动输入或估算值） */
  lthrUsed: number | null;
  /** 阈值心率是否为估算值（按 HRmax × 90%） */
  lthrEstimated: boolean;
  zones: HRZone[];
}

export interface HRInputs {
  /** 年龄（岁） */
  age: number;
  /** 静息心率（次/分） */
  restHR: number;
  /** 阈值心率（次/分，Friel 模型用，可选） */
  lthr?: number | null;
}

/** 模型说明（供 UI 展示） */
export const HR_MODELS: HRModelMeta[] = [
  {
    key: 'karvonen',
    name: 'Karvonen 模型',
    formula: '目标心率 =（HRmax − 静息心率）× 强度% + 静息心率',
    desc: '基于储备心率（HRR），考虑个体静息心率差异，适用于普通人群与耐力训练，是运动处方最常用的强度设定方法。',
  },
  {
    key: 'friel',
    name: 'Joe Friel 模型',
    formula: '目标心率 = 阈值心率（LTHR）× 强度%',
    desc: '基于乳酸阈值心率（LTHR），强度区间更贴合耐力运动员的实际配速，广泛用于耐力项目周期化训练。',
  },
  {
    key: 'maxhr',
    name: 'Max HR 模型',
    formula: '目标心率 = HRmax × 强度%',
    desc: '基于最大心率百分比的传统方法，无需静息心率，作为系统兜底方案，适用于无法测定阈值心率的场景。',
  },
];

/** HRmax = 208 −（0.7 × 年龄），取整 */
export function calculateHRMax(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/** 输入校验，返回中文错误信息列表（空数组表示通过） */
export function validateHRInputs(model: HRModel, inputs: HRInputs): string[] {
  const errors: string[] = [];
  const { age, restHR, lthr } = inputs;

  if (!Number.isFinite(age) || age < 10 || age > 100) {
    errors.push('年龄须为 10–100 岁的整数');
  }
  if (!Number.isFinite(restHR) || restHR < 30 || restHR > 200) {
    errors.push('静息心率须在 30–200 次/分之间');
  }

  if (errors.length === 0) {
    const hrMax = calculateHRMax(age);
    if (restHR >= hrMax) {
      errors.push('静息心率不能高于或等于最大心率');
    }
  }

  if (model === 'friel' && lthr != null && lthr !== undefined) {
    if (!Number.isFinite(lthr) || lthr < 60 || lthr > 250) {
      errors.push('阈值心率须在 60–250 次/分之间');
    } else {
      const hrMax = calculateHRMax(age);
      if (lthr >= hrMax) {
        errors.push('阈值心率应低于最大心率');
      }
      if (lthr <= restHR) {
        errors.push('阈值心率应高于静息心率');
      }
    }
  }

  return errors;
}

/** 按百分比区间计算心率范围（下限/上限，null 表示开放边界） */
function range(calc: (pct: number) => number, min: number | null, max: number | null) {
  return {
    hrMin: min == null ? null : Math.round(calc(min)),
    hrMax: max == null ? null : Math.round(calc(max)),
  };
}

function pctLabel(min: number | null, max: number | null): string {
  if (min == null) return `≤ ${Math.round((max ?? 1) * 100)}%`;
  if (max == null) return `≥ ${Math.round(min * 100)}%`;
  return `${Math.round(min * 100)}–${Math.round(max * 100)}%`;
}

// ============================================================
// 三种模型的强度级别定义（运动科学专业规范）
// ============================================================

/** Karvonen：储备心率百分比（ACSM 强度分级） */
const KARVONEN_ZONES: { name: string; pct: [number, number]; desc: string }[] = [
  { name: 'Z1 恢复区', pct: [0.5, 0.6], desc: '低强度有氧恢复，用于热身、整理放松与恢复日训练' },
  { name: 'Z2 有氧基础区', pct: [0.6, 0.7], desc: '有氧基础耐力，长时间持续训练，发展心肺功能与脂肪供能能力' },
  { name: 'Z3 有氧耐力区', pct: [0.7, 0.8], desc: '有氧耐力提升与节奏训练，改善乳酸清除与运动经济性' },
  { name: 'Z4 乳酸阈值区', pct: [0.8, 0.9], desc: '乳酸阈值附近训练，提高阈值速度/功率与耐乳酸能力' },
  { name: 'Z5 无氧区', pct: [0.9, 1.0], desc: '高强度无氧训练，发展最大摄氧量（VO₂max）与冲刺能力' },
];

/** Joe Friel：乳酸阈值心率百分比（《Triathlete's Training Bible》） */
const FRIEL_ZONES: { name: string; pct: [number | null, number | null]; desc: string }[] = [
  { name: 'Z1 积极恢复区', pct: [null, 0.81], desc: '低强度主动恢复，促进血液循环与疲劳消除' },
  { name: 'Z2 有氧耐力区', pct: [0.81, 0.89], desc: '有氧耐力基础，长距离低强度训练，发展脂肪供能与耐力' },
  { name: 'Z3 节奏区', pct: [0.9, 0.93], desc: '节奏与力量耐力训练，介于有氧与阈值之间的配速' },
  { name: 'Z4 乳酸阈值区', pct: [0.94, 0.99], desc: '乳酸阈值训练，提升乳酸阈值与比赛配速能力' },
  { name: 'Z5 无氧区', pct: [1.0, null], desc: '最大摄氧量与无氧训练，短时高强度间歇（含 5a/5b/5c）' },
];

/** Max HR：最大心率百分比（传统分级，系统兜底） */
const MAXHR_ZONES: { name: string; pct: [number, number]; desc: string }[] = [
  { name: 'Z1 恢复区', pct: [0.5, 0.6], desc: '低强度恢复，用于热身与整理放松' },
  { name: 'Z2 有氧基础区', pct: [0.6, 0.7], desc: '基础有氧训练，长时间持续，发展基础耐力' },
  { name: 'Z3 有氧耐力区', pct: [0.7, 0.8], desc: '有氧耐力与配速训练，提升有氧工作能力' },
  { name: 'Z4 阈值区', pct: [0.8, 0.9], desc: '乳酸阈值训练，提高耐乳酸与阈值能力' },
  { name: 'Z5 无氧区', pct: [0.9, 1.0], desc: '高强度无氧训练，发展最大运动能力' },
];

/**
 * 计算指定模型下的训练心率强度区间
 * 前置条件：已通过 validateHRInputs 校验
 */
export function calculateHRZones(model: HRModel, inputs: HRInputs): HRZoneResult {
  const hrMax = calculateHRMax(inputs.age);

  // 各模型的心率换算函数：强度百分比 → 目标心率
  const calcMap: Record<HRModel, (pct: number) => number> = {
    karvonen: (pct) => inputs.restHR + (hrMax - inputs.restHR) * pct,
    maxhr: (pct) => hrMax * pct,
    friel: (pct) => {
      // Friel 基于阈值心率；未提供时按 HRmax × 90% 估算
      const lthr = inputs.lthr ?? Math.round(hrMax * 0.9);
      return lthr * pct;
    },
  };

  let lthrUsed: number | null = null;
  let lthrEstimated = false;
  if (model === 'friel') {
    lthrUsed = inputs.lthr ?? Math.round(hrMax * 0.9);
    lthrEstimated = inputs.lthr == null;
  }

  const calc = calcMap[model];
  const sourceZones =
    model === 'karvonen' ? KARVONEN_ZONES : model === 'friel' ? FRIEL_ZONES : MAXHR_ZONES;

  const zones: HRZone[] = sourceZones.map((z) => {
    const [min, max] = z.pct;
    const { hrMin, hrMax } = range(calc, min, max);
    return {
      name: z.name,
      pctLabel: pctLabel(min, max),
      hrMin,
      hrMax,
      description: z.desc,
    };
  });

  return { model, hrMax, lthrUsed, lthrEstimated, zones };
}
