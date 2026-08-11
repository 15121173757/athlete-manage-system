/**
 * 运动科学工具箱 —— VO₂max 现场估算（Maximum Oxygen Uptake Estimation）
 *
 * 通过 5 种循证现场测试方法估算运动员最大摄氧量，无需实验室设备：
 *
 * 1. Cooper 12 分钟跑（Cooper 1968）
 *    VO₂max = (距离m − 504.9) / 44.73        —— 12 分钟内尽量跑远的现场测试
 * 2. 1.5 英里跑（Cooper 1968）
 *    VO₂max = 483 / 时间(min) + 3.5           —— 1.5 英里全力跑计时
 * 3. 6 分钟步行测试（6MWT，适用于耐力弱势/康复人群）
 *    VO₂max ≈ 0.03 × 距离m + 3.98             —— 次极量步行评估
 * 4. Astrand-Ryhming 次极量踏车法（Astrand & Ryhming 1954）
 *    功率-心率外推 + ≥35 岁年龄校正因子
 * 5. Bruce 跑台协议（Bruce et al. 1973）
 *    VO₂max = 14.8 − 1.379t + 0.451t² − 0.012t³（t 为测试时间 min）
 *
 * 输出：VO₂max（mL/kg/min）、性别+年龄对照分级（参考 ACSM Guidelines）、
 *       %VO₂max 训练强度带（5 区）、训练建议与结构化报告。
 */

// ============================================================
// 类型定义
// ============================================================

export type Vo2Method = 'cooper12' | 'mile15' | 'walk6' | 'astrand' | 'bruce';

/** 测试方法执行指南（指导用户正确开展所选测试方案） */
export interface MethodGuide {
  equipment: string[];                         // 所需设备/场地
  prep: string[];                              // 测试前准备
  steps: string[];                             // 实施步骤
  exec: { phase: string; action: string }[];   // 具体执行程序（阶段 → 操作）
  notes: string[];                             // 注意事项
  stop: string[];                              // 终止指征（安全红线）
}

export type Vo2MethodMeta = {
  key: Vo2Method;
  label: string;
  short: string;
  desc: string;
  formula: string;
  needEquip: string;
  targets: string;
  guide: MethodGuide;
};

