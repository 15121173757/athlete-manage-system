/**
 * 运动科学工具箱 —— FMS 功能性动作筛查（Functional Movement Screen）
 *
 * 源自 Gray Cook & Lee Burton 的功能性动作筛查体系，通过 7 个基础动作模式
 * 评估受试者的动作质量与功能局限，识别损伤风险与左右不对称：
 *
 * 1. 深蹲（Deep Squat）               —— 对称性动作模式
 * 2. 跨栏步（Hurdle Step）            —— 单腿稳定与跨步模式
 * 3. 直线弓步蹲（In-line Lunge）      —— 矢状面稳定性
 * 4. 肩部灵活性（Shoulder Mobility）  —— 双肩活动度（含清除测试）
 * 5. 主动直腿抬高（Active Straight-Leg Raise）—— 骨盆稳定与腘绳肌柔韧
 * 6. 躯干稳定俯卧撑（Trunk Stability Push-up）—— 矢状面核心稳定（含清除测试）
 * 7. 旋转稳定性（Rotary Stability）   —— 多平面核心控制（含清除测试）
 *
 * 评分：每动作 0-3 分（3 完美 / 2 有代偿 / 1 无法完成 / 0 出现疼痛），总分 21 分。
 * 清除测试出现疼痛时，对应动作强制记 0 分。
 *
 * 输出：总分、逐项得分、左右不对称检测、风险分级（≤14 分循证阈值）、
 *       逐项改进训练建议与结构化报告（支持批量导入/导出）。
 */

// ============================================================
// 类型定义
// ============================================================

export type FmsTestKey =
  | 'deepSquat'
  | 'hurdleStep'
  | 'inLineLunge'
  | 'shoulderMobility'
  | 'activeStraightLegRaise'
  | 'trunkStabilityPushup'
  | 'rotaryStability';

export interface FmsTestDef {
  key: FmsTestKey;
  name: string;           // 动作名称
  short: string;          // 缩写（表格表头）
  en: string;             // 英文缩写
  icon: string;           // 显示图标（emoji）
  purpose: string;        // 评估目的
  bilateral: boolean;     // 是否分左右评分
  scoreGuide: Record<number, string>; // 0-3 分评分标准
}

export interface ClearingTestDef {
  key: 'shoulder' | 'spinal' | 'rocking';
  name: string;
  desc: string;
  linked: FmsTestKey;     // 疼痛时被清零的动作
}

export interface FmsScoreInput {
  deepSquat: number;                 // 0-3
  hurdleStep: { left: number; right: number };
  inLineLunge: { left: number; right: number };
  shoulderMobility: { left: number; right: number };
  activeStraightLegRaise: { left: number; right: number };
  trunkStabilityPushup: number;
  rotaryStability: { left: number; right: number };
}

export interface ClearingInput {
  shoulder: boolean;  // true = 无疼痛；false = 出现疼痛（SM 记 0）
  spinal: boolean;    // true = 无疼痛；false = 出现疼痛（TSPU 记 0）
  rocking: boolean;   // true = 无疼痛；false = 出现疼痛（RS 记 0）
}

export type RiskLevel = '低' | '中' | '高';

export interface FmsItemResult {
  test: FmsTestDef;
  composite: number;      // 计入总分的得分（单侧动作取左右低分）
  left: number;
  right: number;
  asymmetric: boolean;    // 单侧动作左右差 ≥ 1
  cleared: boolean;       // 关联清除测试是否无痛
}

export interface ScreeningAnalysis {
  athleteName: string;
  generatedAt: string;
  items: FmsItemResult[];
  total: number;              // 总分 0-21
  riskLevel: RiskLevel;
  riskNote: string;
  asymmetricTests: string[];  // 存在不对称的动作名
  painTests: string[];        // 出现疼痛（0 分）的动作名
  recommendations: string[];
}

export interface BatchRow {
  name: string;
  scores: FmsScoreInput;
  clearings: ClearingInput;
  analysis: ScreeningAnalysis;
}

export interface BatchResult {
  rows: BatchRow[];
  validCount: number;
  errors: { row: number; name: string; messages: string[] }[];
}

// ============================================================
// FMS 动作定义
// ============================================================

