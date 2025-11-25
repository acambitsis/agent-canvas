# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TPS Agent Ecosystem** is a web-based configuration management system for visualizing and editing a multi-phase agent workflow. It displays business process agents organized by phases (Sales, Aspiration, Design, Installation, Value Analysis, New Ways of Working, Sustain) with interactive editing capabilities.

**Architecture**: Client-side rendered vanilla JavaScript application with Vercel serverless backend for persistence.

## Development Commands

### Local Development
```bash
# Install dependencies
pnpm install

# Run locally with Vercel dev server (with hot reload)
vercel dev
# Always runs on http://localhost:3000
# Hot reload enabled - changes reflect automatically

# Pull environment variables from Vercel
vercel env pull
```

**Note:** Development server runs on port 3000 with automatic hot reload. Do not start additional instances on other ports.

### Deployment
```bash
# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# View environment variables
vercel env ls
```

### Testing
```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui
```

See `tests/README.md` for test suite details.

## Core Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **No build system**: Files served directly to browser
- **Backend**: Node.js serverless functions on Vercel
- **Storage**: Vercel Blob Storage for YAML configurations
- **Auth**: HTTP Basic Authentication via Edge Middleware
- **Libraries**:
  - `js-yaml@4.1.0` - YAML parsing/serialization (CDN)
  - `lucide` - SVG icons library (CDN)
  - `@vercel/blob@0.23.0` - Cloud storage client

### File Structure
```
/
├── index.html          # Main HTML entry point
├── main.js             # All client-side logic (1,643 lines, 83 functions)
├── styles.css          # Complete styling system (1,276 lines)
├── api/
│   ├── config.js       # CRUD API for configurations (291 lines)
│   └── migrate.js      # One-time migration endpoint (127 lines)
├── middleware.js       # HTTP Basic Auth enforcement (43 lines)
├── data/
│   ├── config.yaml     # Default TPS configuration (15KB)
│   └── tps-config.yaml # Alternative configuration (16KB)
└── .vercel/            # Vercel deployment config
```

### Key Entry Points
1. **index.html** - Static HTML structure
2. **main.js** - Bootstrap flow:
   - `DOMContentLoaded` → `bootstrapApp()` → `initializeDocumentControls()` → `loadAgents()`
   - Fetches config from `/api/config` endpoint
   - Renders agent groups dynamically

### API Endpoints

**GET /api/config**
- Fetches YAML configuration from Blob Storage
- Query param `?list=1` returns JSON list of all documents
- Query param `?doc=filename.yaml` specifies document name
- Returns 404 if document not found

**POST /api/config**
- Saves YAML configuration to Blob Storage
- Body: Raw YAML text
- Header `x-config-name` or query param `?doc=` specifies document name
- Returns success with blob URL and size

**PUT /api/config**
- Renames existing document
- Query params: `?doc=old.yaml&newDoc=new.yaml`
- Creates new blob, deletes old one atomically

**DELETE /api/config**
- Not implemented (use Vercel Dashboard or API directly)

**POST /api/migrate**
- One-time migration from static `data/config.yaml` to Blob Storage
- Protected by Basic Auth

### Environment Variables Required
```bash
BASIC_AUTH_PASSWORD      # HTTP Basic Auth password
BLOB_READ_WRITE_TOKEN    # Vercel Blob storage token
```

## Key Architectural Patterns

### 1. State Management via Global Variables
```javascript
let configData = null;           // Global YAML config state
let currentDocumentName = null;  // Active document name
let availableDocuments = [];     // Cached document list
let agentModalViewMode = 'form'; // Modal UI state (form|yaml)
```

### 2. Configuration-Driven Rendering
- All content driven by YAML configuration structure
- Dynamic CSS generation from `config.toolsConfig` color definitions
- Section defaults in `config.sectionDefaults`
- Agent data in `config.agentGroups` array

