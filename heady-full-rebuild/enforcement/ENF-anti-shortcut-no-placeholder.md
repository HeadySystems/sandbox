---
title: "Enforcement: Anti-Shortcut & No-Placeholder Protocols"
domain: enforcement-protocol
semantic_tags: [anti-shortcut, no-placeholder, no-fake-data, no-stubs, code-quality, forbidden-patterns, enforcement]
enforcement: ABSOLUTE
---

# ENFORCEMENT PROTOCOLS

## Protocol 1: ANTI-SHORTCUT ENFORCEMENT

### Forbidden Code Patterns (Auto-Block at CI)

```
# These patterns trigger automatic PR rejection:
//\s*(TODO|HACK|FIXME|TEMP|XXX|KLUDGE)
catch\s*\(\s*\w*\s*\)\s*\{\s*\}                    # empty catch
console\.\s*(log|warn|error)                          # raw console in production
any\s+                                                # TypeScript any type
@ts-ignore|@ts-nocheck|eslint-disable               # suppressing checks
localhost|127\.0\.0\.1                                # local references
throw new Error\(['"]Not implemented['"]\)           # stub throws
\.then\(\s*\(\)\s*=>\s*\{\s*\}\s*\)                 # empty .then()
process\.exit\([^0]\)                                # non-zero exits in libraries
eval\(|new Function\(                                 # dynamic code execution
document\.write\(                                     # DOM injection
innerHTML\s*=                                          # XSS-prone assignment
```

### Complexity Limits (Per Function)

- Cyclomatic complexity: ≤ 13 (Fibonacci-derived)
- Function length: ≤ 55 lines (Fibonacci-derived)
- Parameter count: ≤ 5 (Fibonacci-derived)
- Nesting depth: ≤ 3 levels
- Import count per file: ≤ 21 (Fibonacci-derived)

---

## Protocol 2: NO-PLACEHOLDER ENFORCEMENT

### Zero Fake Data Policy

- ❌ `"Lorem ipsum"` or any placeholder text
- ❌ `"example.com"` / `"test@test.com"` / `"John Doe"` in non-test files
- ❌ `"YOUR_API_KEY_HERE"` or `"<REPLACE>"` or `"TODO_FILL"`
- ❌ Mock data that will never be replaced with real data
- ❌ Simulated API responses that mask unimplemented backends
- ❌ Hardcoded demo data that doesn't connect to real sources
- ❌ `return null` / `return {}` / `return []` as stub implementations

### Required Instead

- ✅ Real data from real sources or honest "no data available" states
- ✅ `.env.example` with descriptive placeholder names (not values)
- ✅ Zod schemas that validate and document expected shapes
- ✅ Loading states, empty states, and error states for every UI component
- ✅ "Coming soon" UI with clear engineering roadmap reference

---

## Protocol 3: LOCALHOST ELIMINATION

### Pre-Commit Hook

```bash
#!/bin/bash
# Block any commit containing localhost in production files
FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
  grep -v "test/" | grep -v ".env" | grep -v "_archive/")
for f in $FILES; do
  if grep -qn "localhost\|127\.0\.0\.1\|:3000\b\|:3001\b\|:8080\b" "$f"; then
    echo "🚨 BLOCKED: localhost reference in $f"
    exit 1
  fi
done
```

### Domain Resolution

All URLs MUST resolve through environment config:

```javascript
// ✅ CORRECT
const apiUrl = process.env.HEADY_API_URL;
const brainUrl = process.env.HEADY_BRAIN_URL;

// ❌ FORBIDDEN
const apiUrl = 'http://localhost:3301';
const brainUrl = 'http://127.0.0.1:8080';
```

---

## Protocol 4: CONTINUOUS EMBEDDING ENFORCEMENT

### Embedding Standards for Heady™ Cognition Files

- Every `.md` file in `heady-cognition/` has YAML frontmatter with `semantic_tags`
- Tags are specific, technical, and non-redundant for optimal vector space separation
- Files are ≤ 3KB for efficient single-chunk embedding (384-dim all-MiniLM-L6-v2)
- File names are descriptive and use hyphen-separation for readability
- Semantic boundaries: one concept per file — no multi-topic documents
- Cross-references use file paths, enabling Graph RAG relationship building

### Embedding Pipeline

1. `chokidar` watches `heady-cognition/` for changes
2. Changed files are chunked (max 512 tokens per chunk)
3. Each chunk embedded via all-MiniLM-L6-v2 → 384-dim vector
4. Vectors stored in pgvector with metadata (path, tags, timestamp)
5. 3D projection computed for spatial navigation
6. Graph RAG edges created from cross-references