export const FMS_TESTS: FmsTestDef[] = [
  {
    key: 'deepSquat',
    name: '深蹲',
    short: '深蹲',
    en: 'Deep Squat',
    icon: '🏋️',
    purpose: '评估髋、膝、踝的双侧对称性、灵活性与躯干核心稳定控制',
    bilateral: false,
    scoreGuide: {
      3: '躯干与胫骨平行或近垂直，股骨低于水平面，双膝与双脚成一线，测试杆始终保持在双脚正上方',
      2: '垫 2×4 测试板后能完成，或足跟抬起、躯干过度前倾等代偿',
      1: '垫板后仍无法完成，或明显失去平衡',
      0: '完成过程中任何部位出现疼痛',
    },
  },
  {
    key: 'hurdleStep',
    name: '跨栏步',
    short: '跨栏',
    en: 'Hurdle Step',
    icon: '🚧',
    purpose: '评估单腿支撑下的髋、膝、踝矢状面稳定与跨步模式',
    bilateral: true,
    scoreGuide: {
      3: '髋、膝、踝保持矢状面直线对齐，躯干无明显晃动，测试杆与栏架保持平行',
      2: '对齐轻度偏移，或腰部出现明显代偿性移动',
      1: '触栏、失去平衡或躯干大幅晃动',
      0: '出现疼痛',
    },
  },
  {
    key: 'inLineLunge',
    name: '直线弓步蹲',
    short: '弓步',
    en: 'In-line Lunge',
    icon: '🤸',
    purpose: '评估矢状面分腿蹲模式的稳定、柔韧与身体控制',
    bilateral: true,
    scoreGuide: {
      3: '躯干无晃动，双足始终在测试板直线上，后膝准确触及前足跟后方板面',
      2: '躯干轻微晃动，或后膝未能完全触及板面',
      1: '无法保持弓步姿势或明显失去平衡',
      0: '出现疼痛',
    },
  },
  {
    key: 'shoulderMobility',
    name: '肩部灵活性',
    short: '肩部',
    en: 'Shoulder Mobility',
    icon: '🙆',
    purpose: '评估双侧肩关节内收-内旋与外展-外旋联合活动度',
    bilateral: true,
    scoreGuide: {
      3: '双手间距小于一拳距离',
      2: '双手间距在一拳至一掌半之间',
      1: '双手间距超过一掌半',
      0: '出现疼痛',
    },
  },
  {
    key: 'activeStraightLegRaise',
    name: '主动直腿抬高',
    short: '直腿',
    en: 'Active Straight-Leg Raise',
    icon: '🦵',
    purpose: '评估骨盆稳定与对侧腘绳肌柔韧性、髋关节活动度',
    bilateral: true,
    scoreGuide: {
      3: '抬腿踝关节超过对侧髂前上棘与股骨中点连线',
      2: '踝关节超过对侧股骨中点但未达髂前上棘水平',
      1: '踝关节低于对侧股骨中点',
      0: '出现疼痛',
    },
  },
  {
    key: 'trunkStabilityPushup',
    name: '躯干稳定俯卧撑',
    short: '俯卧撑',
    en: 'Trunk Stability Push-up',
    icon: '💪',
    purpose: '评估矢状面反射性核心稳定与前侧链协同发力',
    bilateral: false,
    scoreGuide: {
      3: '男：拇指与额头发际线齐平完成一次；女：拇指与下颌齐平',
      2: '男：拇指与下颌齐平；女：拇指与锁骨齐平',
      1: '男：拇指与锁骨齐平；女：拇指与胸骨下缘齐平',
      0: '出现疼痛',
    },
  },
  {
    key: 'rotaryStability',
    name: '旋转稳定性',
    short: '旋转',
    en: 'Rotary Stability',
    icon: '🔄',
    purpose: '评估多平面核心稳定与上下肢协同运动控制',
    bilateral: true,
    scoreGuide: {
      3: '完成同侧手-膝重复动作，躯干保持水平不偏移',
      2: '完成对侧手-膝对角模式，躯干保持水平',
      1: '无法完成对角模式，或躯干明显晃动',
      0: '出现疼痛',
    },
  },
];

