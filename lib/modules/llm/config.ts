/**
 * LLM 配置管理 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 从环境变量读取 LLM 配置
 * 2. 校验配置有效性
 * 3. 提供统一的 getLLMConfig() 入口
 *
 * 环境变量（优先级从高到低）：
 *   LLM_PROVIDER          —— 当前启用的 Provider（zhipu | deepseek | qwen）
 *   LLM_API_KEY           —— 统一 API Key（优先）
 *   LLM_MODEL             —— 模型名称（优先）
 *   LLM_BASE_URL          —— 自定义接口地址（可选）
 *   LLM_TEMPERATURE       —— 温度参数（0-1）
 *   LLM_MAX_TOKENS        —— 最大 token 数
 *
 * 备选（按 Provider 区分，兼容旧配置）：
 *   ZHIPU_API_KEY / ZHIPU_MODEL
 *   DEEPSEEK_API_KEY / DEEPSEEK_MODEL
 *   QWEN_API_KEY / QWEN_MODEL
 */

import { LLMProvider, LLMConfig } from './types';

// ============================================================
// 默认模型映射
// ============================================================

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  [LLMProvider.ZHIPU]: 'glm-4',
  [LLMProvider.DEEPSEEK]: 'deepseek-chat',
  [LLMProvider.QWEN]: 'qwen-turbo',
};

// ============================================================
// 读取环境变量的辅助方法
// ============================================================

function getEnv(key: string, fallback?: string): string | undefined {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  return fallback;
}

// ============================================================
// 获取 LLM 配置
// ============================================================

export function getLLMConfig(): LLMConfig {
  // ---- Provider ----
  const providerStr = getEnv('LLM_PROVIDER', getEnv('MODEL_PROVIDER', 'deepseek')) as string;
  const provider = validateProvider(providerStr);

  // ---- API Key（优先统一 Key，回退到各 Provider 独立 Key）----
  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    throw new Error(
      '未配置 LLM API Key。请设置环境变量 LLM_API_KEY 或对应 Provider 的 API Key（如 DEEPSEEK_API_KEY）'
    );
  }

  // ---- Model ----
  const model = resolveModel(provider);

  // ---- Base URL（可选覆盖）----
  const baseUrl = getEnv('LLM_BASE_URL');

  // ---- 其他参数 ----
  const temperature = parseFloat(getEnv('LLM_TEMPERATURE', '0.7') || '0.7');
  const maxTokens = parseInt(getEnv('LLM_MAX_TOKENS', '2048') || '2048', 10);

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    temperature: isNaN(temperature) ? 0.7 : temperature,
    maxTokens: isNaN(maxTokens) ? 2048 : maxTokens,
  };
}

// ============================================================
// 辅助函数
// ============================================================

function validateProvider(provider: string): LLMProvider {
  const valid = Object.values(LLMProvider) as string[];
  if (!valid.includes(provider)) {
    throw new Error(
      `无效的 LLM Provider：「${provider}」。可选值：${valid.join('、')}`
    );
  }
  return provider as LLMProvider;
}

function resolveApiKey(provider: LLMProvider): string | undefined {
  // 优先使用统一的 LLM_API_KEY
  const unified = getEnv('LLM_API_KEY');
  if (unified) return unified;

  // 回退到各 Provider 独立的 API Key
  const envMap: Record<LLMProvider, string> = {
    [LLMProvider.ZHIPU]: 'ZHIPU_API_KEY',
    [LLMProvider.DEEPSEEK]: 'DEEPSEEK_API_KEY',
    [LLMProvider.QWEN]: 'QWEN_API_KEY',
  };
  return getEnv(envMap[provider]);
}

function resolveModel(provider: LLMProvider): string {
  // 优先使用统一的 LLM_MODEL
  const unified = getEnv('LLM_MODEL');
  if (unified) return unified;

  // 回退到各 Provider 独立的模型配置
  const envMap: Record<LLMProvider, string> = {
    [LLMProvider.ZHIPU]: 'ZHIPU_MODEL',
    [LLMProvider.DEEPSEEK]: 'DEEPSEEK_MODEL',
    [LLMProvider.QWEN]: 'QWEN_MODEL',
  };
  return getEnv(envMap[provider], DEFAULT_MODELS[provider])!;
}