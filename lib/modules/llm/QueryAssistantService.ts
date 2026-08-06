/**
 * 自然语言查询助手服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 将用户自然语言问题转化为数据库查询
 * 2. 将查询结果组织为 LLM 上下文，生成自然语言回答
 * 3. 支持运动员信息、训练记录、体能数据、伤病记录等查询
 *
 * 查询意图分类：
 * - ATHLETE_INFO：运动员基本信息查询
 * - TRAINING_RECORD：训练记录查询
 * - FITNESS_DATA：体能测试数据查询
 * - INJURY_HISTORY：伤病记录查询
 * - PB_QUERY：个人最好成绩查询
 * - TEAM_OVERVIEW：全队概况查询
 * - GENERAL：通用问题
 */

import { prisma } from '@/lib/db/prisma';
import { getLLMConfig } from './config';
import { createProvider } from './provider';
import { ChatMessage, LLMResponse } from './types';

// ============================================================
// System Prompt
// ============================================================

const QUERY_SYSTEM_PROMPT = `你是运动员管理系统的智能查询助手，可以帮助教练和医疗人员查询运动员相关数据。

你可以回答以下类型的问题：
1. 运动员基本信息（姓名、项目、状态等）
2. 训练记录查询（近期训练内容、负荷、频率等）
3. 体能测试数据（测试成绩、趋势等）
4. 伤病记录查询（伤病历史、当前状态等）
5. PB（个人最好成绩）查询
6. 全队概况统计

回答要求：
- 使用中文回答
- 如果提供了查询到的数据，请基于数据回答，不要编造
- 如果数据不足以回答问题，明确说明"当前数据不足，无法回答"
- 对于数字数据，请做适当的汇总或对比分析
- 回答简洁专业，重点突出`;

// ============================================================
// 类型定义
// ============================================================

export interface QueryResult {
  answer: string;
  intent: string;
  dataContext: string;
  provider: string;
  usage?: LLMResponse['usage'];
}

// ============================================================
// 意图识别关键词
// ============================================================

const INTENT_KEYWORDS: Record<string, string[]> = {
  ATHLETE_INFO: ['运动员', '档案', '基本信息', '身高', '体重', '项目', '位置', '入队'],
  TRAINING_RECORD: ['训练', '训练记录', '训练计划', '负荷', '组数', '次数', 'RPE'],
  FITNESS_DATA: ['体能', '体能测试', '测试成绩', '体测'],
  INJURY_HISTORY: ['伤病', '受伤', '康复', ' injury', '伤痛'],
  PB_QUERY: ['PB', '最好成绩', '个人最好', '纪录', '最高', '最快'],
  TEAM_OVERVIEW: ['全队', '团队', '所有人', '统计', '概况', '有多少'],
};

// ============================================================
// handleQuery —— 主查询入口
// ============================================================

export async function handleQuery(question: string): Promise<QueryResult> {
  // 1. 识别查询意图
  const intent = detectIntent(question);

  // 2. 根据意图查询数据库
  const dataContext = await fetchContextData(intent, question);

  // 3. 构造 LLM Prompt
  const userPrompt = [
    `### 用户问题`,
    question,
    '',
    `### 系统查询到的数据`,
    dataContext || '（未查询到相关数据）',
    '',
    `### 回答要求`,
    `请基于上述数据回答用户问题。如果数据不足，请明确说明。`,
  ].join('\n');

  // 4. 调用 LLM
  const llmConfig = getLLMConfig();
  const provider = createProvider(llmConfig);

  const messages: ChatMessage[] = [
    { role: 'system', content: QUERY_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const response = await provider.chat(messages, { temperature: 0.2, maxTokens: 2048 });

  return {
    answer: response.content,
    intent,
    dataContext,
    provider: response.provider,
    usage: response.usage,
  };
}

// ============================================================
// 意图识别
// ============================================================

function detectIntent(question: string): string {
  const lowerQ = question.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => lowerQ.includes(kw.toLowerCase()))) {
      return intent;
    }
  }
  return 'GENERAL';
}

// ============================================================
// 数据查询
// ============================================================

async function fetchContextData(intent: string, question: string): Promise<string> {
  switch (intent) {
    case 'ATHLETE_INFO':
      return await fetchAthleteInfo(question);
    case 'TRAINING_RECORD':
      return await fetchTrainingRecords(question);
    case 'FITNESS_DATA':
      return await fetchFitnessData(question);
    case 'INJURY_HISTORY':
      return await fetchInjuryHistory(question);
    case 'PB_QUERY':
      return await fetchPBData(question);
    case 'TEAM_OVERVIEW':
      return await fetchTeamOverview();
    default:
      return await fetchGeneralContext(question);
  }
}

/**
 * 从问题中提取运动员姓名
 */
function extractAthleteName(question: string): string | null {
  // 查找所有运动员，检查是否有姓名出现在问题中
  return null; // 在实际查询中动态匹配
}

async function fetchAthleteInfo(question: string): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { not: 'LEFT' } },
    take: 20,
    orderBy: { name: 'asc' },
  });

  // 尝试匹配问题中提到的运动员
  const matched = athletes.find((a) => question.includes(a.name));

  if (matched) {
    return [
      `### 运动员信息`,
      `- 姓名：${matched.name}`,
      `- 性别：${matched.gender === 'MALE' ? '男' : '女'}`,
      `- 项目：${matched.sport}${matched.position ? '（' + matched.position + '）' : ''}`,
      `- 身高：${matched.height ?? '未记录'} cm`,
      `- 体重：${matched.weight ?? '未记录'} kg`,
      `- 入队日期：${matched.joinDate.toLocaleDateString('zh-CN')}`,
      `- 状态：${matched.status === 'ACTIVE' ? '在队' : matched.status === 'RECOVERING' ? '休养' : '离队'}`,
    ].join('\n');
  }

  // 未匹配到具体运动员，返回列表
  const list = athletes.map((a) => `- ${a.name}（${a.sport}，${a.status === 'ACTIVE' ? '在队' : '休养'}）`).join('\n');
  return `### 运动员列表（共 ${athletes.length} 人）\n${list}`;
}