export const CLEARING_TESTS: ClearingTestDef[] = [
  {
    key: 'shoulder',
    name: '肩部碰撞清除测试',
    desc: '受试者将手掌放于对侧肩上，肘部上抬；若肩部出现疼痛，肩部灵活性记 0 分',
    linked: 'shoulderMobility',
  },
  {
    key: 'spinal',
    name: '脊柱伸展清除测试',
    desc: '俯卧撑起后做脊柱伸展；若腰部出现疼痛，躯干稳定俯卧撑记 0 分',
    linked: 'trunkStabilityPushup',
  },
  {
    key: 'rocking',
    name: '后摆（跪姿）清除测试',
    desc: '四点支撑姿势向后坐至足跟；若腰部出现疼痛，旋转稳定性记 0 分',
    linked: 'rotaryStability',
  },
];

/** 单项得分文字映射（用于输入控件与报告） */
export const SCORE_LABELS: Record<number, string> = {
  3: '3 分 · 标准完成',
  2: '2 分 · 存在代偿',
  1: '1 分 · 无法完成',
  0: '0 分 · 出现疼痛',
};

/** 风险评估阈值：FMS ≤ 14 分与损伤风险增加显著相关（Kiesel et al. 2007） */
export const RISK_THRESHOLD = 14;

// ============================================================
// 评分与风险分析
// ============================================================

const testByKey = (key: FmsTestKey): FmsTestDef => {
  const t = FMS_TESTS.find((x) => x.key === key);
  if (!t) throw new Error(`未知的 FMS 动作：${key}`);
  return t;
};

const clampScore = (v: number): number => Math.min(3, Math.max(0, Math.round(Number(v) || 0)));

/**
 * 对单个受试者执行 FMS 评分与分析。
 * - 单侧动作：composite 取左右较低分（保守评估），左右差 ≥ 1 记为不对称
 * - 清除测试疼痛：对应动作强制记 0 分
 */
export function analyzeScreening(
  scores: FmsScoreInput,
  clearings: ClearingInput,
  athleteName = '未指定'
): ScreeningAnalysis {
  const items: FmsItemResult[] = [];
  const asymmetricTests: string[] = [];
  const painTests: string[] = [];

  const push = (
    key: FmsTestKey,
    left: number,
    right: number,
    cleared: boolean,
    bilateral: boolean
  ) => {
    const def = testByKey(key);
    let composite = bilateral ? Math.min(left, right) : clampScore(left);
    if (!cleared) composite = 0;
    const asymmetric = bilateral && left !== right && Math.abs(left - right) >= 1;
    items.push({
      test: def,
      composite,
      left: clampScore(left),
      right: clampScore(right),
      asymmetric,
      cleared,
    });
    if (asymmetric) asymmetricTests.push(`${def.name}（左 ${clampScore(left)} / 右 ${clampScore(right)}）`);
    if (composite === 0) painTests.push(def.name);
  };

  push('deepSquat', scores.deepSquat, scores.deepSquat, true, false);
  push('hurdleStep', scores.hurdleStep.left, scores.hurdleStep.right, true, true);
  push('inLineLunge', scores.inLineLunge.left, scores.inLineLunge.right, true, true);
  push('shoulderMobility', scores.shoulderMobility.left, scores.shoulderMobility.right, clearings.shoulder, true);
  push('activeStraightLegRaise', scores.activeStraightLegRaise.left, scores.activeStraightLegRaise.right, true, true);
  push('trunkStabilityPushup', scores.trunkStabilityPushup, scores.trunkStabilityPushup, clearings.spinal, false);
  push('rotaryStability', scores.rotaryStability.left, scores.rotaryStability.right, clearings.rocking, true);

  const total = items.reduce((sum, it) => sum + it.composite, 0);

  // 风险分级：≤14 循证阈值 + 0 分疼痛项 + 不对称叠加
  let riskLevel: RiskLevel = '低';
  if (painTests.length > 0) {
    riskLevel = '高';
  } else if (total <= RISK_THRESHOLD) {
    riskLevel = asymmetricTests.length >= 2 ? '高' : '中';
  } else if (asymmetricTests.length >= 2) {
    riskLevel = '中';
  }
  const riskNote =
    painTests.length > 0
      ? `出现疼痛动作（${painTests.join('、')}），建议先进行医疗评估，暂停相关动作训练`
      : total <= RISK_THRESHOLD
        ? `总分 ≤ ${RISK_THRESHOLD} 分，达到循证损伤风险阈值（Kiesel et al. 2007），建议优先改善动作质量并加强基础功能训练`
        : asymmetricTests.length > 0
          ? `总分高于风险阈值，但存在左右不对称，需针对性纠正两侧功能差异`
          : `总分高于风险阈值，动作模式整体良好，建议维持系统训练并定期复测`;

  return {
    athleteName,
    generatedAt: new Date().toLocaleString('zh-CN'),
    items,
    total,
    riskLevel,
    riskNote,
    asymmetricTests,
    painTests,
    recommendations: buildRecommendations(items),
  };
}

