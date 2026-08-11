/**
 * 运动科学工具箱 —— 运动需求分析（Needs Analysis）
 *
 * 对运动员进行多维度、系统性的运动需求评估，生成标准化、数据支持的分析报告，
 * 为体能教练制定个性化体能训练计划提供科学依据。
 *
 * 分析维度（循证依据）：
 * 1. 个人特点分析 —— 身体成分（BMI 分类参考 WHO/中国标准）、体能水平（训练年限/频率/有氧能力）
 * 2. 专项运动需求 —— 基于运动科学对专项代谢特征、能量系统贡献（有氧/无氧占比）、
 *    技术动作模式与身体素质需求权重的分析（参考 Bompa & Haff《Periodization》、
 *    各专项运动生理学文献的典型需求画像）
 * 3. 伤病风险与历史 —— 既往损伤严重度 × 复发加权的累积风险模型，识别薄弱环节
 * 4. 心理状态评估 —— 心理韧性（参考 CD-RISC 概念）、动机（自我决定理论）、
 *    压力应对、比赛心理准备 4 个子量表（5 点李克特量表）
 * 5. 其他维度 —— 睡眠（参考美国睡眠基金会推荐时长 7-9h）、营养充足性、
 *    生物节律（晨/晚型与训练时间匹配度）
 */

// ============================================================
// 类型定义
// ============================================================

/** 身体素质维度 */
export type FitnessAttr = 'strength' | 'speed' | 'power' | 'endurance' | 'agility' | 'flexibility';

export const FITNESS_ATTRS: { key: FitnessAttr; label: string; desc: string }[] = [
  { key: 'strength', label: '力量', desc: '最大力量与相对力量水平' },
  { key: 'speed', label: '速度', desc: '直线/冲刺速度表现' },
  { key: 'power', label: '爆发力', desc: '快速发力与跳跃/投掷能力' },
  { key: 'endurance', label: '耐力', desc: '有氧耐力与重复间歇恢复能力' },
  { key: 'agility', label: '敏捷', desc: '变向、制动与反应灵敏性' },
  { key: 'flexibility', label: '柔韧', desc: '关节活动度与动作幅度' },
];

/** 专项需求档案 */
export interface SportDemandProfile {
  key: string;
  label: string;
  /** 代谢特征说明 */
  meta: string;
  /** 能量系统贡献占比（%） */
  energy: { aerobic: number; anaerobic: number };
  /** 典型技术动作模式 */
  techModes: string[];
  /** 比赛与周期特点 */
  competition: string;
  /** 身体素质需求权重（0-100） */
  demands: Record<FitnessAttr, number>;
}

