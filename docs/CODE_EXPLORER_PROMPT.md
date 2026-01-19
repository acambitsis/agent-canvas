# Generate Hierarchical Code Explorer

You are generating a hierarchical code documentation site for this codebase.

## Available Tools

### Scripts (via Bash)
```bash
# Parse a single file - returns JSON with exports, imports, line counts
npx tsx scripts/code-explorer/parse.ts file <path>

# Parse a directory - returns JSON summary of all files
npx tsx scripts/code-explorer/parse.ts dir <path> [--pattern "**/*.ts"]

# Render a page from JSON data
npx tsx scripts/code-explorer/render.ts <type> <output-path> <<< '<json-data>'
# Types: index, component, folder, file, symbol

# Validate all links in generated HTML
npx tsx scripts/code-explorer/validate.ts docs/code-explorer
```

### LSP Tools (via MCP)
- `mcp__typescript-lsp__references(symbolName)` - Find all usages of a symbol
- `mcp__typescript-lsp__definition(symbolName)` - Get where a symbol is defined
- `mcp__typescript-lsp__hover(filePath, line, column)` - Get type info at position

### Built-in
- `Read`, `Glob`, `Grep` - Explore the codebase
- `Write` - Create files directly when simpler than render script

## Output Structure

Generate these 5 levels in `docs/code-explorer/`:

```
docs/code-explorer/
├── index.html              # Level 1: System overview
├── styles.css              # Shared styles
├── components/             # Level 2: Logical components
│   └── {name}.html
├── folders/                # Level 3: Directory contents
│   └── {path}.html
├── files/                  # Level 4: File anatomy
│   └── {path}.html
└── symbols/                # Level 5: Symbol details
    └── {file}-{name}.html
```

## Your Process

### Phase 1: Understand the Codebase

Before generating anything, explore and understand:

1. Run `parse.ts dir .` to get an overview of all files
2. Read key files: README, main entry points, config files
3. Use Grep to find patterns: "export function", "createContext", etc.
4. Think about: What are the logical boundaries? How does data flow?

### Phase 2: Define Components (Critical!)

This is where your judgment matters most. Components are **logical groupings**, not directories.

Ask yourself:
- What would a new developer need to understand first?
- Which files work together to accomplish one responsibility?
- What are the major architectural boundaries?

Example reasoning:
```
"I see app/contexts/AuthContext.tsx, app/api/auth/*, and server/session-utils.ts.
These are in 3 different directories but they're ONE logical component: Authentication.
The context consumes the API routes which use the server utilities.
I'll group them together."
```

Aim for 5-8 components. Each should have:
- A clear, single responsibility
- Identifiable boundaries
- Meaningful dependencies on other components

### Phase 3: Generate Pages

Work top-down:

1. **Level 1 (index.html)**:
   - Write system overview
   - Create architecture diagram showing component relationships
   - List components with line counts and 1-line descriptions

2. **Level 2 (components/*.html)**:
   - For each component, explain its purpose (2-3 sentences)
   - Show dependencies (uses what) and dependents (used by what)
   - List the folders/files that comprise it
   - Use LSP `references` to find actual usage

3. **Level 3 (folders/*.html)**:
   - Use `parse.ts dir` to get accurate file list
   - Add 1-line purpose for each file
   - Show line counts

4. **Level 4 (files/*.html)**:
   - Use `parse.ts file` to get exports, imports, signatures
   - Write purpose description
   - Use LSP `references` to populate "Used by" section

5. **Level 5 (symbols/*.html)**:
   - Full source code with line numbers
   - Use LSP `hover` for type information
   - Use LSP `references` for callers
   - Write explanation of what it does

### Phase 4: Validate

Run `validate.ts` to check all internal links resolve. Fix any broken links.

## Render Data Schemas

### index (Level 1)
```json
{
  "title": "Project Name",
  "description": "One sentence description",
  "totalLines": 12000,
  "architectureDiagram": "ASCII art here",
  "components": [
    { "id": "auth", "name": "Authentication", "description": "...", "lines": 700 }
  ],
  "techTags": ["Next.js", "TypeScript", "Convex"]
}
```

### component (Level 2)
```json
{
  "id": "auth",
  "name": "Authentication",
  "description": "2-3 sentences explaining responsibility",
  "lines": 700,
  "lineBreakdown": "450 TypeScript, 250 API routes",
  "dependencies": [{ "id": "convex", "name": "Convex Backend" }],
  "dependents": [{ "id": "state", "name": "State Management" }],
  "folders": [
    { "path": "app/api/auth", "purpose": "...", "lines": 300 }
  ],
  "dataFlow": { "in": "...", "out": "..." }
}
```

### folder (Level 3)
```json
{
  "path": "app/components/agents",
  "purpose": "One sentence",
  "totalLines": 758,
  "files": [
    { "name": "AgentCard.tsx", "type": "Component", "lines": 224, "purpose": "..." }
  ],
  "subfolders": []
}
```

### file (Level 4)
```json
{
  "path": "app/contexts/AuthContext.tsx",
  "purpose": "One sentence",
  "lines": 183,
  "imports": {
    "external": ["react"],
    "internal": [{ "path": "@/types/auth", "names": ["User", "Organization"] }]
  },
  "exports": [
    { "name": "AuthProvider", "kind": "Component", "lines": "30-158", "description": "..." },
    { "name": "useAuth", "kind": "Hook", "lines": "160-166", "description": "..." }
  ],
  "usedBy": [
    { "file": "app/page.tsx", "context": "wraps app" }
  ]
}
```

### symbol (Level 5)
```json
{
  "name": "useAuth",
  "filePath": "app/contexts/AuthContext.tsx",
  "kind": "Hook",
  "signature": "function useAuth(): AuthContextValue",
  "lines": { "start": 160, "end": 166, "count": 7 },
  "purpose": "2-3 sentences",
  "parameters": [],
  "returns": { "type": "AuthContextValue", "description": "..." },
  "throws": ["Error if used outside AuthProvider"],
  "calledBy": [
    { "file": "Sidebar.tsx", "symbol": "Sidebar", "context": "user display" }
  ],
  "calls": ["useContext"],
  "sourceCode": "export function useAuth() { ... }"
}
```

## Quality Standards

1. **Every link must work** - Run validate.ts before finishing
2. **Line counts must be accurate** - Use parse.ts, don't guess
3. **References must be real** - Use LSP tools, don't assume
4. **Descriptions explain WHY** - Not just what the code does, but why it exists
5. **Architecture diagram shows flow** - Arrows indicate data/control flow, not just boxes

## Line Count Display

- Level 1-2: Muted, inline (e.g., "Authentication (~700 lines)")
- Level 3: Column in file table
- Level 4-5: Prominent near title
