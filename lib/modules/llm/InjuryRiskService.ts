/**
 * 伤病风险预警服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 基于运动员训练负荷、体能数据、伤病历史，调用 LLM 生成风险预警
 * 2. 识别过度训练、不对称负荷、伤病复发等风险信号
 * 3. 输出结构化风险评估报告（风险等级、风险因素、预防建议）
 *
 * 风险信号来源：
 * - 训练负荷突变（周负荷 vs 前4周平均）
 * - RPE 持续偏高（≥8 连续3次以上）
 * - 体能测试值下降趋势
 * - 伤病历史（同部位反复受伤）
 * - 恢复时间不足
 */

import { prisma } from '@/lib/db/prisma';
import { getLLMConfig } from './config';
import { createProvider } from './provider';
import { ChatMessage, LLMResponse } from './types';

// ============================================================
// System Prompt
// ============================================================

const RISK_SYSTEM_PROMPT = `你是一位运动医学专家和伤病预防分析师，擅长从训练数据和伤病历史中识别潜在风险。

请根据以下运动员的训练负荷、体能测试、伤病历史数据，生成一份结构化的伤病风险预警报告。
报告需包含以下部分，每部分用 Markdown 标题：

## 风险等级
评估为「低风险」「中风险」或「高风险」，并用 1-2 句话说明判断依据。

## 风险因素
列出识别到的 2-5 个具体风险因素，每个因素需引用数据支撑。格式：
- **风险因素名称**：描述 + 数据依据

## 预警信号
列出需要立即关注的预警信号（如训练负荷突增、RPE 连续偏高等），如果没有则说明"未发现明显预警信号"。

## 预防建议
针对每个风险因素，提出 1-2 条具体可执行的预防措施。

## 训练调整建议
给出 2-3 条针对本周训练的调整建议，帮助降低风险。

要求：
- 使用中文输出
- 风险判断必须基于提供的数据，不要凭空假设
- 如果数据不足以做判断，明确说明"数据不足，建议持续监测"
- 语气专业、谨慎，符合医疗人员对教练的沟通风格`;

// ============================================================
// 类型定义
// ============================================================

export interface InjuryRiskParams {
  weeksRange?: number;
}

export interface InjuryRiskResult {
  riskLevel: string;
  riskScore: number;
  riskFactors: string;
  warningSignals: string;
  preventionAdvice: string;
  trainingAdjustment: string;
  rawContent: string;
  provider: string;
  reportId?: number;
  usage?: LLMResponse['usage'];
}

export interface AthleteRiskSummary {
  athleteId: number;
  athleteName: string;
  riskLevel: string;
  riskScore: number;
}

// ============================================================
// analyzeInjuryRisk —— 单运动员风险分析
// ============================================================