export const SPORT_PROFILES: SportDemandProfile[] = [
  {
    key: 'football',
    label: '足球',
    meta: '高强度间歇性项目：以 4-6 秒的高强度冲刺与短跑为主体，穿插低强度恢复与慢跑，总跑动距离 9-13 km/场（≥25% 处于高强度）',
    energy: { aerobic: 40, anaerobic: 60 },
    techModes: ['变速冲刺', '急停急起', '变向过人', '铲球与对抗'],
    competition: '赛季长（8-10 个月）、周双赛制，需要良好的恢复能力与周期化负荷管理',
    demands: { strength: 55, speed: 75, power: 70, endurance: 80, agility: 85, flexibility: 40 },
  },
  {
    key: 'basketball',
    label: '篮球',
    meta: '以反复的 3-5 秒高强度冲刺、跳跃与 15-20 秒的中低强度间歇为特征，高强度占比约 25%，间歇恢复由磷酸原与糖酵解系统主导',
    energy: { aerobic: 35, anaerobic: 65 },
    techModes: ['垂直跳跃', '横移防守', '加速突破', '对抗卡位'],
    competition: '赛季密集（常规赛约 8 个月）、频繁背靠背，注重下肢爆发力维持与恢复',
    demands: { strength: 65, speed: 70, power: 80, endurance: 55, agility: 75, flexibility: 45 },
  },
  {
    key: 'volleyball',
    label: '排球',
    meta: '以单次爆发性动作（扣球、拦网、发球）为核心的高强度间歇项目，单次动作 <1 秒，以 ATP-CP 系统为主，局间间歇充足',
    energy: { aerobic: 30, anaerobic: 70 },
    techModes: ['垂直与水平跳跃', '多方向快速移动', '上肢过顶发力'],
    competition: '赛季集中（5-7 个月）、赛程密集，跳跃负荷量大，需控制膝关节与肩关节负荷',
    demands: { strength: 55, speed: 55, power: 85, endurance: 45, agility: 70, flexibility: 50 },
  },
  {
    key: 'sprint',
    label: '短跑',
    meta: '极限强度磷酸原供能（100-400m），单次比赛 10-45 秒即耗尽，无氧能力与神经肌肉爆发输出决定成绩',
    energy: { aerobic: 5, anaerobic: 95 },
    techModes: ['起跑反应', '加速跑', '途中跑技术', '冲刺'],
    competition: '赛季集中、以分站赛制为主，训练周期高度依赖力量-速度素质与峰值功率',
    demands: { strength: 85, speed: 95, power: 95, endurance: 20, agility: 55, flexibility: 60 },
  },
  {
    key: 'swimming',
    label: '游泳',
    meta: '有氧-无氧混合型项目：中长距离以有氧为主（约 60-70%），短距离强调爆发划水，动作循环周期短、技术要求高',
    energy: { aerobic: 55, anaerobic: 45 },
    techModes: ['划水推进', '身体滚动', '出发跳水', '转身蹬壁'],
    competition: '全年多赛制，注重水上与水陆结合训练及肩关节伤病预防',
    demands: { strength: 70, speed: 60, power: 55, endurance: 75, agility: 35, flexibility: 85 },
  },
  {
    key: 'tennis',
    label: '网球',
    meta: '间歇性爆发项目：单分 3-10 秒，间歇 15-25 秒，高强度占比约 20-30%，涉及大量多方向移动与上肢爆发',
    energy: { aerobic: 45, anaerobic: 55 },
    techModes: ['多方向冲刺', '急停急转', '上肢挥拍发力', '单腿支撑平衡'],
    competition: '赛季贯穿全年、赛程密集，需预防肩肘腕与踝关节过劳损伤',
    demands: { strength: 55, speed: 70, power: 75, endurance: 60, agility: 75, flexibility: 65 },
  },
  {
    key: 'weightlifting',
    label: '举重',
    meta: '极限强度力量-爆发项目：单次动作 3-8 秒，完全依赖磷酸原系统，需要极高的神经肌肉动员与技术动作经济性',
    energy: { aerobic: 10, anaerobic: 90 },
    techModes: ['抓举', '挺举', '深蹲支撑', '核心刚性'],
    competition: '年度周期集中、以重大赛事为周期节点，训练以专项与力量训练为主体',
    demands: { strength: 95, speed: 40, power: 90, endurance: 15, agility: 30, flexibility: 55 },
  },
  {
    key: 'custom',
    label: '自定义项目',
    meta: '自定义专项需求画像：按项目实际代谢与动作特征设定能量系统占比与身体素质权重',
    energy: { aerobic: 50, anaerobic: 50 },
    techModes: ['自定义'],
    competition: '按项目实际比赛与周期特点自定义',
    demands: { strength: 50, speed: 50, power: 50, endurance: 50, agility: 50, flexibility: 50 },
  },
];

/** 运动员个人特点输入 */
export interface AthleteProfileInput {
  name?: string;
  gender: 'MALE' | 'FEMALE' | '';
  age: number | '';
  height: number | '';   // cm
  weight: number | '';   // kg
  bodyFat: number | '';  // %
  trainingYears: number | '';
  weeklyFrequency: number | '';
  vo2max: number | '';   // mL/kg/min（可选）
  /** 身体素质能力自评（0-100） */
  ability: Record<FitnessAttr, number>;
}

/** 伤病记录 */
export type InjuryStatus = 'INJURED' | 'RECOVERING' | 'RECOVERED';

export interface InjuryRecord {
  bodyPart: string;
  type: string;
  severity: number;      // 1-5
  status: InjuryStatus;
  recurrence: number;    // 复发次数 0-5
}

/** 心理量表（每题 1-5 分：1 非常不符合 - 5 非常符合） */
export interface PsychScaleItem {
  key: string;
  label: string;
  items: string[];
}

