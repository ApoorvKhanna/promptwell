#!/usr/bin/env node
import { input, password, select } from '@inquirer/prompts';
import { writeConfig, configExists, CONFIG_PATH, readConfig } from './config.js';
import { computeStats, appendHistory, savePending, loadPending, clearPending } from './analytics.js';
import { crispPrompt, estimateSavings } from './crisp.js';
import { startServer } from './server.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const command = process.argv[2];

async function runInit(): Promise<void> {
  console.log('\nPromptWell — Prompt optimizer for Claude Fable 5\n');

  if (configExists()) {
    console.log(`Config already exists at ${CONFIG_PATH}`);
    const overwrite = await select({
      message: 'Overwrite?',
      choices: [
        { value: false, name: 'No, keep existing' },
        { value: true, name: 'Yes, overwrite' },
      ],
    });
    if (!overwrite) {
      console.log('Keeping existing config.\n');
      return;
    }
  }

  const anthropic_api_key = await password({
    message: 'Anthropic API key (sk-ant-...):',
    mask: '*',
  });

  const effort = await select<'low' | 'high' | 'xhigh'>({
    message: 'Default Fable 5 effort level:',
    choices: [
      { value: 'xhigh', name: 'xhigh — deep coding/agentic tasks (recommended)' },
      { value: 'high', name: 'high — most tasks' },
      { value: 'low', name: 'low — quick answers' },
    ],
  });

  writeConfig({ anthropic_api_key, effort, phase1_model: 'claude-haiku-4-5' });

  // Install SKILL.md to ~/.claude/skills/promptwell/
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const skillSrc = path.join(__dirname, '..', 'SKILL.md');
  const skillDir = path.join(os.homedir(), '.claude', 'skills', 'promptwell');
  const skillDst = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillSrc)) {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.copyFileSync(skillSrc, skillDst);
    console.log(`\nSKILL.md installed to ${skillDst}`);
  } else {
    console.warn('Warning: SKILL.md not found — skill trigger file was not installed. This is a packaging issue; please report it.');
  }

  console.log(`Config saved to ${CONFIG_PATH}`);

  // Auto-install into ~/.claude/mcp.json
  const mcpConfigPath = path.join(os.homedir(), '.claude', 'mcp.json');
  try {
    const existing = fs.existsSync(mcpConfigPath)
      ? JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'))
      : {};
    existing.mcpServers = existing.mcpServers ?? {};
    const cliPath = path.resolve(__dirname, '..', 'dist', 'cli.js');
    existing.mcpServers.promptwell = { command: 'node', args: [cliPath] };
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(existing, null, 2));
    console.log(`MCP server added to ${mcpConfigPath}`);
    console.log('Restart Claude Code to pick it up.');
  } catch {
    const cliPath = path.resolve(__dirname, '..', 'dist', 'cli.js');
    console.log('\nCould not auto-update MCP config. Add this manually to ~/.claude/mcp.json:');
    console.log(JSON.stringify({ mcpServers: { promptwell: { command: 'node', args: [cliPath] } } }, null, 2));
  }

  console.log('\nYou\'re ready. Here\'s how to use it:\n');
  console.log('  npx promptwell crisp "your task"   — optimize a prompt before Fable 5');
  console.log('  npx promptwell score               — record what Fable 5 accomplished');
  console.log('  npx promptwell stats               — see your improvement over time\n');

  // Open welcome page in default browser
  const welcomePath = path.join(__dirname, '..', 'welcome.html');
  if (fs.existsSync(welcomePath)) {
    const opener = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${opener} "${welcomePath}"`);
  }
}

async function runStats(): Promise<void> {
  const stats = computeStats();
  if (stats.total_sessions === 0) {
    console.log('\nNo sessions tracked yet. Run: npx promptwell crisp "your task"\n');
    return;
  }
  console.log('\nPromptWell Stats');
  console.log(`Sessions tracked: ${stats.total_sessions}`);
  console.log(`Avg disambiguation score: ${stats.avg_disambiguation_score}/100 (lower = crisper)`);
  console.log(`7-day avg:  ${stats.trend_7d}/100`);
  console.log(`30-day avg: ${stats.trend_30d}/100`);
  console.log(`Estimated tokens saved: ~${stats.total_estimated_savings.toLocaleString()}`);
  if (stats.top_patterns.length) {
    console.log('\nTop patterns to fix:');
    for (const p of stats.top_patterns) console.log(`  - ${p}`);
  }
  console.log('');
}

async function runCrisp(): Promise<void> {
  const task = process.argv.slice(3).join(' ').trim();
  if (!task) {
    console.log('\nUsage: npx promptwell crisp "describe your task here"\n');
    process.exit(1);
  }
  if (!configExists()) {
    console.log('\nNot set up yet. Run: npx promptwell init\n');
    process.exit(1);
  }
  const config = readConfig();
  console.log('\nAnalyzing your prompt...\n');

  const result = await crispPrompt(task, config.anthropic_api_key, config.phase1_model);
  const { blueprint, crisp_prompt, estimated_token_savings } = result;
  const score = blueprint.disambiguation_score;
  const label = score <= 20 ? 'crystal clear' : score <= 50 ? 'decent' : score <= 80 ? 'vague' : 'very vague';
  const bar = '─'.repeat(56);

  // Show score + what was unclear before asking questions
  console.log(`Score: ${score}/100  (${label})`);
  if (blueprint.what_was_vague.length) {
    console.log('What was unclear:');
    for (const v of blueprint.what_was_vague) console.log(`  • ${v}`);
  }

  // Brainstorm — ask targeted clarifying questions, user can skip each
  const answered: Array<{ about: string; answer: string }> = [];
  const questions = blueprint.clarifying_questions ?? [];
  if (questions.length > 0) {
    const n = questions.length;
    console.log(`\nI have ${n} quick question${n > 1 ? 's' : ''} — answer what you know, press enter to skip any.\n`);
    for (const q of questions) {
      const answer = await input({ message: q.question });
      if (answer.trim()) answered.push({ about: q.about, answer: answer.trim() });
    }
    console.log('');
  }

  // Build final prompt: base crisp prompt + any answers the user provided
  const finalPrompt = answered.length
    ? `${crisp_prompt}\n\nClarified details:\n${answered.map(a => `- ${a.about}: ${a.answer}`).join('\n')}`
    : crisp_prompt;

  console.log(bar);
  console.log('Copy this to Fable 5:');
  console.log(bar);
  console.log(finalPrompt);
  console.log(bar);
  console.log(`Estimated savings: ${estimated_token_savings}`);
  console.log('\nRun  npx promptwell score  after Fable 5 finishes to track your improvement.\n');

  savePending({
    task,
    disambiguation_score: score,
    what_was_vague: blueprint.what_was_vague,
    crisp_prompt: finalPrompt,
    estimated_savings: estimateSavings(score),
    timestamp: new Date().toISOString(),
  });
}

async function runScore(): Promise<void> {
  const pending = loadPending();
  if (!pending) {
    console.log('\nNo recent crisp session found. Run  npx promptwell crisp "task"  first.\n');
    process.exit(0);
  }

  console.log('\nRecording your last session...');
  console.log(`Original prompt: "${pending.task}"`);
  console.log(`Score was: ${pending.disambiguation_score}/100\n`);

  const result_summary = await input({ message: 'What did Fable 5 accomplish? (one line):' });
  const tokensStr = await input({ message: 'Tokens used? (press enter to skip):' });
  const tokens_used = tokensStr.trim() ? parseInt(tokensStr.trim(), 10) : undefined;

  appendHistory({
    timestamp: pending.timestamp,
    original_prompt: pending.task,
    disambiguation_score: pending.disambiguation_score,
    what_was_vague: pending.what_was_vague,
    result_summary,
    tokens_used,
    estimated_savings: pending.estimated_savings,
  });
  clearPending();

  const stats = computeStats();
  console.log(`\nSaved. Your all-time avg: ${stats.avg_disambiguation_score}/100  |  7-day avg: ${stats.trend_7d}/100`);
  if (stats.top_patterns.length) {
    console.log(`Top pattern to fix: ${stats.top_patterns[0]}`);
  }
  console.log('');
}

if (command === 'init') {
  runInit().catch(console.error);
} else if (command === 'crisp') {
  runCrisp().catch(console.error);
} else if (command === 'score') {
  runScore().catch(console.error);
} else if (command === 'stats') {
  runStats().catch(console.error);
} else {
  startServer().catch(console.error);
}
