/**
 * 风险报告导出 API —— /api/llm/injury-risk/export
 *
 * GET: 导出风险分析报告为 PDF（?reportId=xxx）
 */

import { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { getRiskReportById } from '@/lib/modules/llm/InjuryRiskService';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';
import { applyCNFont } from '@/lib/utils/cnPdfFont';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.HEALTH_READ);
    const { searchParams } = new URL(request.url);
    const reportId = parseInt(searchParams.get('reportId') || '0');

    if (!reportId) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '缺少 reportId 参数' } },
        { status: 400 }
      );
    }

    const report = await getRiskReportById(reportId);
    if (!report) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: '报告不存在' } },
        { status: 404 }
      );
    }

    const pdfBuffer = generateRiskReportPDF(report);

    // 中文文件名必须用 RFC 5987 filename* 编码，否则 Response 构造会崩溃
    const safeName = (report.athlete.name || `athlete-${report.athleteId}`).replace(/[^\w\u4e00-\u9fa5-]/g, '');
    const asciiFallback = `risk-report-${report.athleteId}-${report.id}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}-${report.id}.pdf`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function generateRiskReportPDF(report: any): Buffer {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  applyCNFont(doc, 'normal');

  // ---- 标题 ----
  doc.setFontSize(18);
  applyCNFont(doc, 'bold');
  doc.text('伤病风险评估报告', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  applyCNFont(doc, 'normal');
  doc.text(`生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`, pageWidth / 2, 27, { align: 'center' });

  doc.setDrawColor(200);
  doc.line(14, 32, pageWidth - 14, 32);

  let y = 42;

  // ---- 运动员信息 ----
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('运动员信息', 14, y);
  y += 7;

  doc.setFontSize(10);
  const athleteInfo: Array<[string, string]> = [
    ['姓名', report.athlete.name],
    ['运动项目', report.athlete.sport],
    ['性别', report.athlete.gender === 'MALE' ? '男' : '女'],
  ];
  for (const [label, value] of athleteInfo) {
    applyCNFont(doc, 'bold');
    doc.text(`${label}：`, 14, y);
    applyCNFont(doc, 'normal');
    doc.text(value, 50, y);
    y += 6;
  }

  // ---- 风险等级 ----
  y += 5;
  doc.setFontSize(14);
  applyCNFont(doc, 'bold');
  doc.text('风险评估', 14, y);
  y += 7;

  doc.setFontSize(10);
  applyCNFont(doc, 'bold');
  doc.text('风险等级：', 14, y);
  applyCNFont(doc, 'normal');
  doc.text(report.riskLevel, 50, y);
  y += 6;

  applyCNFont(doc, 'bold');
  doc.text('风险评分：', 14, y);
  applyCNFont(doc, 'normal');
  doc.text(`${report.riskScore} / 100`, 50, y);
  y += 6;

  applyCNFont(doc, 'bold');
  doc.text('分析周期：', 14, y);
  applyCNFont(doc, 'normal');
  doc.text(`${report.weeksRange} 周`, 50, y);
  y += 6;

  applyCNFont(doc, 'bold');
  doc.text('分析引擎：', 14, y);
  applyCNFont(doc, 'normal');
  doc.text(report.provider, 50, y);
  y += 8;

  // ---- 风险因素等章节 ----
  const sections: Array<[string, string]> = [
    ['风险因素', report.riskFactors],
    ['预警信号', report.warningSignals],
    ['预防建议', report.preventionAdvice],
    ['训练调整', report.trainingAdjustment],
  ];

  for (const [title, content] of sections) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    y += 5;
    doc.setFontSize(14);
    applyCNFont(doc, 'bold');
    doc.text(title, 14, y);
    y += 7;

    doc.setFontSize(10);
    applyCNFont(doc, 'normal');
    const lines = doc.splitTextToSize(content, pageWidth - 28);
    for (const line of lines) {
      if (y > pageHeight - 20) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 5;
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
