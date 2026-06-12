import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendHistory, computeStats, HISTORY_PATH } from '../analytics.js';
import fs from 'fs';

vi.mock('fs');

const makeEntry = (score: number, daysAgo = 0) => ({
  timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  original_prompt: 'fix the bug',
  disambiguation_score: score,
  what_was_vague: ['no file path'],
  estimated_savings: 800,
});

beforeEach(() => vi.resetAllMocks());

describe('appendHistory', () => {
  it('creates new history file when missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    appendHistory(makeEntry(60));

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      HISTORY_PATH,
      expect.stringContaining('"disambiguation_score": 60')
    );
  });

  it('appends to existing history', () => {
    const existing = [makeEntry(40)];
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existing));
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    appendHistory(makeEntry(70));

    const written = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    );
    expect(written).toHaveLength(2);
    expect(written[1].disambiguation_score).toBe(70);
  });
});

describe('computeStats', () => {
  it('returns zeros when no history', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const stats = computeStats();
    expect(stats.total_sessions).toBe(0);
    expect(stats.avg_disambiguation_score).toBe(0);
  });

  it('computes averages and trends correctly', () => {
    const entries = [
      makeEntry(80, 20),
      makeEntry(60, 5),
      makeEntry(40, 1),
    ];
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries));

    const stats = computeStats();
    expect(stats.total_sessions).toBe(3);
    expect(stats.avg_disambiguation_score).toBeCloseTo(60, 0);
    expect(stats.trend_7d).toBeCloseTo(50, 0);
  });

  it('surfaces top repeated vague patterns', () => {
    const entries = [
      { ...makeEntry(70), what_was_vague: ['no file path', 'unclear scope'] },
      { ...makeEntry(60), what_was_vague: ['no file path'] },
      { ...makeEntry(50), what_was_vague: ['no success criteria'] },
    ];
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries));

    const stats = computeStats();
    expect(stats.top_patterns[0]).toContain('no file path');
  });
});
