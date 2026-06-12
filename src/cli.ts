#!/usr/bin/env node
import { input, password, select } from '@inquirer/prompts';
import { writeConfig, configExists, CONFIG_PATH } from './config.js';
import { computeStats } from './analytics.js';
import { startServer } from './server.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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
  console.log('\nAdd to your Claude Code MCP config (~/.claude/mcp.json):');
  console.log(
    JSON.stringify(
      { mcp_servers: { promptwell: { command: 'npx', args: ['promptwell'] } } },
      null,
      2
    )
  );
  console.log('\nDone. Use crisp() in Claude Code to optimize your Fable 5 prompts.\n');
}

async function runStats(): Promise<void> {
  const stats = computeStats();
  if (stats.total_sessions === 0) {
    console.log('\nNo sessions tracked yet. Use crisp() in Claude Code to get started.\n');
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

if (command === 'init') {
  runInit().catch(console.error);
} else if (command === 'stats') {
  runStats().catch(console.error);
} else {
  startServer().catch(console.error);
}
