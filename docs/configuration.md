# Configuration

## ~/.airc

Blueprint stores its default prompt directory in `~/.airc`, a simple key=value config file shared with [Blackbox](https://github.com/vj-bunbun/blackbox).

```
# ~/.airc
defaultPromptDir=/home/user/my-prompts
defaultVault=/home/user/my-vault
```

Set automatically by `bun run init.ts`. Edit manually anytime.

## Prompt Directory Resolution

Scripts find your prompt directory in this order:

1. `--dir ~/path` flag (explicit, highest priority)
2. `~/.airc` `defaultPromptDir` (set by `init.ts`)
3. Current directory (fallback)

## Variables

### CLI flags

```bash
bun run build.ts --var agent_name=Claude --var role=coding --execute
```

### Vars file

A key=value file (same format as `~/.airc`):

```
# vars.env
agent_name=Claude
role=coding
project=my-app
```

```bash
bun run build.ts --vars-file ./vars.env --execute
```

### Section defaults

Each section can define default variable values in its frontmatter:

```yaml
vars:
  agent_name: Assistant
  role: general
```

### Resolution order

Later sources override earlier ones:

1. Section `vars:` (lowest priority)
2. `--vars-file` values
3. `--var key=value` CLI flags (highest priority)

## Common Workflows

### Build and paste into AI

```bash
bun run build.ts --execute --clipboard
# Paste into any AI chat
```

### Write to a file your AI tool reads

```bash
bun run build.ts --execute --output ~/my-project/CLAUDE.md
bun run build.ts --execute --output ~/my-project/.ai-context.md
```

### Different prompts for different providers

```bash
bun run build.ts --provider anthropic --execute --output anthropic-prompt.json
bun run build.ts --provider openai --execute --output openai-prompt.json
```

### Include Blackbox context

```bash
# Step 1: Blackbox assembles your vault context
cd ~/blackbox/scripts
bun run context.ts --vault ~/my-vault --output ~/my-prompts/context-raw.md

# Step 2: Blueprint includes it
cd ~/blueprint/scripts
bun run build.ts --dir ~/my-prompts --execute --clipboard
```

Your `80-context.md` section references the Blackbox output:

```markdown
---
section: context
order: 80
cache: dynamic
budget: 4000
---

{{include context-raw.md}}
```
