# Section Format

Every section is a markdown file with YAML frontmatter.

## Example

```markdown
---
section: identity
order: 10
budget: 500
cache: static
required: true
---

You are a helpful coding assistant specialized in TypeScript.
You write clean, minimal code without unnecessary abstractions.
```

## Frontmatter Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `section` | string | yes | — | Section name, used in logs and dry-run output |
| `order` | number | yes | — | Assembly order. Lower numbers go first |
| `budget` | number | no | unlimited | Max tokens for this section. Truncated if exceeded |
| `cache` | `static` or `dynamic` | no | `static` | Position relative to cache boundary |
| `required` | boolean | no | `false` | Required sections are never cut when budget is tight |
| `provider` | string | no | all | Only include when building for this provider |
| `vars` | object | no | `{}` | Default variable values scoped to this section |

## Filename Convention

Recommended: `NN-name.md` where `NN` is the order number.

```
10-identity.md
20-tools.md
30-instructions.md
80-context.md
90-memory.md
```

The `order` field in frontmatter is authoritative. The filename prefix is for human readability when browsing the directory. If frontmatter is missing `section` or `order`, they're derived from the filename.

## Content

The body is plain markdown. It gets concatenated into the final prompt — no additional processing beyond variable substitution and includes.

## Variables

Use `{{var_name}}` anywhere in the content:

```markdown
You are {{agent_name}}, a {{role}} assistant for the {{project}} project.
```

Set values with `--var agent_name=Claude` or a vars file.

## Includes

Use `{{include path/to/file.md}}` to pull in shared content:

```markdown
---
section: context
order: 80
cache: dynamic
---

{{include ../my-vault/Context/latest.md}}
```

Paths are relative to the prompt directory. Includes are single-depth — an included file cannot itself contain `{{include}}` directives.

## Tips

- **Order gaps**: Use 10, 20, 30... so you can insert sections later (e.g., 25-safety.md)
- **Required sections**: Mark identity as `required: true` so it's never cut
- **Dynamic sections**: Context and memory should be `cache: dynamic` — they change per conversation
- **Budget**: Set budgets on dynamic sections to prevent context from consuming the entire prompt
- **Provider-specific**: Use `provider: anthropic` to include a section only for Anthropic builds
