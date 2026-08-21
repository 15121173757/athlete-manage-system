/**
 * 数据导出服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 导出运动员列表为 Excel（.xlsx）
 * 2. 导出训练记录为 Excel
 * 3. 导出运动员档案为 PDF 报告
 *
 * 依赖：xlsx（Excel）、jspdf（PDF）
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { prisma } from '@/lib/db/prisma';
import { GenderLabels } from '@/types';
import { applyCNFont, CN_FONT_NAME } from '@/lib/utils/cnPdfFont';
import { NotFoundError, ValidationError } from '@/lib/errors/ErrorPresenter';

// ============================================================
// 导出运动员列表为 Excel
// ============================================================

export async function exportAthletesToExcel(): Promise<Buffer> {
  const athletes = await prisma.athlete.findMany({
    orderBy: { name: 'asc' },
  });

  const data = athletes.map((a) => ({
    '姓名': a.name,
    '性别': GenderLabels[a.gender as keyof typeof GenderLabels] || a.gender,
    '出生日期': a.birthDate.toISOString().split('T')[0],
    '身高(cm)': a.height ?? '',
    '体重(kg)': a.weight ?? '',
    '项目': a.sport,
    '位置': a.position ?? '',
    '入队日期': a.joinDate.toISOString().split('T')[0],
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  ws['!cols'] = [
    { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 12 }, { wch: 10 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '运动员列表');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ============================================================
// 导出训练记录为 Excel
// ============================================================

export async function exportTrainingRecordsToExcel(athleteId?: number): Promise<Buffer> {
  const where: Record<string, unknown> = {};
  if (athleteId) where.athleteId = athleteId;

  const records = await prisma.trainingRecord.findMany({
    where,
    include: {
      exercise: true,
      athlete: { select: { name: true } },
    },
    orderBy: { trainingDate: 'desc' },
  });

  const data = records.map((r) => ({
    '日期': r.trainingDate.toISOString().split('T')[0],
    '运动员': r.athlete.name,
    '训练项目': r.exercise?.name ?? '未知',
    '组数': r.actualSets,
    '次数': r.actualReps,
    '负荷(kg)': r.actualLoad ?? '',
    'RPE': r.rpe ?? '',
    '备注': r.notes ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 6 }, { wch: 6 },
    { wch: 10 }, { wch: 6 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '训练记录');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ============================================================
// 导出运动员档案 PDF 报告
// ============================================================

export async function exportAthleteProfilePDF(athleteId: number): Promise<Buffer> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      personalBests: {
        include: { exercise: true },
        orderBy: { value: 'desc' },
      },
      injuries: {
        orderBy: { startDate: 'desc' },
        take: 5,
      },
    },
  });

  if (!athlete) throw new Error('运动员不存在');

  // 查询近期训练记录
  const recentRecords = await prisma.trainingRecord.findMany({
    where: {
      athleteId,
      trainingDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { exercise: true },
    orderBy: { trainingDate: 'desc' },
    take: 10,
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  applyCNFont(doc, 'normal');

  // ---- 标题 ----
  doc.setFontSize(18);
  applyCNFont(doc, 'bold');
  doc.text('运动员档案报告', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  applyCNFont(doc, 'normal');
  doc.text(`生成时间：${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, 27, { align: 'center' });

  // ---- 分隔线 ----
  doc.setDrawColor(200);
  doc.line(14, 32, pageWidth - 14, 32);

  // ---- 基本信息 ----
  let y = 42;
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('基本信息', 14, y);
  y += 7;

  doc.setFontSize(10);
  const info: Array<[string, string]> = [
    ['姓名', athlete.name],
    ['性别', athlete.gender === 'MALE' ? '男' : '女'],
    ['出生日期', athlete.birthDate.toISOString().split('T')[0]],
    ['身高', athlete.height ? `${athlete.height} cm` : '无'],
    ['体重', athlete.weight ? `${athlete.weight} kg` : '无'],
    ['运动项目', athlete.sport],
    ['位置', athlete.position || '无'],
    ['入队日期', athlete.joinDate.toISOString().split('T')[0]],
  ];

  for (const [label, value] of info) {
    applyCNFont(doc, 'bold');
    doc.text(`${label}：`, 14, y);
    applyCNFont(doc, 'normal');
    doc.text(value, 50, y);
    y += 6;
  }

  // ---- PB 纪录 ----
  y += 5;
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('个人最佳纪录', 14, y);
  y += 7;

  if (athlete.personalBests.length === 0) {
    doc.setFontSize(10);
    applyCNFont(doc, 'normal');
    doc.text('暂无 PB 纪录。', 14, y);
    y += 6;
  } else {
    doc.setFontSize(10);
    applyCNFont(doc, 'bold');
    doc.text('训练项目', 14, y);
    doc.text('成绩', 80, y);
    doc.text('日期', 130, y);
    y += 5;
    applyCNFont(doc, 'normal');

    for (const pb of athlete.personalBests) {
      doc.text(pb.exercise?.name ?? '未知', 14, y);
      doc.text(`${pb.value} ${pb.unit}`, 80, y);
      doc.text(pb.achievedDate.toISOString().split('T')[0], 130, y);
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  // ---- 近期训练记录 ----
  y += 5;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('近期训练记录（近 30 天）', 14, y);
  y += 7;

  if (recentRecords.length === 0) {
    doc.setFontSize(10);
    applyCNFont(doc, 'normal');
    doc.text('近 30 天暂无训练记录。', 14, y);
    y += 6;
  } else {
    doc.setFontSize(9);
    applyCNFont(doc, 'bold');
    doc.text('日期', 14, y);
    doc.text('训练项目', 45, y);
    doc.text('组数', 100, y);
    doc.text('次数', 115, y);
    doc.text('负荷', 130, y);
    doc.text('RPE', 150, y);
    y += 5;
    applyCNFont(doc, 'normal');

    for (const r of recentRecords) {
      doc.text(r.trainingDate.toISOString().split('T')[0], 14, y);
      doc.text(r.exercise?.name?.substring(0, 15) ?? '未知', 45, y);
      doc.text(String(r.actualSets), 100, y);
      doc.text(String(r.actualReps), 115, y);
      doc.text(r.actualLoad ? `${r.actualLoad}kg` : '-', 130, y);
      doc.text(r.rpe ? String(r.rpe) : '-', 150, y);
      y += 5;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  // ---- 伤病记录 ----
  y += 5;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('伤病记录', 14, y);
  y += 7;

  if (athlete.injuries.length === 0) {
    doc.setFontSize(10);
    applyCNFont(doc, 'normal');
    doc.text('暂无伤病记录。', 14, y);
  } else {
    doc.setFontSize(10);
    for (const injury of athlete.injuries) {
      applyCNFont(doc, 'bold');
      doc.text(`${injury.injuryType}（${injury.status === 'INJURED' ? '受伤' : injury.status === 'RECOVERING' ? '康复中' : '已回归'}）`, 14, y);
      y += 5;
      applyCNFont(doc, 'normal');
      const desc = injury.description.length > 80
        ? injury.description.substring(0, 80) + '...'
        : injury.description;
      doc.text(desc, 14, y);
      y += 5;
      doc.text(`开始时间：${injury.startDate.toISOString().split('T')[0]}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ============================================================
// 导出指定运动员在特定日期的训练计划
// ============================================================

const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 根据日期计算星期几（1=周一 ... 7=周日）
 */
