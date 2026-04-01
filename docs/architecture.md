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

## Cache Boundaries

Static sections (identity, tools, instructions) change rarely. Dynamic sections (context, memory) change per conversation.

Anthropic's prompt caching charges less for repeated static prefixes. By splitting at the cache boundary, you pay full price only for the changing part. Other providers ignore the boundary — the output is the same either way.