### 3. Document-Centric Architecture
- Multiple YAML files stored in Blob Storage (e.g., `config.yaml`, `tps-config.yaml`)
- User switches documents via dropdown in header
- Active document preference persisted to localStorage key `tps-active-config-doc`
- `loadAgents()` always loads from currently active document

### 4. Modal-Based Editing
- `agentModal` - Agent CRUD operations
- `groupModal` - Section/group CRUD operations
- Dual-view system: Form view ↔ YAML view
- Synchronization functions:
  - `buildAgentDraftFromForm()` - Form → JSON
  - `updateAgentYamlEditor()` - JSON → YAML view
  - `applyAgentYamlToForm()` - YAML → Form fields

### 5. Helper Function Organization
Helpers grouped by purpose:
- **Utilities**: `toArray()`, `deepClone()`, `getAgentMetrics()`
- **Document management**: `getStoredDocumentPreference()`, `setActiveDocumentName()`
- **UI helpers**: `setElementText()`, `setDocumentStatusMessage()`
- **Rendering**: `generateDynamicCSS()`, `createAgentCard()`, `renderAgentGroups()`
- **Modals**: `showAgentModal()`, `saveAgent()`, `deleteAgent()`

### 6. Data Structure (YAML)
```yaml
configData:
  toolsConfig:                    # Tool definitions with icons and colors
    Forms:
      icon: clipboard-list
      class: tool-forms
      color: '#17a2b8'

  sectionDefaults:                # Global section formatting
    color: string
    iconType: string
    showInFlow: boolean
    isSupport: boolean

  agentGroups: Array              # Main data structure
    - groupNumber: number
      groupName: string
      groupId: string
      phaseTag: string
      flowDisplayName: string
      agents: Array
        - agentNumber: number
          name: string
          objective: string
          description: string
          tools: Array<string>
          journeySteps: Array<string>
          demoLink: URL
          videoLink: URL
          metrics:
            adoption: number      # Percentage (0-100)
            satisfaction: number  # Percentage (0-100)
```

## Common Development Workflows

### Adding a New Agent Field
1. Update YAML schema in `data/config.yaml`
2. Modify `buildAgentDraftFromForm()` in main.js to include new field
3. Add form input to agent modal in `index.html`
4. Update `showAgentModal()` to populate new field
5. Update `createAgentCard()` to display new field if needed

### Adding a New Tool Type
1. Add tool definition to `config.toolsConfig` in YAML:
   ```yaml
   toolsConfig:
     NewTool:
       icon: lucide-icon-name
       class: tool-newtool
       color: '#hexcolor'
   ```
2. CSS is generated automatically via `generateDynamicCSS()`
3. Tool appears in agent modal checkboxes automatically

### Modifying Blob Storage Logic
All storage operations in `api/config.js`:
- `fetchDocumentFromBlob()` - Read from Blob
- `handlePost()` - Write to Blob
- `handlePut()` - Rename/move documents
- Uses `@vercel/blob` methods: `head()`, `list()`, `put()`, `del()`
- **Disable the default body parser when you need raw request streams.** Vercel's dev runtime buffers POST bodies unless the route exports:
  ```javascript
  export const config = { api: { bodyParser: false } };
  ```
  When you need the raw YAML (e.g., to stream into Blob storage), read the request with classic `req.on('data')` listeners and concatenate buffers. Otherwise the handler will see `chunkCount = 0` and return "No content provided" even though the browser sent data.

### Adding Authentication Logic
- Middleware in `middleware.js` enforces HTTP Basic Auth on all routes
- API routes also check auth via `checkAuth()` function in `api/config.js`
- Both use `BASIC_AUTH_PASSWORD` environment variable

## Styling System

### Design Tokens (CSS Variables)
```css
:root {
  --page-bg-start: #0a3d4d;
  --page-bg-end: #1a5f73;
  --brand-primary: #17a2b8;
  --brand-primary-strong: #138496;
  --group-accent-fallback: var(--brand-primary);
  --tool-chip-bg-fallback: #999999;
  /* See styles.css for the full token set */
}
```

