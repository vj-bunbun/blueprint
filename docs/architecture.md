# Architecture

Blueprint is a pipeline: discover sections, resolve content, enforce budgets, format output.

## Pipeline

```
Section Files → Discover → Filter → Resolve → Sort → Budget → Concatenate → Format → Output
```

### 1. Discover
Find all `.md` files in the prompt directory. Parse YAML frontmatter for assembly metadata.

### 2. Filter
Remove sections with a `provider` field that doesn't match the target provider.

### 3. Resolve
Process `{{include path}}` directives first (file inclusion), then `{{var_name}}` substitution. Includes are single-depth — no recursion.

### 4. Sort
Order sections by the `order` field (ascending). Ties broken alphabetically by section name.

### 5. Budget
Two passes:
- **Per-section**: Truncate any section that exceeds its own `budget` field
- **Global**: Walk sections in order. Include if fits. Truncate if partial room. Cut if not. Required sections always survive.

### 6. Concatenate
Static sections first, then dynamic sections. A cache boundary marker separates them (used by providers that support prompt caching).

### 7. Format
Wrap the output for the target provider:
- `raw` — plain text
- `anthropic` — JSON with `cache_control` blocks
- `openai` — JSON system message
- `google` — JSON `systemInstruction`

## Token Estimation

Blueprint uses character-based estimation (no external tokenizer dependency):

| Provider | Chars/Token | Default Budget |
|---|---|---|
| default | 4.0 | 16,000 |
| anthropic | 3.5 | 16,000 |
| openai | 4.0 | 12,000 |
| google | 4.0 | 12,000 |
| local | 4.5 | 8,000 |

Conservative estimates ensure you stay within limits. For exact token counts, use your provider's tokenizer.

## How It Fits with Claude Code

Claude Code (Anthropic's CLI agent) assembles its system prompt from multiple sources via `fetchSystemPromptParts()`:

1. **Tool descriptions** — 40+ built-in tools, each contributing a prompt section
2. **Permission rules** — current permission mode and allow/deny rules
3. **CLAUDE.md files** — loaded lazily from the working directory
4. **Skills** — injected on demand via tool results
5. **Auto-memory** — files from `~/.claude/projects/<hash>/memory/`

**Blueprint writes into source #3.** When you run:

```bash
bun run build.ts --dir ~/my-prompts --execute --output ~/my-project/CLAUDE.md
```

Blueprint's assembled output becomes part of Claude Code's system prompt. Every conversation — and every sub-agent Claude Code spawns — sees your sections.

### Why Cache Boundaries Matter for Claude Code

Claude Code makes many API calls per session (one per tool-use loop iteration). Anthropic's prompt caching means static system prompt content is cached and billed at reduced rates on subsequent calls.

Blueprint's static/dynamic split aligns with this: identity, tools, and instructions (static, above the cache break) are cached across all API calls in a session. Context and memory (dynamic, below the break) pay full price but change per build. This can significantly reduce API costs for long Claude Code sessions.

### Sub-Agent Inheritance

Claude Code spawns sub-agents (via AgentTool) with fresh message arrays but the **same system prompt**. This means Blueprint-assembled content in CLAUDE.md is available to every agent in a session — the main agent, research agents, code-writing agents, all of them.

## Cache Boundaries

Static sections (identity, tools, instructions) change rarely. Dynamic sections (context, memory) change per conversation.

Anthropic's prompt caching charges less for repeated static prefixes. By splitting at the cache boundary, you pay full price only for the changing part. Other providers ignore the boundary — the output is the same either way.