async function fetchTrainingRecords(question: string): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { not: 'LEFT' } },
    select: { id: true, name: true },
  });

  const matched = athletes.find((a) => question.includes(a.name));

  const where: Record<string, unknown> = {};
  if (matched) {
    where.athleteId = matched.id;
  }

  const records = await prisma.trainingRecord.findMany({
    where: {
      ...where,
      trainingDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { exercise: true, athlete: { select: { name: true } } },
    orderBy: { trainingDate: 'desc' },
    take: 20,
  });

  if (records.length === 0) {
    return '### 训练记录\n\n近 30 天无训练记录。';
  }

  const lines = records.map((r) => {
    const date = r.trainingDate.toLocaleDateString('zh-CN');
    const ex = r.exercise?.name ?? '未知';
    const detail = `${r.actualSets}组×${r.actualReps}次${r.actualLoad ? '@' + r.actualLoad + 'kg' : ''}`;
    const rpe = r.rpe ? ` RPE=${r.rpe}` : '';
    return `- ${date} ${r.athlete.name} ${ex}：${detail}${rpe}`;
  });

  return `### 近期训练记录（共 ${records.length} 条）\n${lines.join('\n')}`;
}

async function fetchFitnessData(question: string): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { not: 'LEFT' } },
    select: { id: true, name: true },
  });

  const matched = athletes.find((a) => question.includes(a.name));

  const where: Record<string, unknown> = {};
  if (matched) {
    where.athleteId = matched.id;
  }

  const records = await prisma.fitnessRecord.findMany({
    where: {
      ...where,
      testDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    include: { test: true, athlete: { select: { name: true } } },
    orderBy: { testDate: 'desc' },
    take: 20,
  });

  if (records.length === 0) {
    return '### 体能测试记录\n\n近 90 天无体能测试记录。';
  }

  const lines = records.map((r) => {
    const date = r.testDate.toLocaleDateString('zh-CN');
    return `- ${date} ${r.athlete.name} ${r.test?.name ?? '未知'}：${r.value}${r.test?.unit ?? ''}`;
  });

  return `### 近期体能测试（共 ${records.length} 条）\n${lines.join('\n')}`;
}

async function fetchInjuryHistory(question: string): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { not: 'LEFT' } },
    select: { id: true, name: true },
  });

  const matched = athletes.find((a) => question.includes(a.name));

  const where: Record<string, unknown> = {};
  if (matched) {
    where.athleteId = matched.id;
  }

  const injuries = await prisma.injury.findMany({
    where,
    include: { athlete: { select: { name: true } } },
    orderBy: { startDate: 'desc' },
    take: 20,
  });

  if (injuries.length === 0) {
    return '### 伤病记录\n\n无伤病记录。';
  }

  const lines = injuries.map((i) => {
    const date = i.startDate.toLocaleDateString('zh-CN');
    const status = i.status === 'INJURED' ? '受伤' : i.status === 'RECOVERING' ? '康复中' : '已回归';
    return `- ${date} ${i.athlete.name} ${i.injuryType}（${status}）：${i.description}`;
  });

  return `### 伤病记录（共 ${injuries.length} 条）\n${lines.join('\n')}`;
}

async function fetchPBData(question: string): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    where: { status: { not: 'LEFT' } },
    select: { id: true, name: true },
  });

  const matched = athletes.find((a) => question.includes(a.name));

  const where: Record<string, unknown> = {};
  if (matched) {
    where.athleteId = matched.id;
  }

  const pbs = await prisma.personalBest.findMany({
    where,
    include: { exercise: true, athlete: { select: { name: true } } },
    orderBy: { value: 'desc' },
    take: 30,
  });

  if (pbs.length === 0) {
    return '### PB 纪录\n\n无 PB 纪录。';
  }

  const lines = pbs.map((pb) => {
    const date = pb.achievedDate.toLocaleDateString('zh-CN');
    return `- ${pb.athlete.name} ${pb.exercise?.name ?? '未知'}：${pb.value}${pb.unit}（${date}）`;
  });

  return `### PB 纪录（共 ${pbs.length} 条）\n${lines.join('\n')}`;
}

async function fetchTeamOverview(): Promise<string> {
  const [totalAthletes, activeInjuries, recentTrainingCount, totalPBs] = await Promise.all([
    prisma.athlete.count({ where: { status: { not: 'LEFT' } } }),
    prisma.injury.count({ where: { status: { in: ['INJURED', 'RECOVERING'] } } }),
    prisma.trainingRecord.count({
      where: { trainingDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.personalBest.count(),
  ]);

  const athletesByStatus = await prisma.athlete.groupBy({
    by: ['status'],
    _count: true,
  });

  const statusLines = athletesByStatus.map((s) => {
    const label = s.status === 'ACTIVE' ? '在队' : s.status === 'RECOVERING' ? '休养' : '离队';
    return `- ${label}：${s._count} 人`;
  }).join('\n');

  return [
    `### 全队概况`,
    `- 在队运动员总数：${totalAthletes} 人`,
    statusLines,
    `- 当前伤病人数：${activeInjuries} 人`,
    `- 本周训练记录：${recentTrainingCount} 条`,
    `- PB 纪录总数：${totalPBs} 条`,
  ].join('\n');
}

async function fetchGeneralContext(question: string): Promise<string> {
  // 通用查询：返回全队概况作为上下文
  return await fetchTeamOverview();
}