### Utility Surfaces & Chips
- `.surface-card`, `.surface-panel`, and `.surface-glass` centralize the common padding/radius/shadow logic for agent groups, cards, and modals. Customize them by setting `--surface-padding`, `--surface-shadow`, `--surface-bg`, etc. on the consuming selector.
- `.chip` and `.badge` replace bespoke pill/badge CSS. Set `--chip-bg` / `--chip-text` (or `--badge-bg` / `--badge-text`) inline or via CSS to theme individual pills, tool chips, or badges.
- Context menus share `.menu-panel` + `.menu-item`, so `renderContextMenuTrigger()` just needs to output those base classes to look consistent anywhere in the UI.
- Modals now use `<div class="surface-card modal-content">` so future modals only need to tweak CSS variables instead of redefining box styles.
- Collapsed agent pills rely on the `pill-palette-0` → `pill-palette-4` classes, so `createAgentGroup()` simply appends a palette class instead of inlining colors. Adjust those classes in CSS to change the palette.

### Dynamic YAML-driven accents
- `generateDynamicCSS()` now injects only CSS variables (no hard-coded colors). Each agent group gets `--group-accent` and `--phase-tag-color`, and every tool class receives `--tool-chip-bg`.
- `styles.css` consumes those variables (`border-color: var(--group-accent, var(--group-accent-fallback))`, `background: var(--tool-chip-bg, var(--tool-chip-bg-fallback))`, etc.), so theming flows from YAML → JS → CSS without inline overrides.
- To add new themable surfaces, create a token in `:root`, reference it in the relevant selectors, then (optionally) expose a YAML field that sets a matching CSS variable inside `generateDynamicCSS()`.
- `phaseTag` values are still persisted in YAML / forms for downstream tooling, but the UI no longer renders a badge for them. Removing the CSS/DOM keeps the interface lean while preserving the data.
- `renderAgentIconPanel()` centralizes the icon cluster (journey tooltip, demo link, video link, metrics tooltip). Extend that helper if you need additional quick actions.

### Duplication Map (UI)
- **Cards & Sections**: Use `surface-card` for big sections (agent groups, modals) and `surface-panel` for inner cards (agent cards, inline panels). Avoid reintroducing bespoke box/shadow rules—override the CSS variables instead.
- **Menus & Context Actions**: Always route through `renderContextMenuTrigger()` which outputs `.menu-panel` + `.menu-item` markup. This keeps document menus, agent menus, and section menus aligned without extra CSS.
- **Collapsed Pills**: Collapsed agent pills pull from the `COLLAPSED_PILL_PALETTE` JS constant. The CSS now reads `--pill-bg` / `--pill-text`, so new pill palettes only require editing the JS array (no nth-child selectors).
- **Chips/Badges**: Any inline status (tool chips, badges, pills) should opt into `.chip`/`.badge` so hover/spacing logic stays centralized. Set per-instance colors via inline CSS variables or helper functions.
- **Icon Panel**: `renderAgentIconPanel()` owns the HTML for the journey/demo/video/metrics buttons. Reuse that helper instead of duplicating markup when you add or remove card actions.

### Utility layout layer
- Common flex/spacing patterns live in lightweight utility classes such as `u-flex`, `u-gap-sm`, `u-wrap`, `u-flex-column`, and `u-relative`. Apply them directly in `index.html` or generated markup to avoid bespoke selectors.
- Buttons now share a consolidated `.btn` base plus modifiers (`.btn-glass`, `.btn-icon`, `.btn-toggle`). Favor stacking these classes over introducing new button-specific selectors.

### Reusable context menus
- Use `renderContextMenuTrigger({ menuId, title, actions, icon, stopPropagation })` to generate both the trigger and menu markup. The helper takes an `actions` array where each entry is `{ icon, label, onClick, danger }` or `{ type: 'divider' }`.
- This keeps every context menu on the page consistent and automatically wires up the shared `.menu-panel`/`.menu-item` styling.

