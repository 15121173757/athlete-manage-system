/**
 * LLM 业务服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 基于运动员数据生成训练分析报告
 * 2. 根据目标生成个性化训练计划
 * 3. 通过 LLM Provider 抽象层调用大模型
 *
 * 设计说明：
 * - 所有与 LLM 的交互均通过 createProvider 工厂创建实例
 * - System Prompt 针对运动教练场景优化
 * - 响应解析为结构化数据，便于前端展示
 */

import { prisma } from '@/lib/db/prisma';
import { getLLMConfig } from './config';
import { createProvider } from './provider';
import { ChatMessage, LLMResponse } from './types';

// ============================================================
// System Prompt 定义
// ============================================================

const ANALYSIS_SYSTEM_PROMPT = `你是一位经验丰富的运动表现分析师，擅长从训练数据中发现规律并给出专业建议。

请根据以下运动员的档案、训练记录和个人最好成绩（PB），生成一份结构化的训练分析报告。
报告需包含以下四个部分，每部分用 Markdown 标题：

## 优势（Strengths）
列出运动员当前表现突出的 3-5 个方面，引用具体数据支撑。

## 待改进（Areas for Improvement）
指出 3-5 个需要加强的方面，说明原因并引用数据。

## 训练建议（Recommendations）
针对每个待改进方面，提出 2-3 条具体可执行的训练建议。

## 总结（Summary）
用 2-3 句话总结运动员的整体状态和关键行动项。

要求：
- 使用中文输出
- 所有建议必须基于提供的数据，不要凭空假设
- 语气专业但鼓励，符合教练对运动员的沟通风格`;

const PLAN_SYSTEM_PROMPT = `你是一位资深的体能教练，擅长为运动员制定科学、 Periodized 的训练计划。

请根据以下运动员的档案和训练目标，制定一份为期一周的训练计划。
计划需包含以下结构，使用 Markdown 格式：

## 本周目标
用 1-2 句话概括本周的核心训练目标。

## 每日训练安排
按周一到周日排列，每天包含：
- 训练主题（如：力量训练、耐力训练、恢复训练）
- 具体训练内容（组数×次数@重量）
- 预计时长
- 注意事项

## 营养与恢复建议
给出 3-5 条饮食和恢复方面的建议。

## 注意事项
列出需要特别关注的风险点或提醒。

要求：
- 使用中文输出
- 训练内容需结合运动员的项目、位置和当前能力水平
- 负荷安排需循序渐进，避免过度训练
- 如有伤病记录，需在计划中体现防护措施`;

// ============================================================
// 类型定义
// ============================================================

export interface AnalyzeTrainingParams {
  startDate?: string;
  endDate?: string;
}

export interface AnalysisResult {
  strengths: string;
  areasForImprovement: string;
  recommendations: string;
  summary: string;
  rawContent: string;
  provider: string;
  usage?: LLMResponse['usage'];
}

export interface GeneratePlanResult {
  goal: string;
  dailyPlan: string;
  nutritionTips: string;
  notes: string;
  rawContent: string;
  provider: string;
  usage?: LLMResponse['usage'];
}

// ============================================================
// analyzeTraining —— 训练分析
// ============================================================

