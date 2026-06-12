import Anthropic from '@anthropic-ai/sdk';

export interface Blueprint {
  structural_goal: string;
  context: string;
  constraints: string[];
  success_criteria: string[];
  disambiguation_score: number;
  what_was_vague: string[];
}

export interface CrispResult {
  crisp_prompt: string;
  blueprint: Blueprint;
  estimated_token_savings: string;
}

const SYSTEM_PROMPT = `You are a prompt optimizer for Claude Fable 5.

Your job is to restructure a messy or ambiguous user request into a clean, structured task spec that Fable 5 can execute efficiently without spending reasoning tokens on disambiguation.

Output ONLY valid JSON matching this exact schema:
{
  "structural_goal": "string — what must be true when done, one measurable sentence",
  "context": "string — relevant files, systems, prior decisions mentioned",
  "constraints": ["array of strings — what must NOT be changed or broken"],
  "success_criteria": ["array of strings — how to verify completion"],
  "disambiguation_score": number from 0 to 100,
  "what_was_vague": ["array of strings — specific things that were ambiguous or missing"]
}

Disambiguation score guide:
0-20: Crystal clear — specific file paths, exact behavior, measurable outcome
21-50: Decent — goal clear but missing some context or constraints
51-80: Vague — common patterns, fixable
81-100: Unusable — Fable 5 would have to guess major requirements

Rules:
- Do NOT add scope beyond what the user implied
- Do NOT invent requirements
- Only extract and structure what was already there
- Output ONLY the JSON object, no preamble or explanation`;

export async function crispPrompt(
  task: string,
  apiKey: string,
  model: string,
  context?: string,
  _clientForTest?: Anthropic
): Promise<CrispResult> {
  const client = _clientForTest ?? new Anthropic({ apiKey });
  const userMessage = context ? `Task: ${task}\n\nContext: ${context}` : `Task: ${task}`;

  let blueprint: Blueprint | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    try {
      blueprint = JSON.parse(text) as Blueprint;
      // Normalize arrays in case model returns null/undefined
      blueprint.constraints = Array.isArray(blueprint.constraints) ? blueprint.constraints : [];
      blueprint.success_criteria = Array.isArray(blueprint.success_criteria) ? blueprint.success_criteria : [];
      blueprint.what_was_vague = Array.isArray(blueprint.what_was_vague) ? blueprint.what_was_vague : [];
      break;
    } catch {
      if (attempt === 1) throw new Error('Failed to parse blueprint from Haiku response');
    }
  }

  const b = blueprint!;
  const savings = estimateSavings(b.disambiguation_score);

  const crisp_prompt = [
    `Goal: ${b.structural_goal}`,
    b.context ? `Context: ${b.context}` : '',
    b.constraints.length ? `Constraints:\n${b.constraints.map(c => `- ${c}`).join('\n')}` : '',
    b.success_criteria.length
      ? `Success criteria:\n${b.success_criteria.map(s => `- ${s}`).join('\n')}`
      : '',
    `\nWhen you have enough information to act, act. Don't add features or abstractions beyond what the task requires.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    crisp_prompt,
    blueprint: b,
    estimated_token_savings: savings > 0 ? `~${savings.toLocaleString()} tokens` : 'none estimated',
  };
}

export function estimateSavings(score: number): number {
  return Math.round(score * 40);
}