### Collapsed pill palette
- Agent “pill” chips in collapsed sections no longer rely on `nth-child` selectors. The palette is configured in `COLLAPSED_PILL_PALETTE`, and `getCollapsedPillStyle()` injects `--pill-bg`/`--pill-text` per pill.
- To adjust the palette, update the array in `main.js`; no CSS changes are required.

### Key UI Patterns
- **Agent Cards**: CSS Grid layout, hover effects with transform and shadow
- **Modals**: Backdrop blur overlay, centered with max-width
- **Edit Buttons**: Teal accent with lucide icons
- **Delete Buttons**: Red accent with confirmation prompts
- **Tooltips**: Positioned dynamically, HTML content support

### Responsive Design
- Mobile-first approach
- Grid layouts collapse to single column on small screens
- Modal adapts to viewport height

## Security Considerations

### Authentication
- HTTP Basic Authentication on all routes (middleware.js)
- API endpoints validate credentials independently
- No granular permissions (all-or-nothing access)

### Input Validation
- Document name sanitization: `/^[A-Za-z0-9._-]+\.yaml$/`
- YAML parsing errors caught and displayed to user
- No SQL injection risk (no database)

### XSS Prevention
- Use `textContent` for user-generated content (not `innerHTML`)
- Exception: Tooltips with HTML content (trusted admin input only)
- YAML content is trusted (admin-controlled)

## Debugging Tips

### Common Issues

**"Failed to save configuration"**
- Check `BLOB_READ_WRITE_TOKEN` is set in Vercel environment variables
- Verify token has Read and Write permissions
- Check Vercel logs: `vercel logs`

**Document actions disabled**
- Confirm a document is selected; actions remain disabled if nothing is loaded
- Delete is unavailable when only a single document exists in Blob storage

**Changes don't persist**
- Network tab: Look for failed POST to `/api/config`
- Verify Blob Storage is created in Vercel Dashboard
- Check for error alerts in UI

**Document not found (404)**
- Document may not exist in Blob Storage yet
- Use "Save Config" to create document in Blob
- Check document name matches exactly (case-sensitive)

### Useful Debugging Functions
```javascript
// In browser console:
configData              // View current config state
currentDocumentName     // Active document name
availableDocuments      // List of all documents
```

## Code Quality Standards

### Naming Conventions
- **Functions**: camelCase (e.g., `loadAgents()`, `createAgentCard()`)
- **Variables**: camelCase (e.g., `configData`, `agentModalViewMode`)
- **CSS Classes**: kebab-case (e.g., `agent-card`, `collapse-all-btn`)

### Defensive Coding Patterns
- `toArray(value)` - Ensures array values for YAML fields
- `deepClone(value)` - Safe cloning with fallback for older browsers
- Try-catch blocks for localStorage operations
- Null checks before DOM manipulation

### Anti-Patterns to Avoid
- **Don't add build systems** - Keep it buildless
- **Don't add TypeScript** - Vanilla JS by design
- **Don't add frameworks** - React/Vue/Svelte not needed
- **Don't add minification** - Vercel handles deployment optimization
- **Don't create abstractions prematurely** - Keep functions focused and simple

## Important Notes

- **DELETE endpoint**: `/api/config` supports DELETE requests; the UI guards against removing the final remaining document
- **Automated tests**: Vitest test suite with 4 ultra high-value tests covering data persistence, authentication, form/YAML sync, and input sanitization (see `tests/README.md`)
- **No versioning**: Blob Storage overwrites on save (consider adding version history if needed)
- **No conflict resolution**: Last write wins (consider adding optimistic locking if needed)
- **localStorage usage**: Document preference stored locally, not synced across devices

## Related Documentation

- `data/config.yaml` - Example configuration structure with comments
