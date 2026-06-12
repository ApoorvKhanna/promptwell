---
name: promptwell
description: Use before any complex task you're about to hand to Claude Fable 5 — especially when your prompt is vague, missing file paths, or unclear on success criteria. Crisp-ifying first cuts Fable 5 token usage by 30-70% by eliminating disambiguation overhead. Also use when you want to check your prompt quality score or review your prompting trends. Trigger when the user asks to "crisp" a prompt, mentions they're about to use Fable 5, or wants to know their prompting stats.
---

# PromptWell — Prompt optimizer for Claude Fable 5

Use this MCP to make your prompts crisp before Fable 5 sees them.

## When to call crisp()

- You're about to hand a task to Fable 5 and the prompt is longer than one sentence but still feels vague
- The task is missing file paths, unclear on what "done" looks like, or has no stated constraints
- You want to know how many tokens you'd save by cleaning up the prompt

## Flow

1. Call `mcp__promptwell__crisp({ task: "your raw prompt" })` — optionally pass `context` with relevant codebase info
2. Read the `crisp_prompt` from the result — use THIS as your Fable 5 prompt instead of the original
3. Check `disambiguation_score` — lower is better (0 = crystal clear, 100 = unusable)
4. Review `what_was_vague` — these are the specific things that were ambiguous
5. After Fable 5 finishes, call `mcp__promptwell__score()` with the result to track your improvement trend

## Record results

After completing a task with a crisp prompt, call:
```
mcp__promptwell__score({
  original_prompt: "the messy prompt you started with",
  disambiguation_score: <score from crisp()>,
  what_was_vague: [<array from crisp()>],
  result_summary: "one line: what Fable 5 accomplished",
  tokens_used: <optional: actual token count>
})
```

## Check your trends

Call `mcp__promptwell__stats()` to see:
- Your average disambiguation score over time (lower = you're getting crisper)
- 7-day and 30-day averages
- Estimated total tokens saved
- Top prompting patterns to fix