export const VO2_METHODS: Vo2MethodMeta[] = [
  {
    key: 'cooper12',
    label: 'Cooper 12 分钟跑',
    short: '12 分钟跑',
    desc: '在跑道上 12 分钟内尽力奔跑，记录总距离，由距离直接换算 VO₂max。最经典、最常用的现场法。',
    formula: 'VO₂max = (距离m − 504.9) / 44.73',
    needEquip: '400m 跑道或 GPS',
    targets: '适合多数体能教练与团队测试',
    guide: {
      equipment: ['400m 标准跑道', '秒表 / 发令器', '距离记录表（或 GPS 手环）'],
      prep: [
        '测试前 48 小时避免大强度训练，保证充足睡眠与水分',
        '测试前 2-3 小时完成轻量进食，避免空腹或过饱',
        '确认无感冒、发热、过度疲劳等不适状态',
        '先进行 10-15 分钟慢跑 + 动态拉伸（高抬腿、后踢腿、弓步走）热身',
      ],
      steps: [
        '在起跑线就位，测试员讲解规则：12 分钟内尽最大努力跑出最远距离',
        '发令后开始，前 3 分钟找到稳定舒适的配速，避免起跑过猛',
        '第 4-8 分钟保持匀速输出，呼吸与步伐保持规律',
        '最后 2-3 分钟视体感逐步加速，冲刺至 12 分钟截止',
        '记录完成距离（整圈数 × 400m + 不足一圈的余段距离）',
        '结束后慢走 5 分钟过渡，再进行静态拉伸',
      ],
      exec: [
        { phase: '0-3 分钟', action: '建立配速，找到稳定节奏，勿过早冲刺' },
        { phase: '4-8 分钟', action: '保持匀速，均匀呼吸（两步一吸 / 两步一呼）' },
        { phase: '9-12 分钟', action: '逐步提速，最后 30-60 秒全力冲刺' },
      ],
      notes: [
        '配速以「能坚持跑完全程」为标准，中途改走会显著低估结果',
        '尽量贴内道跑，减少额外跑动距离',
        '高温、高湿天气暂停测试或改期进行',
      ],
      stop: ['胸闷、胸痛、头晕、眼前发黑', '呼吸极度困难无法继续', '恶心、呕吐或步态不稳'],
    },
  },
  {
    key: 'mile15',
    label: '1.5 英里跑',
    short: '1.5 英里跑',
    desc: '1.5 英里（约 2414m）全力跑计时，由完成时间估算 VO₂max。',
    formula: 'VO₂max = 483 / 时间(min) + 3.5',
    needEquip: '400m 跑道或 GPS',
    targets: '适合中长跑与间歇类项目运动员',
    guide: {
      equipment: ['400m 标准跑道（1.5 英里 ≈ 2414m ≈ 6 圈 + 14m）', '秒表', '里程标记/锥桶'],
      prep: [
        '测试前 48 小时避免大强度训练，保证睡眠与水分',
        '测试前 2-3 小时轻量进食，充分热身（慢跑 + 动态拉伸）',
        '确认跑道清晰标记 1.5 英里起终点',
      ],
      steps: [
        '受试者在起点就位，测试员说明规则：以最快速度跑完 1.5 英里',
        '发令后开始，按与比赛相近的匀速策略分配体力',
        '前 400m 控制节奏，中间保持稳定配速，最后 400m 全力加速',
        '到达终点立即停表，记录总用时（分:秒）',
        '慢走 5 分钟恢复后静态拉伸',
      ],
      exec: [
        { phase: '第 1 圈', action: '建立目标配速，勿因兴奋加速过快' },
        { phase: '第 2-5 圈', action: '保持配速稳定，节奏呼吸' },
        { phase: '最后 1 圈', action: '全力冲刺至终点' },
      ],
      notes: [
        '中途改走会显著高估完成时间、低估 VO₂max',
        '起跑过猛容易导致后程严重掉速，建议前 400m 略慢于目标配速',
        '计时误差控制在 1 秒以内，使用手动停表需两名测试员交叉计时',
      ],
      stop: ['胸闷、胸痛、头晕、眼前发黑', '呼吸极度困难无法继续', '恶心、呕吐或步态不稳'],
    },
  },
  {
    key: 'walk6',
    label: '6 分钟步行测试',
    short: '6 分钟步行',
    desc: '6 分钟内尽量快速步行，记录距离。次极量负荷，适合耐力弱势、术后康复或高龄人群。',
    formula: 'VO₂max ≈ 0.03 × 距离m + 3.98',
    needEquip: '30-50m 平直走道',
    targets: '康复期/耐力弱势人群',
    guide: {
      equipment: ['30-50m 平直无障走道（两端标记 + 每 5m 刻度）', '计时器', '里程记录表'],
      prep: [
        '适用于耐力弱势、术后康复、高龄人群；健康运动员建议改用跑测法',
        '穿舒适步行鞋，测试前充分休息、避免饱腹',
        '测试员说明规则并演示折返点动作',
      ],
      steps: [
        '受试者站于起点，测试员发令后开始尽快行走',
        '在两端标记处折返，走完一段测试员以标准语句鼓励',
        '测试员每 30 秒报时一次，提醒剩余时间',
        '6 分钟到时发出停止口令，受试者原地站立',
        '记录最后位置距离（整程 × 程长 + 余段估算）',
        '结束后坐下休息，监测心率与主观疲劳',
      ],
      exec: [
        { phase: '0-2 分钟', action: '以舒适快速步行起步，建立稳定步频' },
        { phase: '3-4 分钟', action: '保持步频，如可承受可略微提速' },
        { phase: '5-6 分钟', action: '尽最大能力完成最后阶段' },
      ],
      notes: [
        '允许减速与短暂停顿，但停歇时间应尽量少，否则影响结果',
        '测试全程需有人监护，出现不适立即停止',
        '步行法为次极量估算，结果较跑测法偏低属预期',
      ],
      stop: ['胸痛、呼吸困难', '头晕、面色苍白、大量出汗', '下肢抽筋或步态不稳'],
    },
  },
  {
    key: 'astrand',
    label: 'Astrand-Ryhming 踏车法',
    short: '次极量踏车法',
    desc: '在功率自行车上以固定功率骑行 6 分钟至稳态，记录稳态心率，通过功率-心率线性关系外推 VO₂max，≥35 岁加年龄校正。',
    formula: '功率-心率线性外推（Astrand 1954）',
    needEquip: '功率自行车 + 心率带',
    targets: '室内/无跑道场景',
    guide: {
      equipment: ['功率自行车（带功率显示）', '心率带 / 心率监测仪', '秒表'],
      prep: [
        '按性别与训练水平选择起始功率：男未训练 100-150W、男训练者 150-200W；女未训练 75-100W、女训练者 100-150W',
        '测试前避免咖啡因与剧烈活动，静坐 5 分钟记录静息心率',
        '说明规则：以恒定功率、恒定踏频连续蹬车 6 分钟至心率稳态',
      ],
      steps: [
        '设定目标功率，以 50-60 rpm 恒定踏频开始蹬车',
        '前 2-3 分钟心率逐步上升，之后趋于平稳',
        '第 5-6 分钟记录心率，前后 1 分钟差值 ≤ 6 bpm 视为达到稳态',
        '稳态心率应落在 120-170 bpm（约最大心率 65-85%）；过低则加大功率、过高则降低功率后重新测试',
        '测试结束逐渐减负荷蹬车 2-3 分钟冷身',
      ],
      exec: [
        { phase: '0-2 分钟', action: '恒定踏频蹬车，心率上升期' },
        { phase: '3-5 分钟', action: '心率趋于稳态，保持功率与踏频不变' },
        { phase: '第 6 分钟', action: '记录稳态心率（前后 1 分钟差值 ≤ 6 bpm）' },
      ],
      notes: [
        '心率未达稳态时延长至 8-10 分钟再记录',
        '踏频变化会显著影响结果，必须保持恒定',
        '功率选择不当导致稳态心率 < 120 或 > 170 时，需调整功率后重测',
      ],
      stop: ['心率异常上升或胸闷、眩晕', '呼吸极度困难', '腿部肌肉痉挛无法继续'],
    },
  },
  {
    key: 'bruce',
    label: 'Bruce 跑台协议',
    short: '跑台递增负荷',
    desc: '多级递增跑台测试，记录达到力竭或目标心率的时间，由多项式回归估算 VO₂max。',
    formula: 'VO₂max = 14.8 − 1.379t + 0.451t² − 0.012t³',
    needEquip: '电动跑步机',
    targets: '有条件配备跑步机的团队',
    guide: {
      equipment: ['电动跑步机（可调速度与坡度）', '心率监测仪', '秒表 + 安全扶手'],
      prep: [
        '向受试者说明各级速度/坡度与安全终止方式（双手扶两侧扶手减速停机）',
        '≥ 35 岁或有心血管危险因素者建议在医疗监护下进行',
        '穿跑步鞋，跑步机后方保持空旷安全',
      ],
      steps: [
        'Stage 1：2.7 km/h、坡度 10%，持续 3 分钟',
        'Stage 2：4.0 km/h、坡度 12%，持续 3 分钟',
        'Stage 3：5.5 km/h、坡度 14%，持续 3 分钟',
        'Stage 4：6.8 km/h、坡度 16%，持续 3 分钟',
        'Stage 5+：依次提高至 8.0/8.8/9.7 km/h、坡度 18/20/22%',
        '跑至力竭或出现终止指征时停止，记录总测试时间（含未完成分级）',
      ],
      exec: [
        { phase: 'Stage 1-2', action: '热身与适应，评估受试者状态' },
        { phase: 'Stage 3-4', action: '负荷显著增加，鼓励坚持并持续监测心率' },
        { phase: 'Stage 5+', action: '接近极限，随时准备终止并记录时间' },
      ],
      notes: [
        '速度与坡度必须按表逐级递增，不可跳级',
        '以鼓励为主但不强行坚持，注意步态与表情变化',
        '终止后跑步机减速归零，受试者扶扶手缓慢下机',
      ],
      stop: ['胸痛、心悸或血压异常', '头晕、眼前发黑、面色苍白', '步态不稳、极度气促或主动要求停止'],
    },
  },
];

