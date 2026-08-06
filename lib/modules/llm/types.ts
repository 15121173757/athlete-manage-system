/**
 * LLM 类型定义 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 定义 LLM Provider 枚举
 * 2. 定义 LLM 配置接口
 * 3. 定义对话消息与响应结构
 */

// ============================================================
// Provider 枚举
// ============================================================

export enum LLMProvider {
  ZHIPU = 'zhipu',
  DEEPSEEK = 'deepseek',
  QWEN = 'qwen',
}

// ============================================================
// 配置接口
// ============================================================

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// ============================================================
// 对话消息
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================
// LLM 响应
// ============================================================

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
}