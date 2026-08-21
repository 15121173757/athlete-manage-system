/**
 * 出勤报告导出服务 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 将出勤报告（个人 / 团队）导出为 PDF
 * 2. 将出勤报告导出为 Word（.docx）
 *
 * 依赖：jspdf（PDF）、docx（Word）、中文字体（lib/utils/cnPdfFont）
 */

import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  HeadingLevel,
} from 'docx';
import { applyCNFont } from '@/lib/utils/cnPdfFont';
import { ATTENDANCE_STATUSES, getAttendanceStatusColor } from '@/lib/attendance/attendance-types';
import type {
  AttendanceReport,
  IndividualAttendanceReport,
  TeamAttendanceReport,
} from '@/lib/modules/attendance/AttendanceService';

// ============================================================
// 通用工具
// ============================================================

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** AMS 主题色（报告与程序 UI 调色匹配） */
const AMS = {
  primary: hexToRgb('#FF6B35'),
  surface: hexToRgb('#132F4C'),
  surfaceHover: hexToRgb('#1A3A5C'),
  textDark: hexToRgb('#1A2332'),
  textSub: hexToRgb('#5A6A7A'),
  border: hexToRgb('#D5DDE5'),
  lightBg: hexToRgb('#F4F6F9'),
  white: hexToRgb('#FFFFFF'),
} as const;

function reportTitle(report: AttendanceReport): string {
  return report.dimension === 'individual' ? '个人出勤报告' : '队伍出勤报告';
}

function reportSubtitle(report: AttendanceReport): string {
  const range = `${report.range.startDate} ~ ${report.range.endDate}`;
  if (report.dimension === 'individual') {
    return `${report.athlete.name}（${report.athlete.sport || '未登记项目'}） · ${range}`;
  }
  return report.sport ? `${report.sport}项目团队 · ${range}` : `团队维度 · ${range}`;
}

// ============================================================
// PDF 导出
// ============================================================