export const PSYCH_SCALES: PsychScaleItem[] = [
  {
    key: 'resilience',
    label: '心理韧性',
    items: ['面对挫折我能迅速恢复并继续投入训练', '高压情境下我仍能保持专注与执行力', '我能适应训练与比赛中的突发变化'],
  },
  {
    key: 'motivation',
    label: '动机水平',
    items: ['我愿意为达成目标付出额外努力', '训练中我主动寻求提高而非被动应付', '即使枯燥的基础训练我也能保持投入'],
  },
  {
    key: 'stress',
    label: '压力应对',
    items: ['我能有效管理赛前的紧张情绪', '失败后我能客观分析原因而非陷入自责', '我拥有适合自己的放松与心理调节方法'],
  },
  {
    key: 'preparation',
    label: '比赛心理准备',
    items: ['赛前我已建立清晰的比赛策略与目标', '我对自己的临场发挥有信心', '我能在比赛中及时调整心态与战术'],
  },
];

/** 其他维度输入 */
export type Chronotype = 'morning' | 'intermediate' | 'evening';

export interface LifestyleInput {
  sleepHours: number | '';
  sleepQuality: number;   // 1-5
  protein: number;        // 1-5
  carbs: number;          // 1-5
  hydration: number;      // 1-5
  chronotype: Chronotype;
  trainingTime: 'morning' | 'afternoon' | 'evening';
}

// ============================================================
// 计算结果类型
// ============================================================

export interface PhysicalResult {
  bmi: number | null;
  bmiLabel: string;
  bodyFatLabel: string;
  fitnessScore: number;
  fitnessDesc: string;
  notes: string[];
}

export interface SportMatchResult {
  sportKey: string;
  sportLabel: string;
  profile: SportDemandProfile;
  matchScore: number;
  radar: { attr: string; demand: number; ability: number }[];
  gaps: { attr: string; demand: number; ability: number; diff: number }[];
  strengths: { attr: string; demand: number; ability: number; diff: number }[];
}

export interface InjuryResult {
  riskScore: number;
  riskLevel: '低' | '中' | '高';
  notes: string[];
  weakLinks: string[];
}

export interface PsychResult {
  score: number;
  perScale: { key: string; label: string; score: number }[];
  notes: string[];
}

export interface LifestyleResult {
  sleepScore: number;
  nutritionScore: number;
  chronotypeScore: number;
  notes: string[];
}

export interface Recommendation {
  priority: '高' | '中' | '低';
  category: '训练' | '伤病防护' | '心理' | '生活方式';
  text: string;
}

export interface ReportSection {
  heading: string;
  lines: string[];
}

export interface NeedsAnalysisResult {
  athleteName: string;
  generatedAt: string;
  physical: PhysicalResult;
  sportMatch: SportMatchResult;
  injury: InjuryResult;
  psych: PsychResult;
  lifestyle: LifestyleResult;
  recommendations: Recommendation[];
  reports: ReportSection[];
}

// ============================================================
// 通用工具
// ============================================================

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** 能力等级标签（0-100） */
export function abilityLevel(v: number): { label: string; cls: string } {
  if (v < 40) return { label: '薄弱', cls: 'text-ams-danger' };
  if (v < 55) return { label: '较差', cls: 'text-ams-warning' };
  if (v < 70) return { label: '中等', cls: 'text-ams-info' };
  if (v < 85) return { label: '良好', cls: 'text-ams-success' };
  return { label: '优秀', cls: 'text-ams-primary' };
}

export function riskLevelOf(score: number): '低' | '中' | '高' {
  if (score < 30) return '低';
  if (score < 60) return '中';
  return '高';
}

// ============================================================
// 1. 个人特点分析
// ============================================================