export async function analyzeInjuryRisk(
  athleteId: number,
  params?: InjuryRiskParams
): Promise<InjuryRiskResult> {
  const weeks = params?.weeksRange ?? 4;

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      injuries: {
        orderBy: { startDate: 'desc' },
        take: 10,
      },
    },
  });
  if (!athlete) {
    throw new Error(`运动员不存在（ID: ${athleteId}）`);
  }

  const endDate = new Date();
  const startDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const baselineStart = new Date(Date.now() - (weeks + 4) * 7 * 24 * 60 * 60 * 1000);

  // 查询近期训练记录
  const recentRecords = await prisma.trainingRecord.findMany({
    where: {
      athleteId,
      trainingDate: { gte: startDate, lte: endDate },
    },
    include: { exercise: true },
    orderBy: { trainingDate: 'desc' },
  });

  // 基线期训练记录（用于对比负荷变化）
  const baselineRecords = await prisma.trainingRecord.findMany({
    where: {
      athleteId,
      trainingDate: { gte: baselineStart, lt: startDate },
    },
    include: { exercise: true },
  });

  // 近期体能测试记录
  const fitnessRecords = await prisma.fitnessRecord.findMany({
    where: {
      athleteId,
      testDate: { gte: baselineStart },
    },
    include: { test: true },
    orderBy: { testDate: 'desc' },
    take: 10,
  });

  // 健康指标（心率/HRV/睡眠）
  const healthMetrics = await prisma.healthMetric.findMany({
    where: {
      athleteId,
      recordedAt: { gte: startDate },
    },
    orderBy: { recordedAt: 'desc' },
    take: 30,
  });

  const userPrompt = buildRiskPrompt(
    athlete,
    recentRecords,
    baselineRecords,
    athlete.injuries,
    fitnessRecords,
    healthMetrics,
    weeks
  );

  const llmConfig = getLLMConfig();
  const provider = createProvider(llmConfig);

  const messages: ChatMessage[] = [
    { role: 'system', content: RISK_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.chat(messages, { temperature: 0.3, maxTokens: 4096 });

  const parsed = parseRiskResponse(response);
  // 计算风险评分（基于规则，与概览保持一致）
  parsed.riskScore = calculateRiskScore(recentRecords, athlete.injuries);

  // 保存报告到数据库
  const report = await prisma.injuryRiskReport.create({
    data: {
      athleteId,
      riskLevel: parsed.riskLevel,
      riskScore: parsed.riskScore,
      riskFactors: parsed.riskFactors,
      warningSignals: parsed.warningSignals,
      preventionAdvice: parsed.preventionAdvice,
      trainingAdjustment: parsed.trainingAdjustment,
      rawContent: parsed.rawContent,
      provider: parsed.provider,
      weeksRange: weeks,
    },
  });
  parsed.reportId = report.id;

  return parsed;
}

// ============================================================
// calculateRiskScore —— 基于规则的风险评分
// ============================================================

function calculateRiskScore(
  recentRecords: any[],
  injuries: any[]
): number {
  let score = 0;

  // 当前受伤 +30
  const hasActiveInjury = injuries.some((i) => i.status === 'INJURED');
  if (hasActiveInjury) score += 30;

  // 康复中 +15
  const hasRecovering = injuries.some((i) => i.status === 'RECOVERING');
  if (hasRecovering) score += 15;

  // 高 RPE 记录
  const highRPECount = recentRecords.filter((r) => r.rpe && r.rpe >= 8).length;
  if (highRPECount >= 3) score += 20;
  else if (highRPECount >= 1) score += 10;

  // 训练量过高
  if (recentRecords.length > 20) score += 15;
  else if (recentRecords.length > 10) score += 5;

  return Math.min(score, 100);
}

// ============================================================
// listTeamRiskSummary —— 全队风险概览
// ============================================================

export async function listTeamRiskSummary(): Promise<AthleteRiskSummary[]> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { in: ['ACTIVE', 'RECOVERING'] } },
    include: {
      injuries: {
        where: { status: { in: ['INJURED', 'RECOVERING'] } },
      },
      trainingRecords: {
        where: {
          trainingDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  });

  return athletes.map((a) => {
    let score = 0;

    // 当前受伤 +30
    const hasActiveInjury = a.injuries.some((i) => i.status === 'INJURED');
    if (hasActiveInjury) score += 30;

    // 康复中 +15
    const hasRecovering = a.injuries.some((i) => i.status === 'RECOVERING');
    if (hasRecovering) score += 15;

    // 本周训练量过高（>15条）+10
    if (a.trainingRecords.length > 15) score += 10;

    // 高 RPE 记录
    const highRPECount = a.trainingRecords.filter((r) => r.rpe && r.rpe >= 8).length;
    if (highRPECount >= 3) score += 20;
    else if (highRPECount >= 1) score += 10;

    const riskLevel = score >= 40 ? '高风险' : score >= 20 ? '中风险' : '低风险';

    return {
      athleteId: a.id,
      athleteName: a.name,
      riskLevel,
      riskScore: score,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

// ============================================================
// Prompt 构造
// ============================================================

function buildRiskPrompt(
  athlete: any,
  recentRecords: any[],
  baselineRecords: any[],
  injuries: any[],
  fitnessRecords: any[],
  healthMetrics: any[],
  weeks: number
): string {
  const profile = [
    `### 运动员档案`,
    `- 姓名：${athlete.name}`,
    `- 性别：${athlete.gender}`,
    `- 项目：${athlete.sport}${athlete.position ? '（' + athlete.position + '）' : ''}`,
    `- 身高：${athlete.height ?? '未记录'} cm`,
    `- 体重：${athlete.weight ?? '未记录'} kg`,
    `- 当前状态：${athlete.status === 'ACTIVE' ? '在队' : athlete.status === 'RECOVERING' ? '休养' : '离队'}`,
  ].join('\n');

  // 近期训练负荷
  const recentVolume = calculateVolume(recentRecords);
  const baselineVolume = calculateVolume(baselineRecords);
  const volumeChange = baselineVolume > 0
    ? (((recentVolume - baselineVolume) / baselineVolume) * 100).toFixed(1)
    : 'N/A';

  const trainingSection = recentRecords.length > 0
    ? [
        `### 近 ${weeks} 周训练记录（共 ${recentRecords.length} 条）`,
        `- 近期周均训练量（组×次×重量）：${recentVolume.toFixed(0)}`,
        `- 前 4 周基线周均训练量：${baselineVolume.toFixed(0)}`,
        `- 负荷变化：${volumeChange}%`,
        '',
        ...recentRecords.slice(0, 20).map((r) => {
          const date = r.trainingDate.toLocaleDateString('zh-CN');
          const ex = r.exercise?.name ?? '未知';
          const detail = `${r.actualSets}×${r.actualReps}${r.actualLoad ? '@' + r.actualLoad + 'kg' : ''}`;
          const rpe = r.rpe ? ` RPE=${r.rpe}` : '';
          return `- ${date} ${ex}：${detail}${rpe}${r.notes ? '（' + r.notes + '）' : ''}`;
        }),
      ].join('\n')
    : `### 近 ${weeks} 周训练记录\n\n无训练记录。`;

  // 伤病历史
  const injurySection = injuries.length > 0
    ? [
        `### 伤病历史（共 ${injuries.length} 条）`,
        '',
        ...injuries.map((i) => {
          const status = i.status === 'INJURED' ? '受伤' : i.status === 'RECOVERING' ? '康复中' : '已回归';
          return `- ${i.injuryType}（${status}，${i.startDate.toLocaleDateString('zh-CN')}）：${i.description}`;
        }),
      ].join('\n')
    : `### 伤病历史\n\n无伤病记录。`;

  // 体能趋势
  const fitnessSection = fitnessRecords.length > 0
    ? [
        `### 近期体能测试（共 ${fitnessRecords.length} 条）`,
        '',
        ...fitnessRecords.slice(0, 10).map((f) => {
          const date = f.testDate.toLocaleDateString('zh-CN');
          return `- ${date} ${f.test?.name ?? '未知'}：${f.value}${f.test?.unit ?? ''}`;
        }),
      ].join('\n')
    : `### 近期体能测试\n\n无体能测试记录。`;

  // 健康指标
  const healthSection = healthMetrics.length > 0
    ? [
        `### 健康指标（近 ${weeks} 周，共 ${healthMetrics.length} 条）`,
        '',
        ...healthMetrics.slice(0, 15).map((m) => {
          const date = m.recordedAt.toLocaleDateString('zh-CN');
          const type = m.metricType === 'HEART_RATE' ? '心率' : m.metricType === 'HRV' ? 'HRV' : m.metricType === 'SLEEP' ? '睡眠' : 'RPE';
          return `- ${date} ${type}：${m.value}${m.unit}（来源：${m.source === 'POLAR' ? 'Polar' : '手动'}）`;
        }),
      ].join('\n')
    : `### 健康指标\n\n无健康指标记录。`;

  return [profile, '', trainingSection, '', injurySection, '', fitnessSection, '', healthSection].join('\n');
}

// ============================================================
// 辅助：计算训练量
// ============================================================

function calculateVolume(records: any[]): number {
  return records.reduce((sum, r) => {
    const load = r.actualLoad ?? 1;
    return sum + r.actualSets * r.actualReps * load;
  }, 0);
}

// ============================================================
// 响应解析
// ============================================================

function parseRiskResponse(response: LLMResponse): InjuryRiskResult {
  const content = response.content;

  return {
    riskLevel: extractSection(content, '风险等级') || '未知',
    riskScore: 0,
    riskFactors: extractSection(content, '风险因素') || '（模型未输出此部分）',
    warningSignals: extractSection(content, '预警信号') || '（模型未输出此部分）',
    preventionAdvice: extractSection(content, '预防建议') || '（模型未输出此部分）',
    trainingAdjustment: extractSection(content, '训练调整建议') || '（模型未输出此部分）',
    rawContent: content,
    provider: response.provider,
    usage: response.usage,
  };
}

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`##\\s*${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// getRiskHistory —— 运动员风险历史趋势
// ============================================================

export interface RiskHistoryPoint {
  id: number;
  riskLevel: string;
  riskScore: number;
  weeksRange: number;
  createdAt: string;
}

export async function getRiskHistory(athleteId: number, limit = 20): Promise<RiskHistoryPoint[]> {
  const reports = await prisma.injuryRiskReport.findMany({
    where: { athleteId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      riskLevel: true,
      riskScore: true,
      weeksRange: true,
      createdAt: true,
    },
  });
  return reports.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ============================================================
// getRiskReportById —— 按 ID 获取完整报告（用于导出）
// ============================================================

export async function getRiskReportById(reportId: number) {
  const report = await prisma.injuryRiskReport.findUnique({
    where: { id: reportId },
    include: { athlete: { select: { name: true, sport: true, gender: true } } },
  });
  return report;
}