export type Sex = 'MALE' | 'FEMALE';

/** 有氧能力分级（参考 ACSM Guidelines 性别+年龄对照） */
export const GRADING_TABLE: {
  sex: Sex;
  ageFrom: number;
  ageTo: number;
  /** 五档下界（mL/kg/min）：差→偏差→中等→良好→优秀 */
  thresholds: [number, number, number, number, number];
}[] = (() => {
  const rows: { sex: Sex; thresholds: [number, number, number, number, number] }[] = [
    { sex: 'MALE', thresholds: [32, 38, 45, 55, 999] },
    { sex: 'FEMALE', thresholds: [28, 33, 40, 48, 999] },
  ];
  // 年龄修正（每增 10 岁各档下移约 4 mL/kg/min，近似 ACSM 变化趋势）
  const ageBands: { from: number; to: number; shift: number }[] = [
    { from: 20, to: 29, shift: 0 },
    { from: 30, to: 39, shift: 4 },
    { from: 40, to: 49, shift: 7 },
    { from: 50, to: 59, shift: 10 },
  ];
  const out: typeof GRADING_TABLE = [];
  for (const r of rows) {
    for (const b of ageBands) {
      const thresholds = r.thresholds.map((t, i) => (i < 4 ? t - b.shift : 999)) as [number, number, number, number, number];
      out.push({ sex: r.sex, ageFrom: b.from, ageTo: b.to, thresholds });
    }
  }
  return out;
})();