export function analyzePhysical(input: AthleteProfileInput): PhysicalResult {
  const notes: string[] = [];
  let bmi: number | null = null;
  let bmiLabel = '—';
  let bodyFatLabel = '—';

  if (input.height && input.weight) {
    bmi = round1(input.weight / (input.height / 100) ** 2);
    // 中国成人 BMI 分类标准（WS/T 428-2013）
    if (bmi < 18.5) bmiLabel = '偏瘦';
    else if (bmi < 24) bmiLabel = '正常';
    else if (bmi < 28) bmiLabel = '超重';
    else bmiLabel = '肥胖';
    notes.push(`BMI = ${bmi}（${bmiLabel}），结合体脂率综合评估身体成分`);
  }
  if (input.bodyFat !== '' && input.bodyFat != null) {
    const bf = input.bodyFat;
    if (bf < 8) bodyFatLabel = '极低（存在内分泌与恢复风险）';
    else if (bf < 15) bodyFatLabel = '优秀';
    else if (bf < 20) bodyFatLabel = '良好';
    else if (bf < 25) bodyFatLabel = '中等';
    else bodyFatLabel = '偏高';
    notes.push(`体脂率 ${bf}%：${bodyFatLabel}`);
  }

  // 体能综合水平：训练年限 + 周频率 + 有氧能力
  let fitnessScore = 35;
  const years = typeof input.trainingYears === 'number' ? input.trainingYears : 0;
  const freq = typeof input.weeklyFrequency === 'number' ? input.weeklyFrequency : 0;
  fitnessScore += clamp(years * 5, 0, 25);                  // 年限加分（封顶 25）
  fitnessScore += clamp((freq / 7) * 20, 0, 20);            // 频率加分（封顶 20）
  if (input.vo2max !== '' && input.vo2max != null) {
    fitnessScore += clamp((input.vo2max / 70) * 20, 0, 20); // 有氧能力加分（封顶 20）
    notes.push(
      `VO₂max ${input.vo2max} mL/kg/min（${
        input.vo2max >= 55 ? '优秀' : input.vo2max >= 45 ? '良好' : input.vo2max >= 38 ? '中等' : '偏低'
      }，相对男性精英≥55、女性精英≥48 的参考标准）`
    );
  }
  fitnessScore = Math.round(clamp(fitnessScore));

  let fitnessDesc = '';
  if (fitnessScore >= 80) fitnessDesc = '训练成熟度与基础体能水平高，具备承担高强度专项训练的条件';
  else if (fitnessScore >= 60) fitnessDesc = '具备较好的训练基础，可承受中等以上负荷并逐步加量';
  else if (fitnessScore >= 40) fitnessDesc = '训练基础一般，建议优先夯实基础力量与有氧基础再进入专项强化';
  else fitnessDesc = '训练年限与频率有限，需以渐进式基础发展为主，警惕过早专项化';

  notes.push(
    `体能综合水平 ${fitnessScore}/100：训练年限 ${years || '—'} 年、周训练 ${freq || '—'} 次${input.vo2max !== '' && input.vo2max != null ? '、VO₂max ' + input.vo2max + ' mL/kg/min' : ''}`
  );

  return { bmi, bmiLabel, bodyFatLabel, fitnessScore, fitnessDesc, notes };
}

// ============================================================
// 2. 专项需求匹配分析
// ============================================================

export function analyzeSportMatch(sportKey: string, ability: Record<FitnessAttr, number>, customDemands?: Record<FitnessAttr, number>): SportMatchResult {
  const base = SPORT_PROFILES.find((p) => p.key === sportKey) ?? SPORT_PROFILES[0];
  const profile: SportDemandProfile =
    sportKey === 'custom' && customDemands
      ? { ...base, demands: { ...base.demands, ...customDemands } }
      : base;

  const radar = FITNESS_ATTRS.map((a) => ({
    attr: a.key,
    demand: profile.demands[a.key],
    ability: clamp(ability[a.key] ?? 0),
  }));

  const diffs = radar.map((r) => ({ ...r, diff: round1(r.ability - r.demand) }));
  const matchScore = Math.round(clamp(100 - diffs.reduce((s, d) => s + Math.abs(d.diff), 0) / diffs.length));

  const gaps = diffs
    .filter((d) => d.diff <= -15)
    .sort((a, b) => a.diff - b.diff)
    .map((d) => ({ attr: d.attr, demand: d.demand, ability: d.ability, diff: d.diff }));

  const strengths = diffs
    .filter((d) => d.diff >= 15)
    .sort((a, b) => b.diff - a.diff)
    .map((d) => ({ attr: d.attr, demand: d.demand, ability: d.ability, diff: d.diff }));

  return { sportKey, sportLabel: profile.label, profile, matchScore, radar, gaps, strengths };
}