// ============================================================
// 逐项改进建议
// ============================================================

const RECOMMEND_BY_TEST: Record<FmsTestKey, Record<number, string>> = {
  deepSquat: {
    0: '疼痛评估优先：暂停负重深蹲，查明疼痛来源后再逐步重建动作',
    1: '从高位箱式蹲、踝背屈与髋灵活性训练开始，逐步降低箱高',
    2: '加强胸椎活动度与踝背屈，改善深蹲底部控制，建立足跟贴地模式',
  },
  hurdleStep: {
    0: '疼痛评估优先：暂停跨步类动作，明确疼痛来源',
    1: '降低栏架高度，从单腿站立平衡与髋屈肌灵活性训练入手',
    2: '加强单腿支撑稳定性、髋关节活动度与核心抗旋转控制',
  },
  inLineLunge: {
    0: '疼痛评估优先：暂停弓步蹲类动作',
    1: '从分腿蹲（罗马尼亚蹲/静态弓步）开始，改善髋伸与踝背屈',
    2: '加强髋屈肌柔韧与矢状面稳定性，练习后膝精准触板',
  },
  shoulderMobility: {
    0: '疼痛评估优先：暂停肩部拉伸与推举动作',
    1: '从肩关节外旋/内旋基础活动度训练开始，配合胸椎旋转',
    2: '加强胸椎活动度与肩胛稳定，逐步缩小手间距',
  },
  activeStraightLegRaise: {
    0: '疼痛评估优先：暂停直腿抬高类拉伸',
    1: '从仰卧单腿屈髋练习与腘绳肌放松入手',
    2: '加强骨盆后倾控制与腘绳肌柔韧，提升主动活动范围',
  },
  trunkStabilityPushup: {
    0: '疼痛评估优先：暂停俯卧撑与核心负荷动作',
    1: '从平板支撑与跪姿俯卧撑入手，强化核心刚性',
    2: '加强前侧链核心稳定与肩胛稳定，逐级推进俯卧撑难度',
  },
  rotaryStability: {
    0: '疼痛评估优先：暂停旋转与躯干扭转负荷',
    1: '从静态四足支撑与鸟狗式（对侧伸展）练习入手',
    2: '加强多平面核心控制，练习对角与同侧模式的稳定输出',
  },
};

export function buildRecommendations(items: FmsItemResult[]): string[] {
  const recs: string[] = [];
  for (const it of items) {
    if (it.composite < 3) {
      const guide = RECOMMEND_BY_TEST[it.test.key]?.[it.composite];
      if (guide) recs.push(`${it.test.name}（${it.composite} 分）：${guide}`);
    }
  }
  if (recs.length === 0) {
    recs.push('全部动作达到 3 分标准，保持当前训练模式并每 4-6 周复测一次');
  }
  return recs;
}

// ============================================================
// 报告生成
// ============================================================

export function buildReport(a: ScreeningAnalysis): string {
  const title = '功能性动作筛查报告（FMS）';
  const lines: string[] = [
    title,
    '='.repeat(76),
    `受试者：${a.athleteName}`,
    `测试时间：${a.generatedAt}`,
    '',
    `总分：${a.total} / 21　风险等级：${a.riskLevel}`,
    `评估说明：${a.riskNote}`,
    '',
    '一、逐项评分（0-3 分，单侧动作取左右较低分计入总分）',
    '-'.repeat(76),
    ...a.items.map((it) => {
      const side = it.test.bilateral ? `（左 ${it.left} / 右 ${it.right}）` : `（${it.left}）`;
      const cleared = it.cleared ? '' : '　※ 清除测试疼痛，记 0 分';
      const asym = it.asymmetric ? '　⚠ 左右不对称' : '';
      return `  ${it.test.name} ${side} → ${it.composite} 分${cleared}${asym}`;
    }),
    '',
    '二、风险与不对称分析',
    '-'.repeat(76),
    `  风险等级：${a.riskLevel}`,
    ...(a.asymmetricTests.length > 0
      ? [`  左右不对称（${a.asymmetricTests.length} 项）：${a.asymmetricTests.join('；')}`]
      : ['  左右不对称：无']),
    ...(a.painTests.length > 0
      ? [`  疼痛动作：${a.painTests.join('、')}（需医疗评估）`]
      : ['  疼痛动作：无']),
    '',
    '三、改进训练建议',
    '-'.repeat(76),
    ...a.recommendations.map((r) => `  · ${r}`),
    '',
    '注：FMS ≤ 14 分提示损伤风险增加（Kiesel et al. 2007）；单项 0 分或有疼痛应立即停止相关训练并就医评估。',
  ];
  return lines.join('\n');
}