export const GRADING_LABELS = ['差', '偏差', '中等', '良好', '优秀'] as const;

export const ELITE_REF = { MALE: 55, FEMALE: 48 } as const; // 精英参考（mL/kg/min）

/** %VO₂max 训练强度带（强度层级术语统一：极低/低/中等/高/极高） */
export const INTENSITY_ZONES: {
  key: string;
  name: string;
  pct: [number, number];
  desc: string;
}[] = [
  { key: 'R1', name: '恢复区', pct: [50, 60], desc: '极低强度：主动恢复与放松跑，用于大强度训练后身体恢复' },
  { key: 'Z1', name: '有氧基础区', pct: [60, 70], desc: '低强度：发展有氧基础与脂肪代谢能力，积累训练量' },
  { key: 'Z2', name: '有氧发展区', pct: [70, 80], desc: '中等强度：提升最大有氧输出与乳酸阈值' },
  { key: 'Z3', name: '阈值区', pct: [80, 90], desc: '高强度：阈值速度/功率附近节奏训练，提升乳酸清除能力' },
  { key: 'Z4', name: '高强度区间', pct: [90, 100], desc: '极高强度：大强度间歇（HIIT），刺激 VO₂max 峰值' },
];

// ============================================================
// 输入与输出类型
// ============================================================

/** 共用基础输入 */
export interface BaseInput {
  sex: Sex;
  age: number;             // 岁
  weight: number;          // kg（Astrand 法需要）
  restHR?: number | '';    // 静息心率（可选，用于强度带心率估算）
}

export type MethodInput =
  | { method: 'cooper12'; distance: number }                       // 距离 m
  | { method: 'mile15'; minutes: number; seconds: number }         // 时间 min:ss
  | { method: 'walk6'; distance: number }                          // 距离 m
  | { method: 'astrand'; power: number; steadyHR: number }         // 功率 W、稳态心率
  | { method: 'bruce'; minutes: number; seconds: number };         // 总时间 min:ss

export interface ZoneRow {
  key: string;
  name: string;
  pct: [number, number];
  vo2Range: [number, number];        // 对应 VO₂max 目标值
  hrRange: [number, number] | null;  // 对应目标心率（有静息心率时用 Karvonen）
  desc: string;
}

