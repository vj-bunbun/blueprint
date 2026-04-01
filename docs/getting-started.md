# Getting Started with Blueprint

Blueprint is a build system for system prompts. Your prompt lives as separate markdown files — Blueprint assembles them into a single output with token budgets and provider-specific formatting.

## Install

```bash
git clone https://github.com/vj-bunbun/blueprint.git
cd blueprint/scripts && bun install
```

Requires [Bun](https://bun.sh) runtime.

## Create Your First Prompt Directory

```bash
bun run init.ts ~/my-prompts
```

This creates 5 starter section files:

| File | Purpose | Cache |
|---|---|---|
| `10-identity.md` | Who the AI is | static |
| `20-tools.md` | Available tools | static |
| `30-instructions.md` | Behavioral rules | static |
| `80-context.md` | Project context | dynamic |
| `90-memory.md` | Session memory | dynamic |

## Edit Your Sections

Open the section files and customize them for your use case. Each file has YAML frontmatter that controls assembly order, token budget, and cache placement.

## Preview

```bash
bun run build.ts --dir ~/my-prompts
```

This shows a dry-run: section names, token counts, budgets, and whether everything fits.

## Build

```bash
# Copy to clipboard
bun run build.ts --dir ~/my-prompts --execute --clipboard

# Write to file
bun run build.ts --dir ~/my-prompts --execute --output system-prompt.txt

# Provider-specific format
bun run build.ts --dir ~/my-prompts --execute --provider anthropic --output prompt.json
```

## Default Prompt Directory

`init.ts` saves your prompt directory path in `~/.airc`. After that, you can skip the `--dir` flag:

```bash
bun run build.ts --execute --clipboard
```

Override with `--dir` anytime to target a different directory.
