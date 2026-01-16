# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**AgentCanvas** is a web-based configuration management system for visualizing and editing multi-phase agent workflows. It displays business process agents organized by phases with interactive editing capabilities.

**Architecture**: Minimal Next.js App Router for routing and API endpoints, with vanilla JavaScript client code for the UI, Convex backend, and WorkOS authentication. Next.js serves as a thin wrapper - it handles auth checks and routing, then loads the existing vanilla JS application.

## Technology Stack

- **Frontend**: Next.js 15 (App Router) with React 19, vanilla JavaScript client code (ES6 modules), HTML5, CSS3
- **Backend**: Convex (real-time backend-as-a-service)
- **Auth**: WorkOS AuthKit (magic link, social login, SSO)
- **Hosting**: Vercel (Next.js deployment)
- **Libraries**: `next`, `react`, `react-dom`, `lucide` (CDN), `jose` (session encryption), `convex` (and `js-yaml` lazy-loaded for legacy YAML import only)

## Development Commands

```bash
# Install dependencies
pnpm install

# Start Convex dev server (required for backend)
npx convex dev

# Start Next.js dev server (frontend + API routes)
pnpm dev
# Runs on http://localhost:3000

# Build for production
pnpm build

# Start production server
pnpm start

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
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud  # Preferred for Next.js
# Fallback: VITE_CONVEX_URL or CONVEX_URL

# WorkOS
WORKOS_API_KEY=sk_live_xxxxx
WORKOS_CLIENT_ID=client_xxxxx
WORKOS_COOKIE_PASSWORD=your-32-char-secret  # openssl rand -hex 32
WORKOS_AUTHKIT_DOMAIN=your-authkit-subdomain  # e.g., "smart-chefs" for smart-chefs.authkit.app

# JWT (if using custom JWT generation for Convex)
JWT_PRIVATE_KEY={"kty":"RSA",...}  # JWK JSON string

# App
BASE_URL=http://localhost:3000
```

## File Structure

```
/
├── app/                     # Next.js App Router
│   ├── page.tsx            # Main app page (auth check + loads app-shell.html + client/main.js)
│   ├── login/page.tsx      # Login page (React component)
│   ├── layout.tsx          # Root layout with importmap and scripts
│   ├── globals.css         # Global styles (imports styles.css)
│   └── api/                # Next.js Route Handlers (Edge runtime)
│       ├── config/route.ts         # App configuration endpoint
│       └── auth/                   # Auth endpoints
│           ├── url/route.ts        # Generate WorkOS auth URL
│           ├── callback/route.ts   # OAuth callback + org membership sync
│           ├── session/route.ts    # Get current session
│           ├── refresh/route.ts    # Refresh access token
│           ├── orgs/route.ts       # Get user organizations
│           └── logout/route.ts     # Clear session
├── server/                  # Shared server utilities (TypeScript)
│   ├── session-utils.ts    # Session encryption/decryption, cookie management
│   └── workos.ts           # WorkOS API helpers
├── public/                  # Static assets served by Next.js
│   ├── app-shell.html      # HTML structure for vanilla JS app (injected by page.tsx)
│   └── client/             # Browser-side JavaScript (ES modules)
│       ├── main.js             # Main client-side logic
│       ├── auth-client-workos.js   # WorkOS auth client
│       ├── convex-client.js        # Convex client adapter
│       ├── config.js, state.js     # Configuration and state
│       ├── canvases.js             # Canvas management
│       ├── grouping.js              # Agent grouping logic
│       ├── legacy-yaml-import.js   # Legacy YAML import (one-way)
│       ├── menu-utils.js           # Menu UI helpers
│       └── modal-utils.js          # Modal UI helpers
├── convex/                  # Convex backend (TypeScript)
│   ├── schema.ts           # Database schema (5 tables)
│   ├── agents.ts           # Agent CRUD + history
│   ├── canvases.ts         # Canvas CRUD
│   ├── orgSettings.ts      # Org configuration
│   ├── agentHistory.ts     # Audit trail queries
│   ├── users.ts            # User org membership sync
│   ├── auth.config.ts      # Convex auth provider config
│   └── lib/auth.ts         # Auth helpers (requireAuth, requireOrgAccess)
├── styles.css              # Main styling (imported by app/globals.css)
├── next.config.js          # Next.js configuration
├── tsconfig.json           # TypeScript configuration for Next.js
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
    → OAuth callback → GET /api/auth/callback
    → Encrypted session cookie (jose AES-256-GCM)
    → Automatic token refresh via POST /api/auth/refresh
```

Session contains: `accessToken`, `refreshToken`, `idToken` (for Convex), `user`, `orgs`, `idTokenExpiresAt`

**Note**: All auth endpoints are now Next.js Route Handlers in `app/api/auth/*` using Edge runtime. The main page (`app/page.tsx`) checks authentication and redirects to `/login` if not authenticated.

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
- **Next.js App Router**: Minimal usage - auth routing and API endpoints only
- **TypeScript**: Used for Next.js pages, API routes, and server utilities
- **Client Code**: Vanilla JavaScript in `public/client/` - NO React, NO build system for client code
- **API Routes**: All use Edge runtime for WebCrypto support (session encryption)
- **Path Aliases**: Use `@/` prefix for imports (e.g., `@/server/session-utils`)
- **Architecture**: Next.js is a thin wrapper - `app/page.tsx` fetches `app-shell.html`, injects it into the DOM, then loads `client/main.js`. This preserves the existing vanilla JS architecture while adding modern auth and routing.

## Debugging

Common issues:
- **Auth fails**: Check WORKOS_* env vars, ensure WorkOS dashboard has correct redirect URIs
- **Convex errors**: Run `npx convex dev` to sync schema, check Convex dashboard logs
- **Session issues**: WORKOS_COOKIE_PASSWORD must be 32+ chars
- **Next.js build errors**: Check TypeScript errors with `pnpm build`, ensure all imports use correct paths
- **Client code not loading**: Verify `public/client/` and `public/app-shell.html` exist
- **Route handler errors**: Check Edge runtime compatibility (WebCrypto APIs work, Node.js APIs don't)
- **Blank page**: Check browser console - ensure `app-shell.html` is loading correctly and `client/main.js` is executing

## Related Files

- `.env.example` - Environment variable template
- `docs/DEPLOYMENT_GUIDE.md` - Vercel deployment instructions
- `docs/VERCEL_PROJECTS.md` - Project IDs and URLs
