/**
 * 报告 PDF 导出 —— 报告中心（AMS）
 *
 * 职责：将统一聚合结果（ReportData）渲染为 A4 PDF，
 * 嵌入中文字体（applyCNFont），输出科技感、专业且对齐清晰的报告：
 * - 头部：品牌、标题、生成时间、作用域与运动员回显
 * - 概览指标：KPI 卡片（主色强调数值）
 * - 图表：柱状图 / 饼图以横向条形可视化，折线图以坐标轴折线呈现
 * - 明细表：表头着色 + 斑马纹，列宽自适应
 * 统一字体、颜色与排版，供 /api/reports/export 路由调用（服务端生成）。
 */

import { jsPDF } from 'jspdf';
import { applyCNFont } from '@/lib/utils/cnPdfFont';
import type { ChartBlock, ReportData } from './types';
import { REPORT_SCOPE_LABELS } from './types';

const PAGE_W = 210; // A4 宽（mm）
const PAGE_H = 297; // A4 高（mm）
const MARGIN_X = 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_H = 14;

// —— 统一配色（深色科技风）——
const BRAND: [number, number, number] = [30, 58, 95];
const PRIMARY: [number, number, number] = [255, 107, 53];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MID: [number, number, number] = [70, 86, 104];
const TEXT_LIGHT: [number, number, number] = [130, 142, 160];
const BORDER: [number, number, number] = [226, 232, 240];
const CARD_BG: [number, number, number] = [247, 249, 252];
const GRID: [number, number, number] = [234, 238, 244];
const CHART_PALETTE: [number, number, number][] = [
  [255, 107, 53],
  [77, 208, 225],
  [255, 213, 79],
  [129, 199, 132],
  [186, 104, 200],
  [255, 138, 128],
  [130, 177, 255],
];

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const formatValue = (v: unknown): string => {
  if (v == null) return '-';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : Number(v.toFixed(2)).toString();
  }
  return String(v);
};

