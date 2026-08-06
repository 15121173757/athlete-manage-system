/**
 * 智能查询助手页 —— /analysis/query
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
}

const SUGGESTED_QUESTIONS = [
  '全队有多少运动员？',
  '当前有哪些运动员在伤病名单中？',
  '最近一周的训练记录有多少条？',
  '谁的个人最好成绩最多？',
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

export default function QueryAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question ?? input.trim();
    if (!q || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();

      if (json.success) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: json.data.answer,
          intent: json.data.intent,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: `查询失败：${json.error?.message || '未知错误'}`,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '网络错误，请稍后重试。',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExport = async () => {
    if (messages.length === 0) return;
    try {
      const res = await fetch('/api/llm/query/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-conversation-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert('导出失败');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-ams-primary" />
          <h2 className="text-xl font-semibold text-ams-text-primary">智能查询助手</h2>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出对话
          </Button>
        )}
      </div>

      {/* 对话区域 */}
      <div className="ams-card flex-1 flex flex-col overflow-hidden">
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageSquare className="h-12 w-12 text-ams-text-muted" />
              <p className="mt-3 text-ams-text-secondary">我是智能查询助手，可以帮你查询运动员数据</p>
              <p className="text-sm text-ams-text-muted">试试以下问题：</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-ams border border-ams-border bg-ams-background px-3 py-1.5 text-sm text-ams-text-secondary hover:border-ams-primary hover:text-ams-primary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-ams px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-ams-primary text-white'
                    : 'bg-ams-surface-hover text-ams-text-primary'
                }`}
              >
                {msg.role === 'assistant' && msg.intent && (
                  <div className="mb-1">
                    <span className="rounded-full bg-ams-primary/10 px-2 py-0.5 text-xs text-ams-primary">
                      {intentLabels[msg.intent] || msg.intent}
                    </span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-ams bg-ams-surface-hover px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ams-text-muted" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ams-text-muted" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ams-text-muted" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区 */}
        <div className="border-t border-ams-border p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题，如：张三最近训练情况如何？"
              className="flex-1 rounded-ams bg-ams-background border border-ams-border px-4 py-2.5 text-sm text-ams-text-primary focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary"
              disabled={isLoading}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