/** 生成 PDF 分节结构（与通用 report-pdf API 配合） */
export function buildReportSections(a: ScreeningAnalysis): { heading: string; lines: string[] }[] {
  return [
    {
      heading: '基本信息',
      lines: [`受试者：${a.athleteName}`, `测试时间：${a.generatedAt}`],
    },
    {
      heading: '总分与风险分级',
      lines: [`总分：${a.total} / 21`, `风险等级：${a.riskLevel}`, `评估说明：${a.riskNote}`],
    },
    {
      heading: '逐项评分',
      lines: a.items.map((it) => {
        const side = it.test.bilateral ? `左 ${it.left} / 右 ${it.right}` : `${it.left}`;
        const cleared = it.cleared ? '' : '；清除测试疼痛，记 0 分';
        const asym = it.asymmetric ? '；左右不对称' : '';
        return `${it.test.name}（${it.test.en}）：${it.composite} 分（${side}${cleared}${asym}）`;
      }),
    },
    {
      heading: '不对称与疼痛',
      lines:
        a.asymmetricTests.length > 0
          ? a.asymmetricTests.map((t) => `不对称：${t}`)
          : ['未检测到左右不对称'],
    },
    {
      heading: '改进训练建议',
      lines: a.recommendations,
    },
    {
      heading: '结论',
      lines: [`风险等级：${a.riskLevel}`, a.riskNote],
    },
  ];
}

// ============================================================
// 批量导入解析（CSV / 粘贴文本）
// ============================================================

export const BATCH_HEADERS = [
  '姓名', '深蹲', '跨栏左', '跨栏右', '弓步左', '弓步右',
  '肩部左', '肩部右', '直腿左', '直腿右', '俯卧撑',
  '旋转左', '旋转右', '肩部清除', '俯卧撑清除', '旋转清除',
] as const;

export const BATCH_COL_COUNT = BATCH_HEADERS.length;

/** 生成空模板 CSV 文本（含表头与示例行），供下载 */
export function buildBatchTemplate(): string {
  const example = ['张三', '2', '2', '3', '2', '2', '1', '1', '3', '3', '2', '2', '2', '1', '1', '1'];
  return [BATCH_HEADERS.join(','), example.join(',')].join('\n');
}

/** 解析一行原始单元格 → 评分输入；返回错误消息列表（空数组 = 合法） */
export function parseBatchRow(cells: string[]): {
  scores: FmsScoreInput;
  clearings: ClearingInput;
  errors: string[];
} {
  const errors: string[] = [];
  // 占位元素使数组保持 1 基索引（nums[1]~nums[15] 对应第 2~16 列），避免索引错位
  const nums: number[] = [0];
  for (let i = 1; i < BATCH_COL_COUNT; i++) {
    const raw = (cells[i] ?? '').trim();
    if (raw === '') {
      errors.push(`第 ${i + 1} 列「${BATCH_HEADERS[i]}」为空`);
      nums.push(0);
      continue;
    }
    const v = Number(raw);
    if (!Number.isInteger(v)) {
      errors.push(`第 ${i + 1} 列「${BATCH_HEADERS[i]}」需为整数`);
    }
    nums.push(v);
  }
  // 评分列 0-3：索引 1-12
  for (let i = 1; i <= 12; i++) {
    if (nums[i] < 0 || nums[i] > 3) errors.push(`第 ${i + 1} 列「${BATCH_HEADERS[i]}」需为 0-3`);
  }
  // 清除列 0/1：索引 13-15（0=疼痛，1=无痛）
  for (let i = 13; i <= 15; i++) {
    if (nums[i] !== 0 && nums[i] !== 1) errors.push(`第 ${i + 1} 列「${BATCH_HEADERS[i]}」需为 0（疼痛）或 1（无痛）`);
  }

  const scores: FmsScoreInput = {
    deepSquat: nums[1],
    hurdleStep: { left: nums[2], right: nums[3] },
    inLineLunge: { left: nums[4], right: nums[5] },
    shoulderMobility: { left: nums[6], right: nums[7] },
    activeStraightLegRaise: { left: nums[8], right: nums[9] },
    trunkStabilityPushup: nums[10],
    rotaryStability: { left: nums[11], right: nums[12] },
  };
  const clearings: ClearingInput = {
    shoulder: nums[13] === 1,
    spinal: nums[14] === 1,
    rocking: nums[15] === 1,
  };
  return { scores, clearings, errors };
}