function pdfSetFill(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function pdfSetText(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function pdfSetDraw(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

/** 绘制单个扇形（多边形逼近，使用 jsPDF 路径原语） */
function drawPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  color: [number, number, number]
) {
  const start = ((startDeg - 90) * Math.PI) / 180;
  const end = ((endDeg - 90) * Math.PI) / 180;
  const steps = Math.max(2, Math.ceil((endDeg - startDeg) / 4));

  pdfSetFill(doc, color);
  pdfSetDraw(doc, color);
  doc.setLineWidth(0.1);
  doc.moveTo(cx, cy);
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    doc.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  doc.close();
  doc.fill();
}

/** 绘制饼图 + 图例 */
function drawPieWithLegend(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  slices: { label: string; color: string; count: number; percentage: number }[],
  legendX: number,
  legendY: number
) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (total <= 0) {
    pdfSetFill(doc, hexToRgb('#D5DDE5'));
    doc.circle(cx, cy, r, 'F');
    pdfSetText(doc, AMS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(9);
    doc.text('暂无出勤记录', cx, cy + r + 8, { align: 'center' });
  } else {
    let startAngle = 0;
    for (const s of slices) {
      if (s.count <= 0) continue;
      const angle = (s.count / total) * 360;
      drawPieSlice(doc, cx, cy, r, startAngle, startAngle + angle, hexToRgb(s.color));
      startAngle += angle;
    }
  }

  // 图例
  let ly = legendY;
  slices.forEach((s) => {
    pdfSetFill(doc, hexToRgb(s.color));
    doc.roundedRect(legendX, ly - 3, 5, 5, 1, 1, 'F');
    pdfSetText(doc, AMS.textDark);
    applyCNFont(doc, 'normal');
    doc.setFontSize(9);
    doc.text(`${s.label} ${s.count} 次（${s.percentage}%）`, legendX + 8, ly + 1);
    ly += 9;
  });
}

function pdfEnsureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 18) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function exportAttendanceReportPDF(report: AttendanceReport): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageWidth - marginX * 2;

  applyCNFont(doc, 'normal');

  // 页头（深色带 + 橙色细条）
  pdfSetFill(doc, AMS.surface);
  doc.rect(0, 0, pageWidth, 22, 'F');
  pdfSetFill(doc, AMS.primary);
  doc.rect(0, 22, pageWidth, 1.4, 'F');
  pdfSetText(doc, AMS.white);
  applyCNFont(doc, 'bold');
  doc.setFontSize(10);
  doc.text('AMS 运动员管理系统', marginX, 9);
  applyCNFont(doc, 'normal');
  doc.setFontSize(8);
  doc.text('ATTENDANCE REPORT', marginX, 14);
  pdfSetText(doc, hexToRgb('#8B98A9'));
  doc.text(new Date().toLocaleString('zh-CN'), pageWidth - marginX, 13, { align: 'right' });

  let y = 36;

  // 标题
  pdfSetText(doc, AMS.surface);
  applyCNFont(doc, 'bold');
  doc.setFontSize(22);
  doc.text(reportTitle(report), marginX, y);
  y += 6;
  pdfSetFill(doc, AMS.primary);
  doc.rect(marginX, y - 2, 34, 1.4, 'F');
  pdfSetFill(doc, AMS.surfaceHover);
  doc.rect(marginX + 36, y - 2, 72, 1.4, 'F');
  y += 10;

  pdfSetText(doc, AMS.textSub);
  applyCNFont(doc, 'normal');
  doc.setFontSize(10);
  doc.text(reportSubtitle(report), marginX, y);
  y += 12;

  // ==================== 概览指标卡 ====================
  const metrics: Array<[string, string, [number, number, number]]> = [
    ['计划总数', String(report.planCount), AMS.surface],
    ['已标记', String(report.markedCount), AMS.primary],
    ['未标记', String(report.unmarkedCount), AMS.textSub],
  ];
  const cardW = (contentW - 12) / 3;
  metrics.forEach(([label, value, color], i) => {
    const cx = marginX + i * (cardW + 6);
    pdfSetFill(doc, AMS.lightBg);
    pdfSetDraw(doc, AMS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, 24, 2, 2, 'FD');
    pdfSetFill(doc, color);
    doc.roundedRect(cx, y, 3, 24, 1.5, 1.5, 'F');
    pdfSetText(doc, AMS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(8);
    doc.text(label, cx + 9, y + 10);
    pdfSetText(doc, color);
    applyCNFont(doc, 'bold');
    doc.setFontSize(15);
    doc.text(value, cx + 9, y + 19);
  });
  y += 36;

  // ==================== 状态占比（饼图） ====================
  const slices = report.statusCounts.map((s) => ({
    label: s.label,
    color: s.color,
    count: s.count,
    percentage: s.percentage,
  }));
  const pieCx = marginX + 46;
  const pieCy = y + 30;
  drawPieWithLegend(doc, pieCx, pieCy, 30, slices, marginX + 96, y + 6);
  y += 66;

  y = pdfEnsureSpace(doc, y, 10);

  if (report.dimension === 'individual') {
    y = drawIndividualSchedule(doc, report, marginX, y);
  } else {
    y = drawTeamMembers(doc, report, marginX, contentW, y);
  }

  // 页脚
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    pdfSetDraw(doc, AMS.border);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    pdfSetText(doc, AMS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(7.5);
    doc.text('AMS 出勤报告 · 内部资料', marginX, pageHeight - 8);
    doc.text(`第 ${i} 页 / 共 ${pages} 页`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
    pdfSetFill(doc, AMS.surface);
    doc.rect(0, pageHeight - 2.4, pageWidth, 2.4, 'F');
  }

  return Buffer.from(doc.output('arraybuffer'));
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function drawIndividualSchedule(
  doc: jsPDF,
  report: IndividualAttendanceReport,
  marginX: number,
  y: number
): number {
  // 章节标题
  pdfSetFill(doc, AMS.surface);
  doc.roundedRect(marginX, y - 4, 1.6, 5, 0.8, 0.8, 'F');
  pdfSetText(doc, AMS.surface);
  applyCNFont(doc, 'bold');
  doc.setFontSize(13);
  doc.text('日程标注', marginX + 5, y);
  y += 10;

  const cells = report.schedule;
  const cellSize = 17;
  const gap = 3;
  const cols = 7;
  const pageHeight = doc.internal.pageSize.getHeight();

  const drawHeader = (hy: number) => {
    WEEKDAYS.forEach((w, i) => {
      const x = marginX + i * (cellSize + gap);
      pdfSetFill(doc, AMS.surface);
      doc.roundedRect(x, hy, cellSize, 8, 1, 1, 'F');
      pdfSetText(doc, AMS.white);
      applyCNFont(doc, 'bold');
      doc.setFontSize(7.5);
      doc.text(w, x + cellSize / 2, hy + 5.5, { align: 'center' });
    });
  };

  drawHeader(y);
  let cy = y + 12;
  let colIdx = 0;

  for (const cell of cells) {
    if (cy + cellSize > pageHeight - 18) {
      doc.addPage();
      cy = 20;
      drawHeader(cy);
      cy += 12;
    }
    const x = marginX + colIdx * (cellSize + gap);
    // 背景颜色
    let bg: [number, number, number];
    if (!cell.scheduled) {
      bg = hexToRgb('#E5EBF1'); // 无计划：浅灰
    } else if (cell.status) {
      bg = hexToRgb(getAttendanceStatusColor(cell.status));
    } else {
      bg = hexToRgb('#3A4A5F'); // 未标记：深灰
    }
    pdfSetFill(doc, bg);
    doc.roundedRect(x, cy, cellSize, cellSize, 1.5, 1.5, 'F');

    // 日期数字
    const dayNum = parseInt(cell.date.slice(8, 10), 10);
    pdfSetText(doc, AMS.white);
    applyCNFont(doc, 'bold');
    doc.setFontSize(9);
    doc.text(String(dayNum), x + cellSize / 2, cy + 8, { align: 'center' });

    // 状态缩写（下方小字）
    if (cell.scheduled && cell.status) {
      const label = getStatusShort(cell.status);
      applyCNFont(doc, 'normal');
      doc.setFontSize(5.5);
      pdfSetText(doc, AMS.white);
      doc.text(label, x + cellSize / 2, cy + cellSize - 2, { align: 'center' });
    } else if (cell.scheduled) {
      applyCNFont(doc, 'normal');
      doc.setFontSize(5.5);
      pdfSetText(doc, AMS.white);
      doc.text('未标记', x + cellSize / 2, cy + cellSize - 2, { align: 'center' });
    }

    colIdx++;
    if (colIdx >= cols) {
      colIdx = 0;
      cy += cellSize + gap;
    }
  }
  if (colIdx !== 0) cy += cellSize + gap;

  // 图例
  cy += 4;
  const legendItems = [
    ...ATTENDANCE_STATUSES.map((s) => ({ label: s.label, color: s.color })),
    { label: '未标记', color: '#3A4A5F' },
    { label: '无计划', color: '#E5EBF1' },
  ];
  let lx = marginX;
  legendItems.forEach((it) => {
    pdfSetFill(doc, hexToRgb(it.color));
    doc.roundedRect(lx, cy - 3, 5, 5, 1, 1, 'F');
    pdfSetText(doc, AMS.textDark);
    applyCNFont(doc, 'normal');
    doc.setFontSize(8);
    doc.text(it.label, lx + 7, cy + 1);
    lx += doc.getTextWidth(it.label) + 16;
  });

  return cy + 10;
}

function getStatusShort(code: string): string {
  const m = ATTENDANCE_STATUSES.find((s) => s.code === code);
  return m?.label ?? '';
}

function drawTeamMembers(
  doc: jsPDF,
  report: TeamAttendanceReport,
  marginX: number,
  contentW: number,
  y: number
): number {
  pdfSetFill(doc, AMS.surface);
  doc.roundedRect(marginX, y - 4, 1.6, 5, 0.8, 0.8, 'F');
  pdfSetText(doc, AMS.surface);
  applyCNFont(doc, 'bold');
  doc.setFontSize(13);
  doc.text('人员明细', marginX + 5, y);
  y += 10;

  if (report.members.length === 0) {
    pdfSetText(doc, AMS.textSub);
    applyCNFont(doc, 'normal');
    doc.setFontSize(10);
    doc.text('暂无队员数据。', marginX, y);
    return y + 8;
  }

  // 表头
  const nameW = 46;
  const numW = 20;
  const barW = contentW - marginX - nameW - numW * 2 - 8;
  const barX = marginX + nameW;
  const headY = y;
  pdfSetFill(doc, AMS.surface);
  doc.roundedRect(marginX, headY, contentW, 8, 1.5, 1.5, 'F');
  pdfSetText(doc, AMS.white);
  applyCNFont(doc, 'bold');
  doc.setFontSize(8);
  doc.text('姓名', marginX + 3, headY + 5.5);
  doc.text('出勤状态占比', barX, headY + 5.5);
  doc.text('计划', marginX + nameW + barW + 4, headY + 5.5);
  doc.text('已标记', marginX + nameW + barW + 4 + numW, headY + 5.5);
  y = headY + 12;

  const rowH = 12;
  report.members.forEach((m, idx) => {
    y = pdfEnsureSpace(doc, y, rowH + 4);
    if (idx % 2 === 1) {
      pdfSetFill(doc, AMS.lightBg);
      doc.rect(marginX, y - 3, contentW, rowH, 'F');
    }
    // 姓名
    pdfSetText(doc, AMS.textDark);
    applyCNFont(doc, 'bold');
    doc.setFontSize(9);
    doc.text(m.name, marginX + 3, y + 3);

    // 堆叠条（多色）
    const total = m.statusCounts.reduce((s, c) => s + c.count, 0);
    let segX = barX;
    if (total > 0) {
      m.statusCounts.forEach((sc) => {
        if (sc.count <= 0) return;
        const segW = (sc.count / total) * barW;
        pdfSetFill(doc, hexToRgb(sc.color));
        doc.rect(segX, y - 3, segW, 8, 'F');
        segX += segW;
      });
    } else {
      pdfSetFill(doc, hexToRgb('#E5EBF1'));
      doc.rect(barX, y - 3, barW, 8, 'F');
    }
    pdfSetDraw(doc, AMS.border);
    doc.setLineWidth(0.2);
    doc.rect(barX, y - 3, barW, 8, 'S');

    // 计划数 / 已标记
    pdfSetText(doc, AMS.textDark);
    applyCNFont(doc, 'normal');
    doc.setFontSize(9);
    doc.text(String(m.planCount), marginX + nameW + barW + 4, y + 3);
    doc.text(String(m.markedCount), marginX + nameW + barW + 4 + numW, y + 3);

    y += rowH;
  });

  return y + 6;
}

// ============================================================
// Word 导出
// ============================================================

function statusColorHex(code: string): string {
  return getAttendanceStatusColor(code).replace('#', '');
}

function docxStatusBreakdownRows(report: AttendanceReport): TableRow[] {
  return report.statusCounts.map((s) => {
    return new TableRow({
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: statusColorHex(s.status) },
          width: { size: 8, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: s.label, bold: true })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(s.count) })] })],
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${s.percentage}%` })] })],
        }),
      ],
    });
  });
}

function buildDocxSummaryTable(report: AttendanceReport): Table {
  const cells = [
    ['计划总数', String(report.planCount)],
    ['已标记', String(report.markedCount)],
    ['未标记', String(report.unmarkedCount)],
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: cells.map(
          ([label, value]) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: 'F4F6F9' },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${label}  ${value}`, bold: true, size: 24 })],
                }),
              ],
            })
        ),
      }),
    ],
  });
}

