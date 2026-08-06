/**
 * LLM Provider 实现 —— 运动员管理系统（AMS）
 *
 * 职责：
 * 1. 定义抽象 Provider 基类
 * 2. 实现智谱 GLM、DeepSeek、通义千问三家 Provider
 * 3. 提供 Provider 工厂函数
 *
 * 所有 Provider 使用标准 fetch() 发起 HTTP 请求，无需外部 SDK。
 */

import { LLMProvider, LLMConfig, ChatMessage, LLMResponse } from './types';

// ============================================================
// 抽象基类
// ============================================================

abstract class BaseLLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /** 获取默认 baseUrl（由子类实现） */
  protected abstract getDefaultBaseUrl(): string;

  /**
   * 统一的 chat 接口
   */
  async chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const body = {
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2048,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(`网络请求失败，请检查网络连接或稍后重试`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw this.parseError(response.status, errorText);
    }

    return this.parseResponse(response);
  }

  /** 解析错误响应（由子类实现差异化处理） */
  protected parseError(status: number, body: string): Error {
    switch (status) {
      case 401:
        return new Error('API 密钥无效或未授权，请检查 LLM_API_KEY 配置');
      case 403:
        return new Error('API 密钥权限不足，请检查账户余额或权限配置');
      case 404:
        return new Error('请求的模型不存在，请检查 LLM_MODEL 配置是否正确');
      case 429:
        return new Error('请求过于频繁，请稍后再试');
      case 400:
        return new Error(`请求参数错误：${body || '请检查请求参数'}`);
      default:
        return new Error(`LLM 服务请求失败（状态码 ${status}）：${body || '未知错误'}`);
    }
  }

  /** 解析成功响应 */
  protected async parseResponse(response: Response): Promise<LLMResponse> {
    const data = await response.json();

    const content = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    return {
      content,
      usage,
      provider: this.config.provider,
    };
  }
}

// ============================================================
// 智谱 GLM Provider
// ============================================================

class ZhipuGLMProvider extends BaseLLMProvider {
  protected getDefaultBaseUrl(): string {
    return 'https://open.bigmodel.cn/api/paas/v4';
  }
}

// ============================================================
// DeepSeek Provider
// ============================================================

class DeepSeekProvider extends BaseLLMProvider {
  protected getDefaultBaseUrl(): string {
    return 'https://api.deepseek.com/v1';
  }
}

// ============================================================
// 通义千问 Provider（阿里云百炼）
// ============================================================

class QwenProvider extends BaseLLMProvider {
  protected getDefaultBaseUrl(): string {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }
}

// ============================================================
// 工厂函数
// ============================================================

export function createProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case LLMProvider.ZHIPU:
      return new ZhipuGLMProvider(config);
    case LLMProvider.DEEPSEEK:
      return new DeepSeekProvider(config);
    case LLMProvider.QWEN:
      return new QwenProvider(config);
    default:
      throw new Error(`未知的 LLM Provider：${config.provider}`);
  }
}

export { BaseLLMProvider, ZhipuGLMProvider, DeepSeekProvider, QwenProvider };