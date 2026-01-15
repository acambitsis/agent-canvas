# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**AgentCanvas** is a web-based configuration management system for visualizing and editing multi-phase agent workflows. It displays business process agents organized by phases with interactive editing capabilities.

**Architecture**: Client-side rendered vanilla JavaScript with Convex backend and WorkOS authentication.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3 - no build system
- **Backend**: Convex (real-time backend-as-a-service)
- **Auth**: WorkOS AuthKit (magic link, social login, SSO)
- **Hosting**: Vercel (static files + edge API routes for auth)
- **Libraries**: `lucide` (CDN), `jose` (session encryption), `convex` (and `js-yaml` lazy-loaded for legacy YAML import only)

## Development Commands

```bash
# Install dependencies
pnpm install

# Start Convex dev server (required for backend)
npx convex dev

# Start Vercel dev server (frontend + auth routes)
vercel dev
# Runs on http://localhost:3000

# Pull environment variables
vercel env pull

# Deploy
vercel --prod

# Testing
pnpm test        # watch mode
pnpm test:run    # single run
pnpm test:ui     # browser UI
```

## Environment Variables

```bash
# Convex
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# WorkOS
WORKOS_API_KEY=sk_live_xxxxx
WORKOS_CLIENT_ID=client_xxxxx
WORKOS_COOKIE_PASSWORD=your-32-char-secret  # openssl rand -hex 32
WORKOS_AUTHKIT_DOMAIN=your-authkit-subdomain  # e.g., "smart-chefs" for smart-chefs.authkit.app

# App
BASE_URL=http://localhost:3000
```

## File Structure

```
/
├── index.html, login.html, callback.html  # HTML pages
├── styles.css              # Styling
├── client/                 # Browser-side JavaScript (ES modules)
│   ├── main.js             # Main client-side logic
│   ├── auth-client-workos.js   # WorkOS auth client
│   ├── convex-client.js        # Convex client adapter
│   ├── config.js, state.js     # Configuration and state
│   ├── documents.js            # Document/canvas management
│   ├── grouping.js              # Agent grouping logic
│   ├── legacy-yaml-import.js   # Legacy YAML import (one-way)
│   ├── menu-utils.js           # Menu UI helpers
│   └── modal-utils.js          # Modal UI helpers
├── convex/                  # Convex backend (TypeScript)
│   ├── schema.ts           # Database schema (5 tables)
│   ├── agents.ts           # Agent CRUD + history
│   ├── canvases.ts         # Canvas CRUD
│   ├── orgSettings.ts      # Org configuration
│   ├── agentHistory.ts     # Audit trail queries
│   ├── users.ts            # User org membership sync
│   ├── auth.config.ts      # Convex auth provider config
│   └── lib/auth.ts         # Auth helpers (requireAuth, requireOrgAccess)
├── api/                     # Vercel edge routes
│   ├── auth/               # Auth endpoints
│   │   ├── url.js          # Generate WorkOS auth URL
│   │   ├── callback.js     # OAuth callback + org membership sync
│   │   ├── session.js      # Get current session
│   │   ├── refresh.js       # Refresh access token
│   │   ├── orgs.js         # Get user organizations
│   │   └── logout.js       # Clear session
│   ├── config.js           # App configuration endpoint
│   └── lib/session-utils.js # Session encryption (jose)
└── tests/                   # Vitest tests (unit/, integration/)
```

## Convex Schema

```typescript
// 5 tables with proper indexes
orgSettings          // Org-level config (tools, colors, defaults)
canvases             // Canvas containers per org
agents               // Individual agents (normalized from YAML)
agentHistory         // Audit trail for all agent changes
userOrgMemberships   // User→org access (synced from WorkOS on login)
```

Key patterns:
- All mutations use `requireAuth()` and `requireOrgAccess()` from `convex/lib/auth.ts`
- Org access checked via `userOrgMemberships` table (not just JWT claims)
- Agent changes automatically record history
- Real-time subscriptions via Convex enable collaborative editing

## Auth Flow

```
Login → POST /api/auth/url → WorkOS AuthKit
    → OAuth callback → POST /api/auth/callback
    → Encrypted session cookie (jose AES-256-GCM)
    → Automatic token refresh via /api/auth/refresh
```

Session contains: `accessToken`, `refreshToken`, `user`, `orgs`, `accessTokenExpiresAt`

## Key Patterns

### State Management
```javascript
// auth-client-workos.js
currentUser, currentOrgs, isInitialized

// convex-client.js
Manages Convex subscriptions with auto-cleanup
```

### Authorization
```typescript
// In Convex functions (convex/lib/auth.ts)
const auth = await requireAuth(ctx);  // Returns {workosUserId, email, isSuperAdmin}
await requireOrgAccess(ctx, auth, workosOrgId);  // Checks userOrgMemberships table
```

### Real-time Updates
```javascript
// Subscribe to agents for a canvas
subscribeToAgents(canvasId, (agents) => renderAgentGroups(agents));
```

## Styling System

- CSS variables in `:root` for theming
- `.surface-card`, `.surface-panel` for containers
- `.chip`, `.badge` for inline elements
- `generateDynamicCSS()` injects tool colors from config
- Utility classes: `u-flex`, `u-gap-sm`, `u-wrap`

## Code Standards

- **Functions/Variables**: camelCase
- **CSS Classes**: kebab-case
- **No build system**: Files served directly
- **No TypeScript in frontend**: Vanilla JS only (Convex functions use TS)
- **No frameworks**: Keep it simple

## Debugging

Common issues:
- **Auth fails**: Check WORKOS_* env vars, ensure WorkOS dashboard has correct redirect URIs
- **Convex errors**: Run `npx convex dev` to sync schema, check Convex dashboard logs
- **Session issues**: WORKOS_COOKIE_PASSWORD must be 32+ chars

## Related Files

- `.env.example` - Environment variable template
- `docs/DEPLOYMENT_GUIDE.md` - Vercel deployment instructions
- `docs/VERCEL_PROJECTS.md` - Project IDs and URLs
