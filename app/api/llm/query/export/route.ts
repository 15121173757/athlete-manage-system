/**
 * 查询对话导出 API —— /api/llm/query/export
 *
 * POST: 导出查询对话为文本文件
 * Body: { messages: [{ role, content, intent? }] }
 */

import { requirePermission } from '@/lib/auth/AuthMiddleware';
import { Permissions } from '@/types';
import { handleRouteError } from '@/lib/errors/ErrorPresenter';

interface ExportMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
}

export async function POST(request: Request) {
  try {
    await requirePermission(Permissions.LLM_USE);
    const body = await request.json();
    const { messages } = body as { messages: ExportMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '无对话内容可导出' } },
        { status: 400 }
      );
    }

    const text = formatConversationText(messages);
    const buffer = Buffer.from(text, 'utf-8');

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="query-conversation-${Date.now()}.txt"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function formatConversationText(messages: ExportMessage[]): string {
  const lines: string[] = [
    '=================================',
    '  智能查询助手 - 对话记录',
    `  导出时间：${new Date().toLocaleString('zh-CN')}`,
    '=================================',
    '',
  ];

  const intentLabels: Record<string, string> = {
    ATHLETE_INFO: '运动员信息',
    TRAINING_RECORD: '训练记录',
    FITNESS_DATA: '体能测试',
    INJURY_HISTORY: '伤病记录',
    PB_QUERY: 'PB 纪录',
    TEAM_OVERVIEW: '全队概况',
    GENERAL: '通用',
  };

  for (const msg of messages) {
    const role = msg.role === 'user' ? '【用户】' : '【助手】';
    const intent = msg.intent ? ` [${intentLabels[msg.intent] || msg.intent}]` : '';
    lines.push(`${role}${intent}`);
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