// ============================================================
// 3. 伤病风险与历史分析
// ============================================================

export function analyzeInjury(injuries: InjuryRecord[]): InjuryResult {
  const notes: string[] = [];
  const weakLinks: string[] = [];

  if (injuries.length === 0) {
    notes.push('无既往伤病记录，伤病风险处于基础水平');
    return { riskScore: 0, riskLevel: '低', notes, weakLinks };
  }

  let risk = 0;
  for (const inj of injuries) {
    risk += inj.severity * 6;
    risk += inj.recurrence * 8;
    if (inj.status === 'RECOVERING') risk += 12;
    if (inj.status === 'INJURED') risk += 20;
    if (inj.status !== 'RECOVERED') {
      weakLinks.push(`${inj.bodyPart}（${inj.type}·${inj.status === 'INJURED' ? '受伤中' : '康复中'}）`);
    }
    notes.push(
      `${inj.bodyPart} ${inj.type}：严重度 ${inj.severity}/5，复发 ${inj.recurrence} 次，状态 ${
        inj.status === 'RECOVERED' ? '已康复' : inj.status === 'RECOVERING' ? '康复中' : '受伤中'
      }`
    );
  }

  risk = Math.round(clamp(risk));
  if (risk >= 60) {
    notes.push('累积风险评分偏高：建议在强化训练前完成康复评估，并对薄弱环节实施预防性强化与负荷管理');
  } else if (risk >= 30) {
    notes.push('存在中等风险：训练中需控制薄弱部位负荷并加强稳定性训练与监控');
  } else {
    notes.push('伤病风险处于可控范围，维持预防性训练与充分恢复即可');
  }

  return { riskScore: risk, riskLevel: riskLevelOf(risk), notes, weakLinks };
}

// ============================================================
// 4. 心理状态评估
// ============================================================

export function analyzePsych(ratings: Record<string, number[]>): PsychResult {
  const perScale = PSYCH_SCALES.map((s) => {
    const vals = ratings[s.key] ?? [];
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { key: s.key, label: s.label, score: Math.round(clamp((mean / 5) * 100)) };
  });

  const score = Math.round(perScale.reduce((s, p) => s + p.score, 0) / perScale.length);

  const notes: string[] = [];
  const low = perScale.filter((p) => p.score < 60);
  if (low.length) {
    notes.push(`需关注维度：${low.map((l) => l.label).join('、')}（低于 60/100），建议针对性心理技能训练`);
  } else {
    notes.push('各心理维度评分均在 60 分以上，整体心理准备状态良好');
  }
  if (score >= 80) notes.push('心理韧性储备充足，可承担高竞争强度比赛与训练负荷');
  return { score, perScale, notes };
}

// ============================================================
// 5. 其他维度（睡眠 / 营养 / 生物节律）
// ============================================================

export function analyzeLifestyle(input: LifestyleInput): LifestyleResult {
  const notes: string[] = [];

  // 睡眠：时长（参考睡眠基金会 7-9h）+ 质量
  let sleepScore = 0;
  if (input.sleepHours === '' || input.sleepHours == null) {
    sleepScore = 60;
    notes.push('未填写睡眠时长，默认按中等水平评估');
  } else {
    const h = input.sleepHours;
    const hourScore = h >= 7 && h <= 9 ? 100 : h >= 6 && h < 7 || h > 9 && h <= 10 ? 75 : 50;
    const qualityScore = (input.sleepQuality / 5) * 100;
    sleepScore = Math.round((hourScore + qualityScore) / 2);
    notes.push(`睡眠时长 ${h} 小时/晚（推荐 7-9 小时）、自评质量 ${input.sleepQuality}/5`);
  }
  if (sleepScore < 60) notes.push('睡眠不足或质量欠佳将显著影响恢复与伤病风险，建议优先改善睡眠卫生');

  const nutritionScore = Math.round(
    ((input.protein + input.carbs + input.hydration) / 15) * 100
  );
  notes.push(
    `营养自评：蛋白质 ${input.protein}/5、碳水 ${input.carbs}/5、水合 ${input.hydration}/5`
  );
  if (nutritionScore < 60) notes.push('营养摄入存在缺口：建议按专项能量需求评估热量与宏量营养素摄入，重点保障蛋白质与训练后补充');

  // 生物节律：晨型-上午训练 / 中间型-任意 / 晚型-下午晚间
  const map: Record<Chronotype, number> = { morning: 0, intermediate: 1, evening: 2 };
  const timeMap = { morning: 0, afternoon: 1, evening: 2 };
  const chrono = map[input.chronotype];
  const time = timeMap[input.trainingTime];
  let chronotypeScore = 75;
  if (chrono === 1) chronotypeScore = 85;
  else if (chrono === 0 && time === 0) chronotypeScore = 100;
  else if (chrono === 2 && time >= 1) chronotypeScore = 90;
  else if (chrono === 0) chronotypeScore = 60;
  else chronotypeScore = 65;
  const chronoLabel = { morning: '晨型', intermediate: '中间型', evening: '晚型' } as const;
  const timeLabel = { morning: '上午', afternoon: '下午', evening: '晚间' } as const;
  notes.push(
    `生物节律：${chronoLabel[input.chronotype]}，倾向训练时段 ${timeLabel[input.trainingTime]}（匹配度 ${chronotypeScore}/100）`
  );
  if (chronotypeScore < 70) notes.push('训练时段与生物节律存在错配：可考虑将高强度训练安排到个人的最佳觉醒时段');

  return { sleepScore, nutritionScore, chronotypeScore, notes };
}

