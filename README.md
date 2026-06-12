# PromptWell

> Stop burning Fable 5 tokens on bad prompts.

Fable 5 is the most capable model available — but it consumes tokens fast when given vague, ambiguous prompts. It has to spend expensive reasoning budget figuring out what you want before it can do the work. PromptWell fixes that.

## What it does

1. **Crisp-ify** — uses Haiku 4.5 (cheap, fast) to restructure your messy prompt into a clean Fable 5-optimized task spec
2. **Score** — rates how ambiguous your original prompt was (0 = crystal clear, 100 = unusable)  
3. **Coach** — tracks your patterns over time and tells you what to fix

## Install

```bash
npx promptwell init
```

Walks you through API key setup and installs PromptWell as an MCP server in your Claude Code config, plus a SKILL.md trigger file so Claude Code knows when to call it automatically.

## Tools

| Tool | What it does |
|---|---|
| `crisp(task, context?)` | Returns `crisp_prompt` + blueprint + disambiguation score |
| `score(...)` | Records Fable 5 session result for trend tracking |
| `stats()` | Shows your prompting trends and top patterns to fix |

## How it works

```
Your messy prompt → Haiku 4.5 (~$0.001) → crisp blueprint JSON
                                                    ↓
                                             Fable 5 gets THIS
                                             (no disambiguation overhead)
```

**Example output from `crisp()`:**
```json
{
  "crisp_prompt": "Goal: Fix JWT token expiry handling...\n\nConstraints:\n- do not change token format\n\nSuccess criteria:\n- auth test suite passes\n\nWhen you have enough information to act, act.",
  "blueprint": {
    "structural_goal": "Fix JWT token expiry in auth middleware",
    "disambiguation_score": 72,
    "what_was_vague": ["no file path specified", "unclear which auth system"]
  },
  "estimated_token_savings": "~2,880 tokens"
}
```

## Requirements

- Node.js 18+
- Anthropic API key (for both Haiku 4.5 and Fable 5)

## Claude Code config (set by `init`)

```json
{
  "mcp_servers": {
    "promptwell": {
      "command": "npx",
      "args": ["promptwell"]
    }
  }
}
```

## License

MIT
