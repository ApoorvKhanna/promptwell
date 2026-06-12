import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readConfig } from './config.js';
import { crispPrompt } from './crisp.js';
import { appendHistory, computeStats } from './analytics.js';

export async function startServer(): Promise<void> {
  const config = readConfig();

  const server = new Server(
    { name: 'promptwell', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'crisp',
        description: 'Restructure a messy user prompt into a clean Fable 5-optimized task spec. Returns crisp_prompt, blueprint with disambiguation_score, and estimated token savings.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            task: { type: 'string', description: 'The raw user task or prompt to optimize' },
            context: { type: 'string', description: 'Optional surrounding context (codebase info, recent decisions)' },
          },
          required: ['task'],
        },
      },
      {
        name: 'score',
        description: 'Record the result of a Fable 5 session that used a crisp prompt. Saves to history for trend analysis.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            original_prompt: { type: 'string', description: 'The original messy prompt before crisp-ifying' },
            disambiguation_score: { type: 'number', description: 'Score returned by crisp() (0-100)' },
            what_was_vague: { type: 'array', items: { type: 'string' }, description: 'Vague items from crisp() result' },
            result_summary: { type: 'string', description: 'One-line summary of what Fable 5 accomplished' },
            tokens_used: { type: 'number', description: 'Optional: actual tokens Fable 5 consumed' },
          },
          required: ['original_prompt', 'disambiguation_score', 'what_was_vague'],
        },
      },
      {
        name: 'stats',
        description: 'Show personal prompt quality trends — average disambiguation score, token savings, top patterns to fix.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'crisp') {
      const { task, context } = args as { task: string; context?: string };
      const result = await crispPrompt(task, config.anthropic_api_key, config.phase1_model, context);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === 'score') {
      const { original_prompt, disambiguation_score, what_was_vague, result_summary, tokens_used } =
        args as {
          original_prompt: string;
          disambiguation_score: number;
          what_was_vague: string[];
          result_summary?: string;
          tokens_used?: number;
        };
      appendHistory({
        timestamp: new Date().toISOString(),
        original_prompt,
        disambiguation_score,
        what_was_vague,
        result_summary,
        tokens_used,
      });
      return {
        content: [{ type: 'text', text: 'Result recorded. Run stats() to see your trends.' }],
      };
    }

    if (name === 'stats') {
      const stats = computeStats();
      const lines = [
        `PromptWell Stats`,
        `Sessions tracked: ${stats.total_sessions}`,
        `Avg disambiguation score: ${stats.avg_disambiguation_score}/100 (lower = crisper)`,
        `7-day avg: ${stats.trend_7d}/100`,
        `30-day avg: ${stats.trend_30d}/100`,
        `Estimated tokens saved: ~${stats.total_estimated_savings.toLocaleString()}`,
        '',
        stats.top_patterns.length
          ? `Top patterns to fix:\n${stats.top_patterns.map(p => `  - ${p}`).join('\n')}`
          : 'No patterns detected yet.',
      ];
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