// ============================================================
// 6. 综合建议与报告
// ============================================================

const ATTR_LABEL: Record<FitnessAttr, string> = {
  strength: '力量', speed: '速度', power: '爆发力', endurance: '耐力', agility: '敏捷', flexibility: '柔韧',
};

export function buildRecommendations(
  physical: PhysicalResult,
  sportMatch: SportMatchResult,
  injury: InjuryResult,
  psych: PsychResult,
  lifestyle: LifestyleResult
): Recommendation[] {
  const list: Recommendation[] = [];

  // 训练重点：专项缺口（前 3 优先）
  sportMatch.gaps.slice(0, 3).forEach((g, i) => {
    list.push({
      priority: i === 0 ? '高' : i === 1 ? '高' : '中',
      category: '训练',
      text: `${ATTR_LABEL[g.attr as FitnessAttr]}不足（需求 ${g.demand} vs 能力 ${g.ability}，缺口 ${Math.abs(g.diff)} 分）：${priorityText(g.attr as FitnessAttr)}`,
    });
  });
  // 相对优势保持
  if (sportMatch.strengths.length) {
    list.push({
      priority: '低',
      category: '训练',
      text: `保持优势素质（${sportMatch.strengths.slice(0, 2).map((s) => ATTR_LABEL[s.attr as FitnessAttr]).join('、')}），训练中予以维持性刺激避免退步`,
    });
  }
  if (sportMatch.matchScore < 70) {
    list.push({
      priority: '高',
      category: '训练',
      text: `专项需求匹配度仅 ${sportMatch.matchScore}%：建议按上述缺口优先安排 8-12 周的针对性强化周期，再行复测`,
    });
  }

  // 伤病防护
  if (injury.riskLevel === '高') {
    list.push({
      priority: '高',
      category: '伤病防护',
      text: `伤病风险等级高（${injury.riskScore}/100）：康复评估与临床转介前置，恢复期以渐进负荷与动作质量控制为先`,
    });
  }
  if (injury.weakLinks.length) {
    list.push({
      priority: injury.riskLevel === '高' ? '高' : '中',
      category: '伤病防护',
      text: `薄弱环节：${injury.weakLinks.join('、')}。建议实施 2-3 次/周的预防性强化（稳定性、偏心训练）与负荷监控`,
    });
  }

  // 心理
  const lowPsych = psych.perScale.filter((p) => p.score < 60);
  if (lowPsych.length) {
    list.push({
      priority: '中',
      category: '心理',
      text: `心理技能训练：针对${lowPsych.map((l) => l.label).join('、')}开展目标设定、自我对话、模拟训练与呼吸调节练习`,
    });
  }

  // 生活方式
  if (lifestyle.sleepScore < 60) {
    list.push({
      priority: '中',
      category: '生活方式',
      text: '改善睡眠：固定作息、睡前减少电子屏暴露、控制咖啡因摄入，保证 7-9 小时睡眠',
    });
  }
  if (lifestyle.nutritionScore < 60) {
    list.push({
      priority: '中',
      category: '生活方式',
      text: '优化营养策略：保障训练前后营养补充与全天蛋白质分配（每餐 0.4-0.5 g/kg）',
    });
  }
  if (lifestyle.chronotypeScore < 70) {
    list.push({
      priority: '低',
      category: '生活方式',
      text: '调整训练时段与生物节律的匹配，将高强度训练安排至个人最佳觉醒时段',
    });
  }

  return list;
}