function getDayOfWeek(date: Date): number {
  const d = date.getDay(); // 0=周日, 1=周一 ... 6=周六
  return d === 0 ? 7 : d;
}

/**
 * 导出指定运动员在特定日期的训练计划
 * @param planId 训练计划 ID
 * @param athleteId 运动员 ID
 * @param dateStr 日期字符串（YYYY-MM-DD）
 * @param format 导出格式：pdf | excel
 */
export async function exportTrainingPlanForAthlete(
  planId: number,
  athleteId: number,
  dateStr: string,
  format: 'pdf' | 'excel'
): Promise<Buffer> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: { exercise: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
      planAthletes: { include: { athlete: true } },
      coach: { select: { name: true } },
    },
  });

  if (!plan) throw new NotFoundError('训练计划不存在');

  const athlete = plan.planAthletes.find((pa) => pa.athleteId === athleteId)?.athlete;
  if (!athlete) throw new NotFoundError('该运动员未被分配到此训练计划');

  // 导出日期以计划执行开始日期为准（缺失时回退到调用方传入的日期）
  const planDateStr = plan.startDate ? plan.startDate.toISOString().slice(0, 10) : dateStr;
  const targetDate = new Date(`${planDateStr}T00:00:00.000Z`);
  if (isNaN(targetDate.getTime())) throw new ValidationError('日期格式无效');
  const targetDayOfWeek = getDayOfWeek(targetDate);

  // 只导出目标运动员的练习安排：
  // - 独立配置（item.athleteId 非空）：仅保留该运动员的练习项，避免把其他运动员的练习导给同一个人
  // - 共享配置（item.athleteId 为空，历史数据兼容）：全员共用同一组练习，全部保留
  const dayItems = plan.items.filter(
    (it) => it.athleteId == null || it.athleteId === athleteId
  );

  if (format === 'excel') {
    return buildTrainingPlanExcel(plan, athlete, planDateStr, weekDayLabels[targetDayOfWeek - 1], dayItems);
  }
  return buildTrainingPlanPDF(plan, athlete, planDateStr, weekDayLabels[targetDayOfWeek - 1], dayItems);
}

