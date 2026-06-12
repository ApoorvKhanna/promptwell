import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crispPrompt, estimateSavings } from '../crisp.js';
import Anthropic from '@anthropic-ai/sdk';

vi.mock('@anthropic-ai/sdk');

const mockBlueprint = {
  structural_goal: 'Fix JWT token expiry in auth middleware',
  context: 'src/auth/middleware.ts',
  constraints: ['do not change token format'],
  success_criteria: ['auth test suite passes'],
  disambiguation_score: 72,
  what_was_vague: ['no file path specified', 'unclear which auth system'],
};

beforeEach(() => vi.resetAllMocks());

describe('crispPrompt', () => {
  it('returns blueprint from valid Haiku response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockBlueprint) }],
    });
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const result = await crispPrompt('fix the auth bug', 'sk-ant-test', 'claude-haiku-4-5');
    expect(result.blueprint.disambiguation_score).toBe(72);
    expect(result.blueprint.what_was_vague).toHaveLength(2);
    expect(result.crisp_prompt).toContain('Fix JWT token expiry');
  });

  it('retries once on JSON parse failure then throws', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
    });
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    await expect(crispPrompt('fix the auth bug', 'sk-ant-test', 'claude-haiku-4-5'))
      .rejects.toThrow('Failed to parse blueprint');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe('estimateSavings', () => {
  it('returns 0 for score 0', () => {
    expect(estimateSavings(0)).toBe(0);
  });

  it('returns more savings for higher scores', () => {
    expect(estimateSavings(80)).toBeGreaterThan(estimateSavings(20));
  });
});
