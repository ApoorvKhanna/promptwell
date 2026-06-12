import fs from 'fs';
import path from 'path';
import { CONFIG_DIR } from './config.js';

export const HISTORY_PATH = path.join(CONFIG_DIR, 'history.json');

export interface HistoryEntry {
  timestamp: string;
  original_prompt: string;
  disambiguation_score: number;
  what_was_vague: string[];
  result_summary?: string;
  tokens_used?: number;
  estimated_savings?: number;
}

export interface Stats {
  total_sessions: number;
  avg_disambiguation_score: number;
  total_estimated_savings: number;
  top_patterns: string[];
  trend_7d: number;
  trend_30d: number;
}

export function appendHistory(entry: HistoryEntry): void {
  const history = readHistory();
  history.push(entry);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

export function readHistory(): HistoryEntry[] {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')) as HistoryEntry[];
}

export function computeStats(): Stats {
  const history = readHistory();
  if (history.length === 0) {
    return { total_sessions: 0, avg_disambiguation_score: 0, total_estimated_savings: 0, top_patterns: [], trend_7d: 0, trend_30d: 0 };
  }

  const now = Date.now();
  const d7 = history.filter(e => now - new Date(e.timestamp).getTime() < 7 * 86400000);
  const d30 = history.filter(e => now - new Date(e.timestamp).getTime() < 30 * 86400000);

  const avg = (arr: HistoryEntry[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, e) => s + e.disambiguation_score, 0) / arr.length;

  const patternCounts: Record<string, number> = {};
  for (const entry of history) {
    for (const p of entry.what_was_vague) {
      patternCounts[p] = (patternCounts[p] ?? 0) + 1;
    }
  }
  const top_patterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => `${pattern} (seen ${count}x)`);

  return {
    total_sessions: history.length,
    avg_disambiguation_score: Math.round(avg(history)),
    total_estimated_savings: history.reduce((s, e) => s + (e.estimated_savings ?? 0), 0),
    top_patterns,
    trend_7d: Math.round(avg(d7)),
    trend_30d: Math.round(avg(d30)),
  };
}