// ============================================================
// Excel 格式：训练计划
// ============================================================

function buildTrainingPlanExcel(
  plan: { id: number; goal: string | null; coach: { name: string } },
  athlete: { name: string; sport: string },
  dateStr: string,
  weekDay: string,
  items: Array<{
    exercise: { name: string; category: string; unit: string };
    sets: number;
    reps: number;
    load: number | null;
    restSeconds: number | null;
    duration: number | null;
    tempo: string | null;
    notes: string | null;
  }>
): Buffer {
  // 汇总信息行
  const summary = [
    { '项目': '运动员姓名', '内容': athlete.name },
    { '项目': '运动项目', '内容': athlete.sport },
    { '项目': '训练日期', '内容': dateStr },
    { '项目': '星期', '内容': weekDay },
    { '项目': '本周目标', '内容': plan.goal || '无' },
    { '项目': '制定教练', '内容': plan.coach.name },
    { '项目': '练习总数', '内容': `${items.length} 个` },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 16 }, { wch: 50 }];

  // 训练内容明细（参数统一顺序：负荷 → 次数 → 时长 → 组数 → 间歇 → 节奏 → 备注）
  const detail = items.map((it, idx) => ({
    '序号': idx + 1,
    '训练项目': it.exercise.name,
    '分类': it.exercise.category,
    '负荷': it.load ?? '',
    '单位': it.exercise.unit,
    '次数': it.reps,
    '时长(分钟)': it.duration ?? '',
    '组数': it.sets,
    '间歇(秒)': it.restSeconds ?? '',
    '节奏': it.tempo ?? '',
    '备注': it.notes ?? '',
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detail);
  wsDetail['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 6 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, '计划概要');
  XLSX.utils.book_append_sheet(wb, wsDetail, '训练内容');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ============================================================
// PDF 格式：训练计划
// ============================================================

// ---- 专业配色系统（运动健康主题）----
// 主色：深蓝（专业/信任）；强调：活力橙；状态色：绿/橙/红
const PDF_COLORS = {
  primary: [30, 90, 156],      // 深蓝 #1E5A9C
  primaryDark: [22, 68, 120],  // 深蓝(深) #164478
  primaryLight: [46, 124, 196],// 亮蓝 #2E7CC4
  accent: [232, 131, 58],      // 活力橙 #E8833A
  bg: [244, 246, 249],         // 页面浅灰 #F4F6F9
  bgCard: [247, 250, 253],     // 卡片浅蓝 #F7FAFD
  bgNote: [255, 249, 231],     // 备注浅黄 #FFF9E7
  border: [213, 221, 229],     // 边框 #D5DDE5
  borderLight: [229, 235, 241],// 浅边框 #E5EBF1
  textMain: [26, 35, 50],      // 主文字 #1A2332
  textSub: [90, 106, 122],     // 次级文字 #5A6A7A
  white: [255, 255, 255],
} as const;

function pdfSetTextColor(doc: jsPDF, c: readonly number[]) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function pdfSetFillColor(doc: jsPDF, c: readonly number[]) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function pdfSetDrawColor(doc: jsPDF, c: readonly number[]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

/** 页眉：顶部品牌色带 + 标题行（在每页内容绘制前调用） */
function pdfDrawHeader(doc: jsPDF, pageWidth: number, dateStr: string, planId: number) {
  // 顶部主色带 + 橙色细条
  pdfSetFillColor(doc, PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 3.6, 'F');
  pdfSetFillColor(doc, PDF_COLORS.accent);
  doc.rect(0, 3.6, pageWidth, 0.7, 'F');

  // 左侧品牌
  pdfSetTextColor(doc, PDF_COLORS.white);
  applyCNFont(doc, 'bold');
  doc.setFontSize(10);
  doc.text('AMS 运动员管理系统', 14, 12);
  applyCNFont(doc, 'normal');
  doc.setFontSize(7.5);
  pdfSetTextColor(doc, PDF_COLORS.primaryLight);
  doc.text('TRAINING PLAN REPORT', 14, 16.5);

  // 右侧：导出日期 + 计划编号
  pdfSetTextColor(doc, PDF_COLORS.textSub);
  applyCNFont(doc, 'normal');
  doc.setFontSize(8.5);
  doc.text(`${dateStr} · 计划编号 #${planId}`, pageWidth - 14, 13.5, { align: 'right' });
}

/** 页脚：分割线 + 版权 + 页码（内容绘制完成后统一调用） */
function pdfDrawFooter(doc: jsPDF, pageWidth: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    pdfSetDrawColor(doc, PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);
    pdfSetTextColor(doc, PDF_COLORS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(7.5);
    doc.text('AMS 训练计划 · 内部资料', 14, pageHeight - 8);
    doc.text(`第 ${i} 页 / 共 ${totalPages} 页`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    // 底部色带
    pdfSetFillColor(doc, PDF_COLORS.primary);
    doc.rect(0, pageHeight - 2.4, pageWidth, 2.4, 'F');
  }
}

/** 章节标题：主色竖条 + 标题文字 + 右侧细线 */
function pdfSectionTitle(doc: jsPDF, x: number, y: number, title: string, subtitle?: string) {
  pdfSetFillColor(doc, PDF_COLORS.primary);
  doc.roundedRect(x, y - 4.2, 1.6, 5, 0.8, 0.8, 'F');
  pdfSetTextColor(doc, PDF_COLORS.textMain);
  applyCNFont(doc, 'bold');
  doc.setFontSize(12.5);
  doc.text(title, x + 5, y);
  if (subtitle) {
    pdfSetTextColor(doc, PDF_COLORS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(8);
    doc.text(subtitle, x + 5 + doc.getTextWidth(title) + 8, y);
  }
}

/** 检查是否需要换页（返回新页的 y 起点），换页时自动绘制页眉 */
function pdfCheckPage(doc: jsPDF, y: number, pageWidth: number, dateStr: string, planId: number): number {
  if (y <= 268) return y;
  doc.addPage();
  pdfDrawHeader(doc, pageWidth, dateStr, planId);
  return 24;
}

function buildTrainingPlanPDF(
  plan: { id: number; goal: string | null; coach: { name: string } },
  athlete: { name: string; sport: string },
  dateStr: string,
  weekDay: string,
  items: Array<{
    exercise: { name: string; category: string; unit: string };
    sets: number;
    reps: number;
    load: number | null;
    restSeconds: number | null;
    duration: number | null;
    tempo: string | null;
    notes: string | null;
  }>
): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentW = pageWidth - marginX * 2;

  applyCNFont(doc, 'normal');

  // ==================== 首页页眉 ====================
  pdfDrawHeader(doc, pageWidth, dateStr, plan.id);
  let y = 32;

  // ==================== 大标题区 ====================
  pdfSetTextColor(doc, PDF_COLORS.primary);
  applyCNFont(doc, 'bold');
  doc.setFontSize(21);
  doc.text('训练计划报告', marginX, y);
  y += 4;

  // 标题装饰线：橙色短条 + 亮蓝长条
  pdfSetFillColor(doc, PDF_COLORS.accent);
  doc.rect(marginX, y, 34, 1.4, 'F');
  pdfSetFillColor(doc, PDF_COLORS.primaryLight);
  doc.rect(marginX + 36, y, 72, 1.4, 'F');
  y += 10;

  // 副标题行：日期 · 星期（左） / 运动员（右）
  pdfSetTextColor(doc, PDF_COLORS.textSub);
  applyCNFont(doc, 'normal');
  doc.setFontSize(10);
  doc.text(`${dateStr} · ${weekDay}`, marginX, y);
  pdfSetTextColor(doc, PDF_COLORS.primary);
  applyCNFont(doc, 'bold');
  doc.setFontSize(16);
  doc.text(athlete.name, pageWidth - marginX, y, { align: 'right' });
  y += 9;

  // ==================== 概要信息卡 ====================
  const cardH = 23;
  pdfSetFillColor(doc, PDF_COLORS.bgCard);
  pdfSetDrawColor(doc, PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, cardH, 2, 2, 'FD');
  // 左侧主色竖块
  pdfSetFillColor(doc, PDF_COLORS.primary);
  doc.roundedRect(marginX, y, 3, cardH, 1.5, 1.5, 'F');

  const infoGrid: Array<[string, string]> = [
    ['运动项目', athlete.sport],
    ['制定教练', plan.coach.name],
    ['练习总数', `${items.length} 个`],
    ['导出日期', new Date().toLocaleDateString('zh-CN')],
  ];
  const colW = contentW / 4;
  infoGrid.forEach(([label, value], i) => {
    const cx = marginX + 9 + i * colW;
    pdfSetTextColor(doc, PDF_COLORS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(7.5);
    doc.text(label, cx, y + 9);
    pdfSetTextColor(doc, PDF_COLORS.textMain);
    applyCNFont(doc, 'bold');
    doc.setFontSize(10.5);
    doc.text(value, cx, y + 16);
  });

  // 本周目标横条
  y += cardH + 3;
  pdfSetFillColor(doc, PDF_COLORS.bg);
  doc.roundedRect(marginX, y, contentW, 10, 2, 2, 'F');
  pdfSetTextColor(doc, PDF_COLORS.textSub);
  applyCNFont(doc, 'bold');
  doc.setFontSize(8);
  doc.text('本周目标', marginX + 6, y + 6.5);
  pdfSetTextColor(doc, PDF_COLORS.textMain);
  applyCNFont(doc, 'normal');
  doc.setFontSize(9);
  const goalText = plan.goal && plan.goal.trim() ? plan.goal : '未设定';
  const goalLines = doc.splitTextToSize(goalText, contentW - 46);
  doc.text(goalLines, marginX + 38, y + 6.5);
  y += 14 + (goalLines.length - 1) * 4.5;

  y = pdfCheckPage(doc, y, pageWidth, dateStr, plan.id);

  // ==================== 训练内容章节 ====================
  pdfSectionTitle(doc, marginX, y + 4, '训练日程', `${dateStr} ${weekDay}`);
  y += 15;

  if (items.length === 0) {
    // 空态卡片
    pdfSetFillColor(doc, PDF_COLORS.bg);
    pdfSetDrawColor(doc, PDF_COLORS.borderLight);
    doc.roundedRect(marginX, y, contentW, 26, 2, 2, 'FD');
    pdfSetTextColor(doc, PDF_COLORS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(10);
    doc.text('该日暂无训练安排。', pageWidth / 2, y + 14, { align: 'center' });
    y += 32;
  } else {
    // ---- 训练内容表格（参数统一顺序：负荷 → 次数 → 时长 → 组数 → 间歇 → 节奏）----
    const cols = [
      { x: marginX + 4, w: 9, label: '#' },
      { x: 0, w: 38, label: '训练项目' },
      { x: 0, w: 24, label: '负荷' },
      { x: 0, w: 18, label: '次数' },
      { x: 0, w: 20, label: '时长' },
      { x: 0, w: 14, label: '组数' },
      { x: 0, w: 20, label: '间歇' },
      { x: 0, w: 24, label: '节奏' },
    ];
    let accX = marginX + 13;
    cols.slice(1).forEach((c) => { c.x = accX; accX += c.w; });

    const rowH = 8.6;
    const drawTableHeader = (hy: number) => {
      pdfSetFillColor(doc, PDF_COLORS.primary);
      doc.roundedRect(marginX, hy, contentW, rowH, 1.5, 1.5, 'F');
      pdfSetTextColor(doc, PDF_COLORS.white);
      applyCNFont(doc, 'bold');
      doc.setFontSize(8.5);
      cols.forEach((c) => doc.text(c.label, c.x, hy + 5.8));
    };

    drawTableHeader(y);
    y += rowH + 1.4;

    items.forEach((it, idx) => {
      if (y > 262) {
        doc.addPage();
        pdfDrawHeader(doc, pageWidth, dateStr, plan.id);
        y = 24;
        drawTableHeader(y);
        y += rowH + 1.4;
      }

      // 斑马纹 + 行分隔线
      if (idx % 2 === 1) {
        pdfSetFillColor(doc, PDF_COLORS.bg);
        doc.rect(marginX, y - 5.2, contentW, rowH, 'F');
      }
      pdfSetDrawColor(doc, PDF_COLORS.borderLight);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowH - 5.2, marginX + contentW, y + rowH - 5.2);

      // 序号
      pdfSetTextColor(doc, PDF_COLORS.textSub);
      applyCNFont(doc, 'normal');
      doc.setFontSize(9);
      doc.text(String(idx + 1), cols[0].x, y);
      // 训练项目
      pdfSetTextColor(doc, PDF_COLORS.textMain);
      applyCNFont(doc, 'bold');
      doc.text(it.exercise.name.substring(0, 14), cols[1].x, y);
      // 负荷
      applyCNFont(doc, 'normal');
      doc.text(it.load != null ? `${it.load}${it.exercise.unit}` : '-', cols[2].x, y);
      // 次数
      doc.text(String(it.reps), cols[3].x, y);
      // 时长
      doc.text(it.duration ? `${it.duration} 分钟` : '-', cols[4].x, y);
      // 组数
      doc.text(String(it.sets), cols[5].x, y);
      // 间歇
      doc.text(it.restSeconds ? `${it.restSeconds} 秒` : '-', cols[6].x, y);
      // 节奏（自由文本）
      pdfSetTextColor(doc, PDF_COLORS.textSub);
      doc.text(it.tempo || '-', cols[7].x, y);

      y += rowH;

      // 备注行（浅黄底色）
      if (it.notes) {
        pdfSetFillColor(doc, PDF_COLORS.bgNote);
        doc.rect(marginX, y - 4.8, contentW, 6.6, 'F');
        pdfSetTextColor(doc, PDF_COLORS.textSub);
        applyCNFont(doc, 'normal');
        doc.setFontSize(7.8);
        const noteLines = doc.splitTextToSize(`备注：${it.notes}`, contentW - 10);
        doc.text(noteLines[0], marginX + 5, y);
        y += 4.8;
        for (let li = 1; li < noteLines.length; li++) {
          y = pdfCheckPage(doc, y + 6, pageWidth, dateStr, plan.id);
          doc.text(noteLines[li], marginX + 5, y);
          y += 5;
        }
        y += 1.8;
      }
    });

    // ==================== 统计图表区 ====================
    y += 6;
    y = pdfCheckPage(doc, y, pageWidth, dateStr, plan.id);
    pdfSectionTitle(doc, marginX, y + 4, '训练统计');
    y += 14;

    // 训练量概览卡（整行宽度，2×2 指标格）
    const cardW = contentW;
    const chartTop = y;
    pdfSetFillColor(doc, PDF_COLORS.bgCard);
    pdfSetDrawColor(doc, PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, chartTop, cardW, 40, 2, 2, 'FD');
    pdfSetTextColor(doc, PDF_COLORS.textMain);
    applyCNFont(doc, 'bold');
    doc.setFontSize(10);
    doc.text('训练量概览', marginX + 7, chartTop + 9);

    const totalDuration = items.reduce((s, i) => s + (i.duration || 0), 0);
    const totalSets = items.reduce((s, i) => s + i.sets, 0);
    const totalReps = items.reduce((s, i) => s + i.reps, 0);
    const withTempo = items.filter((i) => i.tempo).length;
    const metrics: Array<[string, string]> = [
      ['练习项数', `${items.length} 项`],
      ['预计总时长', `${totalDuration} 分钟`],
      ['总组数', `${totalSets} 组`],
      ['总次数', `${totalReps} 次`],
      ['配置节奏', `${withTempo} 项`],
      ['配置负荷', `${items.filter((i) => i.load != null).length} 项`],
      ['平均间歇', `${items.length > 0 ? Math.round(items.reduce((s, i) => s + (i.restSeconds || 0), 0) / items.length) : 0} 秒`],
      ['计划编号', `#${plan.id}`],
    ];
    const gx = marginX + 7;
    const gy = chartTop + 16;
    const cellW = (cardW - 14) / 4;
    const cellH = 10;
    metrics.forEach(([label, value], i) => {
      const cx = gx + (i % 4) * cellW;
      const cy = gy + Math.floor(i / 4) * cellH;
      pdfSetTextColor(doc, PDF_COLORS.textSub);
      applyCNFont(doc, 'normal');
      doc.setFontSize(7.5);
      doc.text(label, cx, cy + 3);
      pdfSetTextColor(doc, PDF_COLORS.primary);
      applyCNFont(doc, 'bold');
      doc.setFontSize(11.5);
      doc.text(value, cx, cy + 9);
    });

    y = chartTop + 46;
  }

  y = pdfCheckPage(doc, y, pageWidth, dateStr, plan.id);

  // ==================== 训练注意事项章节 ====================
  pdfSectionTitle(doc, marginX, y + 4, '训练注意事项');
  y += 14;

  const notesItems = items.filter((it) => it.notes);
  if (notesItems.length === 0) {
    pdfSetTextColor(doc, PDF_COLORS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(9.5);
    doc.text('该日训练无额外注意事项。', marginX, y);
    y += 8;
  } else {
    notesItems.forEach((it, i) => {
      y = pdfCheckPage(doc, y + 4, pageWidth, dateStr, plan.id);
      // 序号圆点
      pdfSetFillColor(doc, PDF_COLORS.accent);
      doc.circle(marginX + 3, y - 2, 2.1, 'F');
      pdfSetTextColor(doc, PDF_COLORS.white);
      applyCNFont(doc, 'bold');
      doc.setFontSize(7);
      doc.text(String(i + 1), marginX + 3, y - 1.3, { align: 'center' });
      // 项目名
      pdfSetTextColor(doc, PDF_COLORS.textMain);
      applyCNFont(doc, 'bold');
      doc.setFontSize(9.5);
      doc.text(it.exercise.name, marginX + 9, y);
      // 备注内容
      pdfSetTextColor(doc, PDF_COLORS.textSub);
      applyCNFont(doc, 'normal');
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(it.notes || '', contentW - 14);
      doc.text(lines[0], marginX + 9, y + 4.5);
      y += 6;
      for (let li = 1; li < lines.length; li++) {
        y = pdfCheckPage(doc, y + 4, pageWidth, dateStr, plan.id);
        doc.text(lines[li], marginX + 9, y);
        y += 4.5;
      }
      y += 2;
    });
  }

  // ==================== 页脚（统一绘制页码）====================
  pdfDrawFooter(doc, pageWidth, doc.getNumberOfPages());

  return Buffer.from(doc.output('arraybuffer'));
}

