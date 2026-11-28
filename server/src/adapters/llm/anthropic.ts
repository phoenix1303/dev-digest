import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResult,
  StructuredRequest,
  StructuredResult,
  ChatMessage,
} from '@devdigest/shared';
import { withRetry, withTimeout } from '../../platform/resilience.js';
import { toJsonSchema, parseWithRepair } from '@devdigest/reviewer-core';
import { estimateCost } from './pricing.js';
import { ExternalServiceError } from '../../platform/errors.js';

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 4096;
/** Always-thinking models spend output tokens and time on reasoning first. */
const THINKING_MAX_TOKENS = 16_000;
const THINKING_TIMEOUT = 300_000;

/**
 * Claude Opus 5.5, Sonnet 5.5, Fable 5.1/5.2 (and Mythos 5.1/5.2) reject a
 * forced `tool_choice` (`tool` / `any`) with a 400.
 */
export function rejectsForcedToolChoice(model: string): boolean {
  return /^claude-(opus-5-5|sonnet-5-5|fable-5-[12]|mythos-5-[12])/.test(model);
}

/**
 * Newer Claude models removed sampling params: a custom `temperature` is a 400.
 * They also think by default (adaptive), so they need a larger token budget.
 */
export function rejectsSampling(model: string): boolean {
  return /^claude-(fable|mythos|opus-5|opus-4-[78]|sonnet-5|haiku-5)/.test(model);
}

/** Build the model-appropriate temperature / token-cap / timeout params. */
export function tuningParams(
  model: string,
  temperature: number,
  maxTokens: number | undefined,
  timeoutMs: number | undefined,
): { temperature?: number; max_tokens: number; timeoutMs: number } {
  if (rejectsSampling(model)) {
    return {
      max_tokens: maxTokens ?? THINKING_MAX_TOKENS,
      timeoutMs: timeoutMs ?? THINKING_TIMEOUT,
    };
  }
  return {
    temperature,
    max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT,
  };
}

/** Anthropic has no embeddings API; embeddings come from the OpenAI Embedder. */
function splitSystem(messages: ChatMessage[]): {
  system: string;
  rest: Anthropic.MessageParam[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  return { system, rest };
}

/**
 * Anthropic LLMProvider.
 * - listModels: dynamic via GET /models.
 * - completeStructured: tool-use (single tool, input_schema = our JSON schema).
 *   tool_choice forces it, except on models that reject a forced tool_choice
 *   (Opus 5.5 & co.) — there `auto` + a system instruction. Parse
 *   tool_use.input, Zod validate + reprompt.
 * - embed: NOT supported (throws) — use the OpenAI Embedder for vectors.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return withRetry(async () => {
      // SDK 0.33 exposes models.list()
      const res = await this.client.models.list();
      return res.data.map((m) => ({
        id: m.id,
        provider: 'anthropic' as const,
        label: m.display_name,
      }));
    });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const { timeoutMs, ...params } = tuningParams(
      req.model,
      req.temperature ?? 0.2,
      req.maxTokens,
      req.timeoutMs,
    );
    return withRetry(() => withTimeout(this.doComplete(req, params), timeoutMs));
  }

  private async doComplete(
    req: CompletionRequest,
    params: { temperature?: number; max_tokens: number },
  ): Promise<CompletionResult> {
    const { system, rest } = splitSystem(req.messages);
    const res = await this.client.messages.create({
      model: req.model,
      system: system || undefined,
      messages: rest,
      ...params,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const tokensIn = res.usage.input_tokens;
    const tokensOut = res.usage.output_tokens;
    return {
      text,
      model: req.model,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(req.model, tokensIn, tokensOut),
    };
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const maxRetries = req.maxRetries ?? 2;
    const { system: baseSystem, rest } = splitSystem(req.messages);
    const forced = !rejectsForcedToolChoice(req.model);
    // Without a forced tool_choice the model may answer in prose — steer it.
    const system = forced
      ? baseSystem
      : [baseSystem, `Always return your final answer by calling the \`${toolName}\` tool exactly once. Do not answer in plain text.`]
          .filter(Boolean)
          .join('\n\n');
    const { timeoutMs, ...params } = tuningParams(
      req.model,
      req.temperature ?? 0,
      req.maxTokens,
      req.timeoutMs,
    );
    const messages: Anthropic.MessageParam[] = [...rest];
    let tokensIn = 0;
    let tokensOut = 0;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await withRetry(() =>
        withTimeout(
          this.client.messages.create({
            model: req.model,
            system: system || undefined,
            messages,
            ...params,
            tools: [
              {
                name: toolName,
                description: `Return the result as ${req.schemaName}.`,
                input_schema: jsonSchema.schema as Anthropic.Tool.InputSchema,
              },
            ],
            tool_choice: forced ? { type: 'tool', name: toolName } : { type: 'auto' },
          }),
          timeoutMs,
        ),
      );
      tokensIn += res.usage.input_tokens;
      tokensOut += res.usage.output_tokens;

      const toolUse = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      lastRaw = toolUse ? JSON.stringify(toolUse.input) : '';

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: estimateCost(req.model, tokensIn, tokensOut),
          raw: lastRaw,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: res.content });
      // A tool_use block must be answered with a tool_result, or the API 400s.
      messages.push({
        role: 'user',
        content: toolUse
          ? [
              {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                is_error: true,
                content: parsed.repromptMessage,
              },
            ]
          : parsed.repromptMessage,
      });
    }

    throw new ExternalServiceError('Anthropic structured output failed schema validation', {
      raw: lastRaw,
    });
  }

  async embed(): Promise<number[][]> {
    throw new ExternalServiceError(
      'Anthropic does not provide embeddings; use the OpenAI Embedder.',
    );
  }
}
