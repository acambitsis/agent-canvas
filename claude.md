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
- **Libraries**: `js-yaml` (CDN), `lucide` (CDN), `jose` (session encryption), `convex`

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

# App
BASE_URL=http://localhost:3000
```

## File Structure

```
/
├── index.html              # Main entry point
├── main.js                 # Client-side logic
├── styles.css              # Styling
├── auth-client-workos.js   # WorkOS auth client
├── convex-client.js        # Convex client adapter
├── convex/
│   ├── schema.ts           # Database schema (4 tables)
│   ├── agents.ts           # Agent CRUD + history
│   ├── canvases.ts         # Canvas CRUD
│   ├── orgSettings.ts      # Org configuration
│   ├── agentHistory.ts     # Audit trail queries
│   └── lib/auth.ts         # Auth helpers
├── api/auth/               # Vercel edge routes
│   ├── url.js              # Generate WorkOS auth URL
│   ├── callback.js         # OAuth callback handler
│   ├── session.js          # Get current session
│   ├── refresh.js          # Refresh access token
│   ├── orgs.js             # Get user organizations
│   └── logout.js           # Clear session
└── api/lib/session-utils.js # Session encryption (jose)
```

## Convex Schema

```typescript
// 4 tables with proper indexes
orgSettings    // Org-level config (tools, colors, defaults)
canvases       // Canvas containers per org
agents         // Individual agents (normalized from YAML)
agentHistory   // Audit trail for all agent changes
```

Key patterns:
- All mutations use `requireAuth()` and `requireOrgAccess()` from `convex/lib/auth.ts`
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
// In Convex functions
const auth = await requireAuth(ctx);
requireOrgAccess(auth, workosOrgId);
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

```javascript
// Browser console
getCurrentUser()        // Current auth state
getUserOrgs()          // User's organizations
getConvex()            // Convex client instance
```

Common issues:
- **Auth fails**: Check WORKOS_* env vars, ensure WorkOS dashboard has correct redirect URIs
- **Convex errors**: Run `npx convex dev` to sync schema, check Convex dashboard logs
- **Session issues**: WORKOS_COOKIE_PASSWORD must be 32+ chars

## Related Files

- `docs/MIGRATION-CONVEX-WORKOS.md` - Full migration documentation
- `.env.example` - Environment variable template
- `_deprecated/` - Old Clerk/Neon/KV code for reference