export interface Vo2Result {
  methodKey: Vo2Method;
  methodLabel: string;
  vo2max: number;                    // mL/kg/min
  vo2maxL: number | null;            // L/min（有体重时）
  gradeIndex: number;                // 0-4
  gradeLabel: string;
  gradeDesc: string;
  notes: string[];
  zones: ZoneRow[];
  report: string;
}

// ============================================================
// 分级
// ============================================================

export function getGrade(sex: Sex, age: number, vo2max: number): { index: number; label: string; desc: string } {
  const clampedAge = Math.min(59, Math.max(20, age));
  const row = GRADING_TABLE.find((g) => g.sex === sex && clampedAge >= g.ageFrom && clampedAge <= g.ageTo);
  const thresholds = row?.thresholds ?? [32, 38, 45, 55, 999];
  let index = 0;
  if (vo2max >= thresholds[3]) index = 4;
  else if (vo2max >= thresholds[2]) index = 3;
  else if (vo2max >= thresholds[1]) index = 2;
  else if (vo2max >= thresholds[0]) index = 1;

  const label = GRADING_LABELS[index];
  const elite = ELITE_REF[sex];
  let desc = '';
  if (index >= 3) desc = `有氧能力处于${label}水平，具备承担高强度有氧训练与长间歇负荷的条件`;
  else if (index === 2) desc = `有氧能力中等，建议以有氧基础区训练为主逐步提升`;
  else desc = `有氧能力偏低，建议优先开展低强度有氧基础建设并监控恢复`;
  if (vo2max >= elite) desc += `，已达到${sex === 'MALE' ? '男性' : '女性'}精英参考水平（≥${elite}）`;
  return { index, label, desc };
}

// ============================================================
// 各方法公式
// ============================================================

export function estimateVo2max(method: MethodInput, base: BaseInput): { vo2max: number; notes: string[] } {
  const notes: string[] = [];
  let vo2max = 0;

  switch (method.method) {
    case 'cooper12': {
      if (method.distance <= 0) throw new Error('请填写 12 分钟跑距离');
      vo2max = (method.distance - 504.9) / 44.73;
      notes.push(`12 分钟跑距离 ${method.distance} m → Cooper 公式 VO₂max = (${method.distance} − 504.9) / 44.73`);
      break;
    }
    case 'mile15': {
      const t = method.minutes + method.seconds / 60;
      if (t <= 0) throw new Error('请填写 1.5 英里跑完成时间');
      vo2max = 483 / t + 3.5;
      notes.push(`1.5 英里跑 ${method.minutes}′${String(method.seconds).padStart(2, '0')}″（${t.toFixed(2)} min）→ VO₂max = 483 / ${t.toFixed(2)} + 3.5`);
      break;
    }
    case 'walk6': {
      if (method.distance <= 0) throw new Error('请填写 6 分钟步行距离');
      vo2max = 0.03 * method.distance + 3.98;
      notes.push(`6 分钟步行 ${method.distance} m → VO₂max ≈ 0.03 × ${method.distance} + 3.98`);
      notes.push('本方法为次极量步行估算，适用于耐力弱势/康复人群；对健康运动员结果偏保守，建议使用跑测法');
      break;
    }
    case 'astrand': {
      if (method.power <= 0 || method.steadyHR <= 0) throw new Error('请填写功率与稳态心率');
      if (base.weight <= 0) throw new Error('Astrand 法需要填写体重');
      // 功当量摄氧（L/min）：Astrand 功当量系数（自行车）
      const vo2Work = base.sex === 'MALE' ? 0.014 * method.power + 0.3 : 0.0125 * method.power + 0.28;
      const hrMax = 220 - base.age;
      const hrRest = typeof base.restHR === 'number' && base.restHR > 0 ? base.restHR : 60;
      // 次极量线性外推至最大心率
      let vo2maxL = vo2Work * ((hrMax - hrRest) / (method.steadyHR - hrRest));
      // Astrand 年龄校正因子（≥35 岁）
      if (base.age >= 35) {
        const factors: [number, number][] = [[35, 0.87], [40, 0.83], [45, 0.78], [50, 0.75], [55, 0.71]];
        let f = 0.87;
        for (const [a, fac] of factors) if (base.age >= a) f = fac;
        vo2maxL *= f;
        notes.push(`年龄校正（≥35 岁，Astrand 校正因子 ${f}）`);
      }
      vo2max = vo2maxL * 1000 / base.weight;
      notes.push(
        `踏车 ${method.power} W、稳态心率 ${method.steadyHR} bpm → 功率当量摄氧 ${vo2Work.toFixed(2)} L/min，外推 VO₂max ${vo2maxL.toFixed(2)} L/min`
      );
      notes.push(`VO₂max = ${vo2maxL.toFixed(2)} L/min ÷ ${base.weight} kg × 1000`);
      break;
    }
    case 'bruce': {
      const t = method.minutes + method.seconds / 60;
      if (t <= 0) throw new Error('请填写跑台测试时间');
      vo2max = 14.8 - 1.379 * t + 0.451 * t * t - 0.012 * t * t * t;
      notes.push(`Bruce 跑台完成时间 ${method.minutes}′${String(method.seconds).padStart(2, '0')}″（${t.toFixed(2)} min）→ VO₂max = 14.8 − 1.379t + 0.451t² − 0.012t³`);
      break;
    }
  }

  if (!Number.isFinite(vo2max) || vo2max <= 0) {
    throw new Error('估算结果异常，请检查输入数据');
  }
  return { vo2max: Math.round(vo2max * 10) / 10, notes };
}