export async function exportAttendanceReportWord(report: AttendanceReport): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: reportTitle(report), bold: true, size: 40, color: '132F4C' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: reportSubtitle(report), size: 20, color: '5A6A7A' })],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '概览', bold: true, size: 26, color: 'FF6B35' })],
    }),
    buildDocxSummaryTable(report),
    new Paragraph({ children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '出勤状态占比', bold: true, size: 26, color: 'FF6B35' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['', '状态', '次数', '占比'].map(
            (t, i) =>
              new TableCell({
                shading: { type: ShadingType.CLEAR, fill: '132F4C' },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: t, bold: true, color: 'FFFFFF' })],
                  }),
                ],
              })
          ),
        }),
        ...docxStatusBreakdownRows(report),
      ],
    })
  );

  if (report.dimension === 'individual') {
    children.push(
      new Paragraph({ children: [] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: '日程标注', bold: true, size: 26, color: 'FF6B35' })],
      })
    );
    const rows = report.schedule.map((cell) => {
      const dayNum = parseInt(cell.date.slice(8, 10), 10);
      const statusLabel = !cell.scheduled
        ? '无计划'
        : cell.status
          ? getAttendanceStatusLabel(cell.status)
          : '未标记';
      const fill = cell.scheduled && cell.status ? statusColorHex(cell.status) : cell.scheduled ? '3A4A5F' : 'E5EBF1';
      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell.date })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `周${WEEKDAYS[cell.dayOfWeek - 1]}` })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(dayNum) })] })],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill },
            children: [
              new Paragraph({
                children: [new TextRun({ text: statusLabel, color: fill === 'E5EBF1' ? '5A6A7A' : 'FFFFFF' })],
              }),
            ],
          }),
        ],
      });
    });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ['日期', '星期', '日', '出勤状态'].map(
              (t) =>
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: '132F4C' },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF' })] }),
                  ],
                })
            ),
          }),
          ...rows,
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({ children: [] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: '人员明细', bold: true, size: 26, color: 'FF6B35' })],
      })
    );
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['姓名', '项目', '计划', '已标记', ...ATTENDANCE_STATUSES.map((s) => s.label)].map((t) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: '132F4C' },
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF' })] })],
        })
      ),
    });
    const memberRows = report.members.map((m) => {
      const countByStatus = new Map(m.statusCounts.map((s) => [s.status, s.count]));
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.name })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.sport || '-' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(m.planCount) })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(m.markedCount) })] })] }),
          ...ATTENDANCE_STATUSES.map((s) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(countByStatus.get(s.code) ?? 0) })],
                }),
              ],
            })
          ),
        ],
      });
    });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...memberRows],
      })
    );
  }

  const doc = new Document({
    creator: 'AMS 运动员管理系统',
    title: reportTitle(report),
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function getAttendanceStatusLabel(code: string): string {
  const m = ATTENDANCE_STATUSES.find((s) => s.code === code);
  return m?.label ?? code;
}