/** 素质缺口对应的专项训练手段（基于循证力量与体能训练方法） */
function priorityText(attr: FitnessAttr): string {
  switch (attr) {
    case 'strength':
      return '以 3-5 RM 大负荷力量训练提升最大力量，采用深蹲/硬拉类复合动作';
    case 'speed':
      return '以 20-40 m 最大速度冲刺、变速与坡道冲刺训练提升神经肌肉速度';
    case 'power':
      return '以跳深、高翻、增强式训练（Plyometrics）等快速伸缩复合训练提升爆发力';
    case 'endurance':
      return '以长距离慢跑、间歇跑与专项有氧训练提升有氧能力与恢复速度';
    case 'agility':
      return '以锥桶变向、T 型跑、反应启动等敏捷训练提升变向与反应能力';
    case 'flexibility':
      return '以动态拉伸、泡沫轴放松与专项柔韧性训练改善关节活动度';
  }
}

export function buildReport(result: NeedsAnalysisResult): string {
  const lines: string[] = [];
  const r = result;

  lines.push('══════════════════════════════════════');
  lines.push('      运动需求分析报告');
  lines.push('══════════════════════════════════════');
  lines.push(`运动员：${r.athleteName || '未指定'}  专项：${r.sportMatch.sportLabel}`);
  lines.push(`生成时间：${r.generatedAt}`);
  lines.push('');
  lines.push('【一、个人特点分析】');
  r.physical.notes.forEach((n) => lines.push(`  · ${n}`));
  lines.push(`  体能综合水平：${r.physical.fitnessScore}/100（${r.physical.fitnessDesc}）`);
  lines.push('');
  lines.push('【二、专项需求匹配分析】');
  lines.push(`  专项：${r.sportMatch.sportLabel}`);
  lines.push(`  代谢特征：${r.sportMatch.profile.meta}`);
  lines.push(`  能量系统：有氧 ${r.sportMatch.profile.energy.aerobic}% / 无氧 ${r.sportMatch.profile.energy.anaerobic}%`);
  lines.push(`  技术动作模式：${r.sportMatch.profile.techModes.join('、')}`);
  lines.push(`  比赛与周期：${r.sportMatch.profile.competition}`);
  lines.push(`  需求-能力匹配度：${r.sportMatch.matchScore}%`);
  if (r.sportMatch.gaps.length) {
    lines.push('  主要不足项：');
    r.sportMatch.gaps.forEach((g) => lines.push(`    - ${ATTR_LABEL[g.attr as FitnessAttr]}：需求 ${g.demand} vs 能力 ${g.ability}（缺 ${Math.abs(g.diff)} 分）`));
  }
  if (r.sportMatch.strengths.length) {
    lines.push(`  相对优势项：${r.sportMatch.strengths.map((s) => ATTR_LABEL[s.attr as FitnessAttr]).join('、')}`);
  }
  lines.push('');
  lines.push('【三、伤病风险与历史】');
  lines.push(`  风险评分：${r.injury.riskScore}/100（${r.injury.riskLevel}风险）`);
  r.injury.notes.forEach((n) => lines.push(`  · ${n}`));
  if (r.injury.weakLinks.length) lines.push(`  薄弱环节：${r.injury.weakLinks.join('、')}`);
  lines.push('');
  lines.push('【四、心理状态评估】');
  r.psych.perScale.forEach((p) => lines.push(`  ${p.label}：${p.score}/100`));
  lines.push(`  综合心理准备：${r.psych.score}/100`);
  r.psych.notes.forEach((n) => lines.push(`  · ${n}`));
  lines.push('');
  lines.push('【五、其他维度（睡眠 / 营养 / 生物节律）】');
  lines.push(`  睡眠：${r.lifestyle.sleepScore}/100  营养：${r.lifestyle.nutritionScore}/100  节律匹配：${r.lifestyle.chronotypeScore}/100`);
  r.lifestyle.notes.forEach((n) => lines.push(`  · ${n}`));
  lines.push('');
  lines.push('【六、训练重点与建议】');
  if (r.recommendations.length) {
    r.recommendations.forEach((rec, i) => lines.push(`  ${i + 1}. [${rec.priority}] ${rec.category}：${rec.text}`));
  } else {
    lines.push('  当前各维度评估结果良好，维持现有训练结构并按周期化原则渐进负荷。');
  }
  lines.push('');
  lines.push('══════════════════════════════════════');
  lines.push('依据：Bompa & Haff《Periodization》专项需求分析框架；');
  lines.push('各专项运动生理学文献需求画像；CD-RISC 心理韧性概念（Connor & Davidson）；');
  lines.push('美国睡眠基金会睡眠时长推荐。本报告基于教练自评输入生成，');
  lines.push('用于辅助训练决策，不替代运动医学临床评估。');
  return lines.join('\n');
}