// ============================================================
// 强度带与报告
// ============================================================

export function buildZones(vo2max: number, base: BaseInput): ZoneRow[] {
  const hrMax = 220 - base.age;
  const restHR = typeof base.restHR === 'number' && base.restHR > 0 ? base.restHR : null;
  return INTENSITY_ZONES.map((z) => {
    const lo = Math.round(vo2max * z.pct[0] / 100);
    const hi = Math.round(vo2max * z.pct[1] / 100);
    let hrRange: [number, number] | null = null;
    if (restHR) {
      // Karvonen 法：目标心率 = 静息 + % × (最大 − 静息)，% 取区间端点
      const hrLo = Math.round(restHR + (z.pct[0] / 100) * (hrMax - restHR));
      const hrHi = Math.round(restHR + (z.pct[1] / 100) * (hrMax - restHR));
      hrRange = [hrLo, hrHi];
    }
    return { key: z.key, name: z.name, pct: z.pct, vo2Range: [lo, hi], hrRange, desc: z.desc };
  });
}

export function buildReport(
  base: BaseInput,
  methodLabel: string,
  vo2max: number,
  vo2maxL: number | null,
  grade: { index: number; label: string; desc: string },
  notes: string[],
  zones: ZoneRow[]
): string {
  const lines: string[] = [];
  const banner = '═'.repeat(38); // 76 个半角宽，作为标题居中的参照宽度
  lines.push(banner);
  // 标题按显示宽度居中（全角字符按 2 个半角计，使混排文本视觉居中）
  const title = 'VO₂max 最大摄氧量评估报告';
  const titleWidth = [...title].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  lines.push(' '.repeat(Math.max(1, Math.floor((banner.length * 2 - titleWidth) / 2))) + title);
  lines.push(banner);
  lines.push(`评估方法：${methodLabel}`);
  lines.push(`性别：${base.sex === 'MALE' ? '男' : '女'}  年龄：${base.age} 岁  ${base.weight > 0 ? `体重：${base.weight} kg` : ''}`);
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('【一、评估结果】');
  lines.push(`  VO₂max：${vo2max} mL/kg/min${vo2maxL ? `（${vo2maxL.toFixed(2)} L/min）` : ''}`);
  lines.push(`  有氧能力分级：${grade.label}（精英参考 ${ELITE_REF[base.sex]} mL/kg/min）`);
  lines.push(`  ${grade.desc}`);
  notes.forEach((n) => lines.push(`  · ${n}`));
  lines.push('');
  lines.push('【二、%VO₂max 训练强度带】');
  zones.forEach((z) => {
    const hrTxt = z.hrRange ? `，目标心率 ${z.hrRange[0]}-${z.hrRange[1]} bpm（Karvonen）` : '';
    lines.push(
      `  ${z.key} ${z.name}（${z.pct[0]}-${z.pct[1]}% VO₂max）：目标 VO₂max ${z.vo2Range[0]}-${z.vo2Range[1]} mL/kg/min${hrTxt} —— ${z.desc}`
    );
  });
  lines.push('');
  lines.push('【三、训练建议】');
  const g = grade.index;
  if (g >= 3) lines.push('  以有氧发展区（70-80%）与阈值区（80-90%）训练为主，维持高水平有氧能力');
  else if (g === 2) lines.push('  以有氧基础区（60-70%）为主积累基础量，每周安排 1-2 次发展区训练');
  else lines.push('  从恢复区（50-60%）与有氧基础区（60-70%）起步，循序渐进增加训练量');
  if (vo2max < 30) lines.push('  建议先经 6-8 周低强度有氧基础训练后复测，避免过早高强度刺激');
  lines.push('  极高强度间歇（Z4 区）每周不超过 2 次，并与充足恢复间隔安排');
  lines.push('');
  lines.push('══════════════════════════════════════');
  lines.push('依据：Cooper(1968) 现场测试法；Astrand & Ryhming(1954) 次极量踏车法；');
  lines.push('Bruce et al.(1973) 跑台协议；ACSM Guidelines 性别+年龄分级参考。');
  lines.push('现场估算法存在约 ±10% 误差，用于训练分级参考，不替代实验室直接测定。');
  return lines.join('\n');
}