export async function analyzeTraining(
  athleteId: number,
  params?: AnalyzeTrainingParams
): Promise<AnalysisResult> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      personalBests: {
        include: { exercise: true },
        orderBy: { value: 'desc' },
      },
    },
  });
  if (!athlete) {
    throw new Error(`运动员不存在（ID: ${athleteId}）`);
  }

  // ---- 近期训练记录 ----
  const startDate = params?.startDate
    ? new Date(params.startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = params?.endDate
    ? new Date(params.endDate)
    : new Date();

  const trainingRecords = await prisma.trainingRecord.findMany({
    where: {
      athleteId,
      trainingDate: { gte: startDate, lte: endDate },
    },
    include: { exercise: true },
    orderBy: { trainingDate: 'desc' },
    take: 50,
  });

  // ---- 健康/伤病数据 ----
  const recentInjuries = await prisma.injury.findMany({
    where: {
      athleteId,
      status: { in: ['INJURED', 'RECOVERING'] },
    },
    orderBy: { startDate: 'desc' },
    take: 3,
  });

  // ---- 构造 User Prompt ----
  const userPrompt = buildAnalysisPrompt(athlete, trainingRecords, athlete.personalBests, recentInjuries, startDate, endDate);

  // ---- 调用 LLM ----
  const llmConfig = getLLMConfig();
  const provider = createProvider(llmConfig);

  const messages: ChatMessage[] = [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.chat(messages, { temperature: 0.3, maxTokens: 4096 });

  return parseAnalysisResponse(response);
}

// ============================================================
// generateTrainingPlan —— 生成训练计划
// ============================================================

export async function generateTrainingPlan(
  athleteId: number,
  goal: string
): Promise<GeneratePlanResult> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      personalBests: {
        include: { exercise: true },
        orderBy: { value: 'desc' },
      },
      injuries: {
        where: { status: { in: ['INJURED', 'RECOVERING'] } },
        orderBy: { startDate: 'desc' },
        take: 3,
      },
    },
  });
  if (!athlete) {
    throw new Error(`运动员不存在（ID: ${athleteId}）`);
  }

  // ---- 近期训练记录（作为参考上下文）----
  const recentRecords = await prisma.trainingRecord.findMany({
    where: {
      athleteId,
      trainingDate: {
        gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    },
    include: { exercise: true },
    orderBy: { trainingDate: 'desc' },
    take: 20,
  });

  const userPrompt = buildPlanPrompt(athlete, recentRecords, athlete.personalBests, athlete.injuries, goal);

  const llmConfig = getLLMConfig();
  const provider = createProvider(llmConfig);

  const messages: ChatMessage[] = [
    { role: 'system', content: PLAN_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.chat(messages, { temperature: 0.4, maxTokens: 4096 });

  return parsePlanResponse(response);
}

// ============================================================
// Prompt 构造辅助
// ============================================================

function buildAnalysisPrompt(
  athlete: any,
  records: any[],
  pbs: any[],
  injuries: any[],
  startDate: Date,
  endDate: Date
): string {
  const profile = [
    `### 运动员档案`,
    `- 姓名：${athlete.name}`,
    `- 性别：${athlete.gender}`,
    `- 项目：${athlete.sport}${athlete.position ? '（' + athlete.position + '）' : ''}`,
    `- 身高：${athlete.height ?? '未记录'} cm`,
    `- 体重：${athlete.weight ?? '未记录'} kg`,
    `- 入队时间：${athlete.joinDate.toLocaleDateString('zh-CN')}`,
  ].join('\n');

  const trainingSummary = records.length > 0
    ? [
        `### 近期训练记录（${startDate.toLocaleDateString('zh-CN')} ~ ${endDate.toLocaleDateString('zh-CN')}，共 ${records.length} 条）`,
        '',
        ...records.map((r) => {
          const date = r.trainingDate.toLocaleDateString('zh-CN');
          const ex = r.exercise?.name ?? '未知项目';
          const detail = `${r.actualSets}组 × ${r.actualReps}次${r.actualLoad ? ' @ ' + r.actualLoad + 'kg' : ''}`;
          const rpe = r.rpe ? `，RPE ${r.rpe}` : '';
          return `- ${date} ${ex}：${detail}${rpe}${r.notes ? '（' + r.notes + '）' : ''}`;
        }),
      ].join('\n')
    : `### 近期训练记录\n\n该时间段内无训练记录。`;

  const pbSection = pbs.length > 0
    ? [
        `### 个人最好成绩（PB，共 ${pbs.length} 项）`,
        '',
        ...pbs.map((pb) => {
          const ex = pb.exercise?.name ?? '未知项目';
          return `- ${ex}：${pb.value} ${pb.unit}（${pb.achievedDate.toLocaleDateString('zh-CN')}）`;
        }),
      ].join('\n')
    : `### 个人最好成绩（PB）\n\n暂无 PB 记录。`;

  const injurySection = injuries.length > 0
    ? [
        `### 伤病情况（共 ${injuries.length} 条）`,
        '',
        ...injuries.map((i) =>
          `- ${i.injuryType}（${i.status === 'INJURED' ? '受伤' : '康复中'}，开始于 ${i.startDate.toLocaleDateString('zh-CN')}）：${i.description}`
        ),
      ].join('\n')
    : `### 伤病情况\n\n当前无伤病记录。`;

  return [profile, '', trainingSummary, '', pbSection, '', injurySection].join('\n');
}

function buildPlanPrompt(
  athlete: any,
  records: any[],
  pbs: any[],
  injuries: any[],
  goal: string
): string {
  const profile = [
    `### 运动员档案`,
    `- 姓名：${athlete.name}`,
    `- 性别：${athlete.gender}`,
    `- 项目：${athlete.sport}${athlete.position ? '（' + athlete.position + '）' : ''}`,
    `- 身高：${athlete.height ?? '未记录'} cm`,
    `- 体重：${athlete.weight ?? '未记录'} kg`,
  ].join('\n');

  const recentSummary = records.length > 0
    ? [
        `### 近 2 周训练（共 ${records.length} 条，作为参考基线）`,
        '',
        ...records.map((r) => {
          const date = r.trainingDate.toLocaleDateString('zh-CN');
          const ex = r.exercise?.name ?? '未知项目';
          return `- ${date} ${ex}：${r.actualSets}组 × ${r.actualReps}次${r.actualLoad ? ' @ ' + r.actualLoad + 'kg' : ''}`;
        }),
      ].join('\n')
    : `### 近 2 周训练\n\n无近期训练记录。`;

  const pbSection = pbs.length > 0
    ? [
        `### PB 纪录（共 ${pbs.length} 项）`,
        '',
        ...pbs.map((pb) => {
          const ex = pb.exercise?.name ?? '未知项目';
          return `- ${ex}：${pb.value} ${pb.unit}`;
        }),
      ].join('\n')
    : '';

  const injuryNote = injuries.length > 0
    ? `\n\n### 伤病提醒\n${injuries.map((i) => `- ${i.injuryType}（${i.status === 'INJURED' ? '受伤' : '康复中'}）：${i.description}`).join('\n')}`
    : '';

  const goalSection = `\n\n### 本周训练目标\n${goal}`;

  return [profile, '', recentSummary, pbSection, injuryNote, goalSection].filter(Boolean).join('\n');
}

// ============================================================
// 响应解析
// ============================================================

function parseAnalysisResponse(response: LLMResponse): AnalysisResult {
  const content = response.content;

  const strengths = extractSection(content, '优势');
  const areasForImprovement = extractSection(content, '待改进');
  const recommendations = extractSection(content, '训练建议');
  const summary = extractSection(content, '总结');

  return {
    strengths: strengths || '（模型未输出此部分）',
    areasForImprovement: areasForImprovement || '（模型未输出此部分）',
    recommendations: recommendations || '（模型未输出此部分）',
    summary: summary || '（模型未输出此部分）',
    rawContent: content,
    provider: response.provider,
    usage: response.usage,
  };
}

function parsePlanResponse(response: LLMResponse): GeneratePlanResult {
  const content = response.content;

  const goal = extractSection(content, '本周目标');
  const dailyPlan = extractSection(content, '每日训练安排');
  const nutritionTips = extractSection(content, '营养与恢复建议');
  const notes = extractSection(content, '注意事项');

  return {
    goal: goal || '（模型未输出此部分）',
    dailyPlan: dailyPlan || '（模型未输出此部分）',
    nutritionTips: nutritionTips || '（模型未输出此部分）',
    notes: notes || '（模型未输出此部分）',
    rawContent: content,
    provider: response.provider,
    usage: response.usage,
  };
}

function extractSection(content: string, heading: string): string | null {
  // 匹配 ## 标题内容直到下一个 ## 标题
  const regex = new RegExp(`##\\s*${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}