export function generateReportPdf(report: ReportData): Buffer {
  const doc = new jsPDF();
  let y = 20;

  const ensureSpace = (needed: number): void => {
    if (y + needed > PAGE_H - FOOTER_H) {
      doc.addPage();
      y = 20;
    }
  };

  const drawFooter = (): void => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      applyCNFont(doc, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_LIGHT);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);
      doc.text('AMS 运动员管理系统 · 报告中心', MARGIN_X, PAGE_H - 6);
      doc.text(`第 ${i} 页 / 共 ${pages} 页`, PAGE_W - MARGIN_X, PAGE_H - 6, { align: 'right' });
    }
  };

  const drawSectionTitle = (text: string): void => {
    ensureSpace(16);
    applyCNFont(doc, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEXT_DARK);
    doc.text(text, MARGIN_X, y);
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.7);
    doc.line(MARGIN_X, y + 2, MARGIN_X + 22, y + 2);
    y += 8;
  };

  // ============================================================
  // 头部
  // ============================================================
  applyCNFont(doc, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text('AMS 运动员管理系统 · 报告中心', MARGIN_X, 12);
  const generatedAt = report.generatedAt
    ? new Date(report.generatedAt).toLocaleString('zh-CN')
    : '';
  if (generatedAt) doc.text(generatedAt, PAGE_W - MARGIN_X, 12, { align: 'right' });
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, 15, PAGE_W - MARGIN_X, 15);

  y = 28;
  applyCNFont(doc, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...TEXT_DARK);
  doc.text(report.title || '报告', PAGE_W / 2, y, { align: 'center' });
  y += 6;

  // 作用域 / 运动员回显
  const metaParts: string[] = [];
  if (report.scope) metaParts.push(REPORT_SCOPE_LABELS[report.scope]);
  if (report.athletes?.length) metaParts.push(report.athletes.join('、'));
  if (metaParts.length) {
    applyCNFont(doc, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    doc.text(metaParts.join(' · '), PAGE_W / 2, y, { align: 'center' });
    y += 4;
  }
  y += 2;

  // ============================================================
  // KPI 概览
  // ============================================================
  if (report.kpis.length) {
    drawSectionTitle('概览指标');

    const gap = 5;
    const cardW = (CONTENT_W - gap) / 2;
    const cardH = 23;
    let col = 0;
    let rowTop = y;

    for (const kpi of report.kpis) {
      const x = MARGIN_X + col * (cardW + gap);
      ensureSpace(cardH + 4);
      if (col === 0) rowTop = y;

      // 卡片背景 + 顶部主色装饰线
      doc.setFillColor(...CARD_BG);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, rowTop, cardW, cardH, 2, 2, 'FD');
      doc.setFillColor(...PRIMARY);
      doc.rect(x + 1, rowTop + 1, cardW - 2, 1.4, 'F');

      // 标签
      applyCNFont(doc, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text(kpi.label, x + 5, rowTop + 6);

      // 数值 + 单位
      applyCNFont(doc, 'bold');
      doc.setFontSize(17);
      doc.setTextColor(...PRIMARY);
      const valueStr = kpi.unit ? `${kpi.value} ${kpi.unit}` : kpi.value;
      doc.text(valueStr, x + 5, rowTop + 16.5);

      // 次级说明（右对齐，避免与数值重叠）
      if (kpi.sub) {
        applyCNFont(doc, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MID);
        doc.text(kpi.sub, x + cardW - 5, rowTop + 6, { align: 'right' });
      }

      col += 1;
      if (col === 2) {
        col = 0;
        y = rowTop + cardH + 4;
      }
    }
    if (col === 1) y = rowTop + cardH + 4;
    y += 2;
  }

  // ============================================================
  // 图表
  // ============================================================
  const drawBars = (chart: ChartBlock, xKey: string, seriesKey: string): void => {
    const rows = chart.data as Array<Record<string, unknown>>;
    const labelW = 46;
    const valueW = 24;
    const barX = MARGIN_X + labelW;
    const barW = CONTENT_W - labelW - valueW;

    // 计算总和（饼图按占比着色）
    const isPie = chart.type === 'pie';
    const items = rows.map((row) => {
      const label = String(row[xKey] ?? '-');
      const value = toNumber(row[seriesKey]);
      return { label, value };
    });
    const total = isPie ? items.reduce((s, it) => s + it.value, 0) : 0;
    const maxVal = Math.max(1, ...items.map((it) => it.value));

    const rowH = 6.5;
    items.forEach((item, idx) => {
      ensureSpace(rowH);
      // 名称（右对齐）
      applyCNFont(doc, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_MID);
      doc.text(doc.splitTextToSize(item.label, labelW - 4), barX - 3, y + 3, { align: 'right' });

      // 背景条
      doc.setFillColor(...GRID);
      doc.setDrawColor(...GRID);
      doc.roundedRect(barX, y, barW, 4, 1, 1, 'FD');

      // 填充条（饼图按占比，柱状图按最大值）
      const ratio = isPie && total > 0 ? item.value / total : item.value / maxVal;
      if (ratio > 0) {
        const color = isPie ? CHART_PALETTE[idx % CHART_PALETTE.length] : PRIMARY;
        doc.setFillColor(...color);
        doc.setDrawColor(...color);
        doc.roundedRect(barX, y, Math.max(2, barW * Math.min(ratio, 1)), 4, 1, 1, 'FD');
      }

      // 数值
      applyCNFont(doc, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_DARK);
      const display = isPie && total > 0
        ? `${formatValue(item.value)}（${Math.round((item.value / total) * 100)}%）`
        : formatValue(item.value);
      doc.text(display, barX + barW + 3, y + 3.5, { align: 'left' });

      y += rowH;
    });
    y += 4;
  };

  const drawLine = (chart: ChartBlock, xKey: string, seriesKey: string): void => {
    const rows = chart.data as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      applyCNFont(doc, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text('暂无数据', MARGIN_X, y + 4);
      y += 10;
      return;
    }

    const values = rows.map((r) => toNumber(r[seriesKey]));
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const range = max - min;

    const leftPad = 14;
    const plotH = 46;
    const labelGap = 8;
    const plotX = MARGIN_X + leftPad;
    const plotW = CONTENT_W - leftPad;
    const plotTop = y + 6;
    const plotBottom = plotTop + plotH;

    // 网格线 + Y 轴刻度（4 段）
    applyCNFont(doc, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_LIGHT);
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const val = min + (range * i) / gridSteps;
      const gy = plotBottom - (plotH * i) / gridSteps;
      doc.setDrawColor(...GRID);
      doc.setLineWidth(0.3);
      doc.line(plotX, gy, plotX + plotW, gy);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text(formatValue(Number(val.toFixed(2))), plotX - 2, gy + 2, { align: 'right' });
    }

    // 数据点
    const n = values.length;
    const step = n > 1 ? plotW / (n - 1) : plotW;
    const pts = values.map((v, i) => ({
      x: plotX + i * step,
      y: plotBottom - ((v - min) / range) * plotH,
      v,
    }));

    // 折线
    doc.setDrawColor(...PRIMARY);
    doc.setLineWidth(0.9);
    for (let i = 0; i < n - 1; i++) {
      doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }

    // 数据点 + 数值标签
    for (const p of pts) {
      doc.setFillColor(...PRIMARY);
      doc.setDrawColor(...PRIMARY);
      doc.circle(p.x, p.y, 1.3, 'FD');
      applyCNFont(doc, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_DARK);
      doc.text(formatValue(p.v), p.x, p.y - 2, { align: 'center' });
    }

    // X 轴标签（跳过以避免重叠）
    applyCNFont(doc, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_LIGHT);
    const skip = Math.max(1, Math.ceil(n / 10));
    rows.forEach((row, i) => {
      if (i % skip !== 0 && i !== n - 1) return;
      const label = String(row[xKey] ?? '-');
      doc.text(label, pts[i].x, plotBottom + 4, { align: 'center' });
    });

    y = plotBottom + labelGap + 2;
  };

  for (const chart of report.charts) {
    drawSectionTitle(chart.label);
    const xKey = chart.xKey ?? 'name';
    const seriesKey = chart.series[0] ?? 'value';

    if (chart.type === 'line') {
      drawLine(chart, xKey, seriesKey);
    } else {
      drawBars(chart, xKey, seriesKey);
    }
  }

  // ============================================================
  // 明细表
  // ============================================================
  for (const table of report.tables) {
    drawSectionTitle(table.label);

    const colCount = table.columns.length;
    if (colCount === 0) continue;
    const colW = CONTENT_W / colCount;
    const headerH = 7;

    // 表头（深色底 + 白字）
    ensureSpace(headerH + 6);
    doc.setFillColor(...BRAND);
    doc.rect(MARGIN_X, y, CONTENT_W, headerH, 'F');
    applyCNFont(doc, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    table.columns.forEach((col, i) => {
      doc.text(col.label, MARGIN_X + i * colW + 2, y + 4.8);
    });
    y += headerH;

    // 数据行（斑马纹）
    table.rows.forEach((row, rowIdx) => {
      ensureSpace(6);
      if (rowIdx % 2 === 1) {
        doc.setFillColor(...CARD_BG);
        doc.rect(MARGIN_X, y, CONTENT_W, 6, 'F');
      }
      applyCNFont(doc, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MID);
      table.columns.forEach((col, i) => {
        const raw = row[col.key];
        const cell = raw == null || raw === '' ? '-' : String(raw);
        doc.text(doc.splitTextToSize(cell, colW - 4), MARGIN_X + i * colW + 2, y + 4);
      });
      y += 6;
    });
    y += 4;
  }

  drawFooter();
  return Buffer.from(doc.output('arraybuffer'));
}