/** 结构化报告分节（供 PDF 导出排版） */
export function buildReportSections(
  base: BaseInput,
  methodLabel: string,
  vo2max: number,
  vo2maxL: number | null,
  grade: { index: number; label: string; desc: string },
  notes: string[],
  zones: ZoneRow[]
): { heading: string; lines: string[] }[] {
  return [
    {
      heading: '一、评估结果',
      lines: [
        `评估方法：${methodLabel}`,
        `性别：${base.sex === 'MALE' ? '男' : '女'}  年龄：${base.age} 岁${base.weight > 0 ? `  体重：${base.weight} kg` : ''}`,
        `VO₂max：${vo2max} mL/kg/min${vo2maxL ? `（${vo2maxL.toFixed(2)} L/min）` : ''}`,
        `有氧能力分级：${grade.label}（精英参考 ${ELITE_REF[base.sex]} mL/kg/min）`,
        grade.desc,
        ...notes.map((n) => `· ${n}`),
      ],
    },
    {
      heading: '二、%VO₂max 训练强度带',
      lines: zones.map(
        (z) =>
          `${z.key} ${z.name}（${z.pct[0]}-${z.pct[1]}% VO₂max）：目标 VO₂max ${z.vo2Range[0]}-${z.vo2Range[1]} mL/kg/min${
            z.hrRange ? `，目标心率 ${z.hrRange[0]}-${z.hrRange[1]} bpm（Karvonen）` : ''
          } —— ${z.desc}`
      ),
    },
    {
      heading: '三、训练建议',
      lines: (() => {
        const g = grade.index;
        const list: string[] = [];
        if (g >= 3) list.push('以有氧发展区（70-80%）与阈值区（80-90%）训练为主，维持高水平有氧能力');
        else if (g === 2) list.push('以有氧基础区（60-70%）为主积累基础量，每周安排 1-2 次发展区训练');
        else list.push('从恢复区（50-60%）与有氧基础区（60-70%）起步，循序渐进增加训练量');
        if (vo2max < 30) list.push('建议先经 6-8 周低强度有氧基础训练后复测，避免过早高强度刺激');
        list.push('极高强度间歇（Z4 区）每周不超过 2 次，并与充足恢复间隔安排');
        return list;
      })(),
    },
  ];
}