/** 生成结构化的报告分节（供 PDF 导出的标题/正文排版使用） */
export function buildReportSections(result: NeedsAnalysisResult): ReportSection[] {
  const r = result;
  return [
    {
      heading: '一、个人特点分析',
      lines: [
        `体能综合水平：${r.physical.fitnessScore}/100 —— ${r.physical.fitnessDesc}`,
        ...r.physical.notes.map((n) => `· ${n}`),
      ],
    },
    {
      heading: '二、专项需求匹配分析',
      lines: [
        `专项：${r.sportMatch.sportLabel}`,
        `代谢特征：${r.sportMatch.profile.meta}`,
        `能量系统：有氧 ${r.sportMatch.profile.energy.aerobic}% / 无氧 ${r.sportMatch.profile.energy.anaerobic}%`,
        `技术动作模式：${r.sportMatch.profile.techModes.join('、')}`,
        `比赛与周期特点：${r.sportMatch.profile.competition}`,
        `需求-能力匹配度：${r.sportMatch.matchScore}%`,
        ...(r.sportMatch.gaps.length
          ? [
              '主要不足项：',
              ...r.sportMatch.gaps.map((g) => `  - ${ATTR_LABEL[g.attr as FitnessAttr]}：需求 ${g.demand} vs 能力 ${g.ability}（缺 ${Math.abs(g.diff)} 分）`),
            ]
          : ['身体素质与专项需求匹配良好，无显著不足项。']),
        ...(r.sportMatch.strengths.length
          ? [`相对优势项：${r.sportMatch.strengths.map((s) => ATTR_LABEL[s.attr as FitnessAttr]).join('、')}`]
          : []),
      ],
    },
    {
      heading: '三、伤病风险与历史',
      lines: [
        `风险评分：${r.injury.riskScore}/100（${r.injury.riskLevel}风险）`,
        ...r.injury.notes.map((n) => `· ${n}`),
        ...(r.injury.weakLinks.length ? [`薄弱环节：${r.injury.weakLinks.join('、')}`] : []),
      ],
    },
    {
      heading: '四、心理状态评估',
      lines: [
        ...r.psych.perScale.map((p) => `${p.label}：${p.score}/100`),
        `综合心理准备：${r.psych.score}/100`,
        ...r.psych.notes.map((n) => `· ${n}`),
      ],
    },
    {
      heading: '五、其他维度（睡眠 / 营养 / 生物节律）',
      lines: [
        `睡眠：${r.lifestyle.sleepScore}/100  营养：${r.lifestyle.nutritionScore}/100  节律匹配：${r.lifestyle.chronotypeScore}/100`,
        ...r.lifestyle.notes.map((n) => `· ${n}`),
      ],
    },
    {
      heading: '六、训练重点与建议',
      lines: r.recommendations.length
        ? r.recommendations.map((rec, i) => `${i + 1}. [${rec.priority}优先·${rec.category}] ${rec.text}`)
        : ['当前各维度评估结果良好，维持现有训练结构并按周期化原则渐进负荷。'],
    },
  ];
}
