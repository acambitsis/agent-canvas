# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TPS Agent Ecosystem** is a web-based configuration management system for visualizing and editing a multi-phase agent workflow. It displays business process agents organized by phases (Sales, Aspiration, Design, Installation, Value Analysis, New Ways of Working, Sustain) with interactive editing capabilities.

**Architecture**: Client-side rendered vanilla JavaScript application with Vercel serverless backend for persistence.

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

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
**No automated testing framework is implemented.** Testing is manual/ad-hoc only.

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
├── img/                # Phase images and assets
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
  --interactive-teal: #17a2b8;
  --sales-red: #e74c3c;
  /* Dynamic tool colors generated from YAML */
}
```

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

**Edit mode button doesn't appear**
- Ensure authentication succeeded
- Check browser console for JavaScript errors
- Verify `showEditModeButton()` is called in `loadAgents()`

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
- **CSS Classes**: kebab-case (e.g., `agent-card`, `edit-mode-btn`)

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

- **No DELETE endpoint**: Documents must be deleted via Vercel Dashboard or Blob API directly
- **No automated tests**: Manual testing only (consider adding Jest/Vitest if needed)
- **No versioning**: Blob Storage overwrites on save (consider adding version history if needed)
- **No conflict resolution**: Last write wins (consider adding optimistic locking if needed)
- **localStorage usage**: Document preference stored locally, not synced across devices

## Related Documentation

- `EDIT_MODE_SETUP.md` - Detailed setup guide for edit functionality
- `data/config.yaml` - Example configuration structure with comments
