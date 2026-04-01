# Blueprint

**A build system for system prompts.**

Most AI apps manage their system prompt as a single string — hard to reuse, hard to version, and impossible to optimize across providers. Blueprint gives it structure — ordered sections, token budgets, cache boundaries, and provider-specific output. Same source files, any provider.

## How It Works

Your system prompt lives as separate markdown files, each responsible for one thing:

```
my-prompts/
├── 10-identity.md       ← Who the AI is
├── 20-tools.md          ← Available tools
├── 30-instructions.md   ← Behavioral rules
├── 80-context.md        ← Project context (dynamic)
└── 90-memory.md         ← Session memory (dynamic)
```

Blueprint reads them, respects your token budget, splits at cache boundaries, and outputs in any provider's format.

## Quick Start

```bash
# Clone and install
git clone https://github.com/vj-bunbun/blueprint.git
cd blueprint/scripts && bun install

# Scaffold a prompt directory
bun run init.ts ~/my-prompts

# Edit the section files to match your needs

# Preview what would be assembled
bun run build.ts --dir ~/my-prompts

# Build and copy to clipboard
bun run build.ts --dir ~/my-prompts --execute --clipboard

# Build for a specific provider
bun run build.ts --dir ~/my-prompts --execute --provider anthropic --output prompt.json
```

## What's In the Box

### `build.ts` — The core value
Assembles section files into a single system prompt within a token budget.

```bash
bun run build.ts --dir ~/my-prompts                    # dry-run (default)
bun run build.ts --dir ~/my-prompts --execute          # assemble to stdout
bun run build.ts --dir ~/my-prompts --execute --clipboard
bun run build.ts --dir ~/my-prompts --provider anthropic --budget 16000 --execute
bun run build.ts --dir ~/my-prompts --var agent_name=Claude --execute
```

### `init.ts` — Scaffold a prompt directory
Creates starter section files and sets the default prompt directory in `~/.airc`.

```bash
bun run init.ts ~/my-prompts
bun run init.ts ~/my-prompts --no-default
```

### `inspect.ts` — Debug your composition
Shows token breakdown per section, cache boundaries, and budget fit.

```bash
bun run inspect.ts --dir ~/my-prompts
bun run inspect.ts --dir ~/my-prompts --provider anthropic
bun run inspect.ts --section identity
```

## Section Format

Each section is a markdown file with YAML frontmatter:

```markdown
---
section: identity
order: 10
budget: 500
cache: static
required: true
---

You are a helpful coding assistant...
```

| Field | Type | Default | Description |
|---|---|---|---|
| `section` | string | required | Section name (used in logs and dry-run) |
| `order` | number | required | Assembly order — lower numbers go first |
| `budget` | number | unlimited | Max tokens for this section |
| `cache` | `static` or `dynamic` | `static` | Position relative to cache boundary |
| `required` | boolean | `false` | Never cut when budget is tight |
| `provider` | string | all | Only include for this provider |

**Filename convention:** `NN-name.md` (e.g., `10-identity.md`). The `order` field in frontmatter is authoritative; the prefix is for readability.

## Cache Boundaries

Sections marked `cache: static` go above the cache break. Sections marked `cache: dynamic` go below. This matters for providers like Anthropic that charge less for repeated static prefixes.

```
[10-identity.md]       ← static (cached)
[20-tools.md]          ← static (cached)
[30-instructions.md]   ← static (cached)
── cache break ──
[80-context.md]        ← dynamic (changes per conversation)
[90-memory.md]         ← dynamic (changes per conversation)
```

Static sections stay the same across conversations. Dynamic sections change. Put stable content above the break to optimize caching costs.

## Provider Output

The same source files produce different output formats:

```bash
bun run build.ts --provider raw          # plain text (default)
bun run build.ts --provider anthropic    # JSON with cache_control blocks
bun run build.ts --provider openai       # JSON system message
bun run build.ts --provider google       # JSON systemInstruction
```

### Using with Claude (Anthropic)

Build your prompt, then drop it into your API call:

```bash
bun run build.ts --dir ~/my-prompts --provider anthropic --execute --output prompt.json
```

```python
import anthropic, json

client = anthropic.Anthropic()
system = json.load(open("prompt.json"))

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    system=system,  # Blueprint's output goes here
    messages=[{"role": "user", "content": "Review this PR..."}],
)
```

Static sections get `cache_control` automatically — Anthropic caches them so you only pay full price for the dynamic parts.

### Using with OpenAI

```bash
bun run build.ts --dir ~/my-prompts --provider openai --execute --output prompt.json
```

```python
from openai import OpenAI
import json

client = OpenAI()
system_msg = json.load(open("prompt.json"))

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[system_msg, {"role": "user", "content": "Review this PR..."}],
)
```

### Using with any AI (clipboard)

```bash
bun run build.ts --dir ~/my-prompts --execute --clipboard
# Paste into ChatGPT, Claude, Gemini, or any AI chat
```

## Variables

Simple `{{var_name}}` substitution — not a template engine.

```markdown
You are {{agent_name}}, a {{role}} assistant.
```

```bash
bun run build.ts --var agent_name=Claude --var role=coding --execute
```

Variables can also come from a file:

```bash
bun run build.ts --vars-file ./vars.env --execute
```

Unresolved variables stay as-is and produce a warning.

## Includes

Reference shared content with `{{include path/to/file.md}}`:

```markdown
---
section: context
order: 80
cache: dynamic
---

{{include ../my-vault/Context/latest.md}}
```

Paths are relative to the prompt directory. Includes are single-depth (no recursion) to keep assembly deterministic and debuggable.

## Works with Blackbox

[Blackbox](https://github.com/vj-bunbun/blackbox) builds your AI memory. Blueprint delivers it.

```bash
# Blackbox: assemble context from your vault
bun run context.ts --vault ~/my-vault --output ~/my-prompts/context-raw.md

# Blueprint: include it as a section
# (80-context.md uses {{include context-raw.md}})
bun run build.ts --dir ~/my-prompts --execute --clipboard
```

They compose naturally but work independently. No shared code, no import dependency. Both read `~/.airc` for their defaults — Blackbox stores `defaultVault`, Blueprint stores `defaultPromptDir`.

## Design Principles

1. **You own everything** — plain files on your disk, no cloud, no database
2. **Any provider works** — same sections, different output formats
3. **Deterministic** — no AI in the pipeline, works offline, costs nothing
4. **Token-aware** — per-section and global budgets prevent context overflow
5. **Cache-optimized** — static/dynamic split minimizes provider costs
6. **Composable** — includes and variables, but not a template engine

## License

MIT