/** 解析 CSV 文本（支持表头跳过与纯数据行），逐行生成分析结果 */
export function parseBatchCSV(text: string): BatchResult {
  const rows: BatchRow[] = [];
  const errors: BatchResult['errors'] = [];
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const isHeader = (line: string) => line.includes('姓名') && line.includes('深蹲');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (i === 0 && isHeader(line)) continue; // 跳过表头
    const cells = line.split(',').map((c) => c.trim());
    const name = cells[0] || `受试者${i}`;
    if (cells.length < BATCH_COL_COUNT) {
      errors.push({ row: i + 1, name, messages: [`列数不足（期望 ${BATCH_COL_COUNT} 列，实际 ${cells.length} 列）`] });
      continue;
    }
    const { scores, clearings, errors: cellErrors } = parseBatchRow(cells);
    if (cellErrors.length > 0) {
      errors.push({ row: i + 1, name, messages: cellErrors });
      continue;
    }
    const analysis = analyzeScreening(scores, clearings, name);
    rows.push({ name, scores, clearings, analysis });
  }
  return { rows, validCount: rows.length, errors };
}

/** 批量结果 → CSV 导出文本 */
export function buildBatchCSV(result: BatchResult): string {
  const head = ['姓名', ...FMS_TESTS.map((t) => t.name), '总分', '风险等级', '不对称项', '疼痛项'].join(',');
  const body = result.rows.map((r) =>
    [
      r.name,
      ...r.analysis.items.map((it) => it.composite),
      r.analysis.total,
      r.analysis.riskLevel,
      r.analysis.asymmetricTests.length ? `"${r.analysis.asymmetricTests.join('；')}"` : '',
      r.analysis.painTests.length ? `"${r.analysis.painTests.join('；')}"` : '',
    ].join(',')
  );
  return [head, ...body].join('\n');
}

/** 批量汇总报告（TXT 文本） */
export function buildBatchReport(result: BatchResult): string {
  const lines: string[] = [
    'FMS 功能性动作筛查 · 批量评估汇总',
    '='.repeat(76),
    `筛查人数：${result.validCount}　生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '一、评估结果汇总',
    '-'.repeat(76),
    ...result.rows.map((r, i) => {
      const asym = r.analysis.asymmetricTests.length
        ? `；不对称 ${r.analysis.asymmetricTests.length} 项`
        : '';
      const pain = r.analysis.painTests.length ? `；疼痛动作 ${r.analysis.painTests.join('、')}` : '';
      return `${i + 1}. ${r.name}：总分 ${r.analysis.total} / 21，风险 ${r.analysis.riskLevel}${asym}${pain}`;
    }),
    '',
    '二、风险统计',
    '-'.repeat(76),
    `  低风险：${result.rows.filter((r) => r.analysis.riskLevel === '低').length} 人`,
    `  中风险：${result.rows.filter((r) => r.analysis.riskLevel === '中').length} 人`,
    `  高风险：${result.rows.filter((r) => r.analysis.riskLevel === '高').length} 人`,
    `  存在左右不对称：${result.rows.filter((r) => r.analysis.asymmetricTests.length > 0).length} 人`,
    '',
    '三、建议',
    '-'.repeat(76),
    '  1. 高风险（≤14 分或含疼痛动作）受试者：优先动作质量重建与医疗评估，暂缓高强度训练',
    '  2. 中风险受试者：针对低分动作开展专项纠正训练，2-4 周后复测',
    '  3. 所有受试者建议每 4-6 周定期复测，跟踪动作质量变化',
    '',
    '注：FMS ≤ 14 分提示损伤风险增加（Kiesel et al. 2007）；单项 0 分或有疼痛应立即停止相关训练并就医评估。',
  ];
  return lines.join('\n');
}
