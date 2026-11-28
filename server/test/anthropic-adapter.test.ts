import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const { AnthropicProvider, rejectsForcedToolChoice, rejectsSampling } = await import(
  '../src/adapters/llm/anthropic.js'
);

const Out = z.object({ verdict: z.string() });

function toolUseResponse(input: unknown, id = 'tu_1') {
  return {
    content: [{ type: 'tool_use', id, name: 'Out', input }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function run(model: string) {
  return new AnthropicProvider('k').completeStructured({
    model,
    schema: Out,
    schemaName: 'Out',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'review' },
    ],
  });
}

describe('AnthropicProvider model-aware params', () => {
  beforeEach(() => create.mockReset());

  it('classifies models', () => {
    expect(rejectsForcedToolChoice('claude-opus-5-5')).toBe(true);
    expect(rejectsForcedToolChoice('claude-3-5-sonnet-latest')).toBe(false);
    expect(rejectsSampling('claude-opus-5-5')).toBe(true);
    expect(rejectsSampling('claude-3-5-haiku-latest')).toBe(false);
  });

  it('Opus 5.5: auto tool_choice, no temperature, bigger token cap, steering instruction', async () => {
    create.mockResolvedValue(toolUseResponse({ verdict: 'approve' }));
    const res = await run('claude-opus-5-5');
    expect(res.data).toEqual({ verdict: 'approve' });

    const body = create.mock.calls[0]![0];
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body).not.toHaveProperty('temperature');
    expect(body.max_tokens).toBe(16_000);
    expect(body.system).toContain('sys');
    expect(body.system).toContain('`Out` tool');
    expect(res.costUsd).not.toBeNull();
  });

  it('older model: request unchanged (forced tool, temperature 0, 4096 tokens)', async () => {
    create.mockResolvedValue(toolUseResponse({ verdict: 'approve' }));
    await run('claude-3-5-sonnet-latest');

    const body = create.mock.calls[0]![0];
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'Out' });
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('sys');
  });

  it('reprompt answers an invalid tool_use with a tool_result', async () => {
    create
      .mockResolvedValueOnce(toolUseResponse({ wrong: 1 }, 'tu_bad'))
      .mockResolvedValueOnce(toolUseResponse({ verdict: 'comment' }, 'tu_ok'));
    const res = await run('claude-opus-5-5');
    expect(res.data).toEqual({ verdict: 'comment' });
    expect(res.attempts).toBe(2);

    const second = create.mock.calls[1]![0].messages;
    const reprompt = second[second.length - 1];
    expect(reprompt.role).toBe('user');
    expect(reprompt.content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tu_bad',
      is_error: true,
    });
  });

  it('reprompt with no tool_use falls back to a plain user message', async () => {
    create
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'here is my review' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })
      .mockResolvedValueOnce(toolUseResponse({ verdict: 'approve' }));
    await run('claude-opus-5-5');
    const second = create.mock.calls[1]![0].messages;
    expect(typeof second[second.length - 1].content).toBe('string');
  });
});
