# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**AgentCanvas** is a web-based configuration management system for visualizing and editing multi-phase agent workflows. It displays business process agents organized by phases with interactive editing capabilities.

**Architecture**: Next.js 15 App Router with React 19 for the frontend UI, Convex for the real-time backend, and WorkOS for authentication. The app is fully React/TypeScript with server-side auth checks and API routes.

## Technology Stack

- **Frontend**: Next.js 15 (App Router) with React 19, TypeScript, HTML5, CSS3
- **Backend**: Convex (real-time backend-as-a-service)
- **Auth**: WorkOS AuthKit (magic link, social login, SSO)
- **Hosting**: Vercel (Next.js deployment)
- **Libraries**: `next`, `react`, `react-dom`, `lucide-react` (icons), `@workos-inc/authkit-nextjs` (auth SDK), `@workos-inc/widgets` (member management UI), `@tanstack/react-query`, `convex`, `js-yaml` (legacy YAML import)

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

## Git Workflow

**NEVER commit/push directly to `main`. All changes require PRs.**

| Change Type | Workflow |
|-------------|----------|
| Minor fixes (typos, <3 files) | Commit to `dev` → PR to `main` |
| Features (3+ files, new functionality, behavior changes) | Feature branch off `dev` → PR to `dev` → merge. Promote to `main` only when instructed. |

**Wait for explicit instruction before merging PRs.**

## Deployments

**Frontend (Vercel)** - auto-deploys on push:
- **Dev:** https://canvas-dev.amplify360.ai (from `dev` branch)
- **Prod:** https://canvas.amplify360.ai (from `main` branch)

**Backend (Convex)** - requires manual `npx convex deploy`:
- **Dev** (`expert-narwhal-281`): Used locally and by dev frontend
- **Prod** (`quaint-bee-380`): Used by prod frontend

## Environment Variables

```bash
# Convex
CONVEX_DEPLOYMENT=your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud  # Preferred for Next.js
# Fallback: VITE_CONVEX_URL or CONVEX_URL

# WorkOS AuthKit SDK
WORKOS_API_KEY=sk_live_xxxxx
WORKOS_CLIENT_ID=client_xxxxx
WORKOS_COOKIE_PASSWORD=your-32-char-secret  # openssl rand -hex 32
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback  # Must match WorkOS dashboard setting
WORKOS_WEBHOOK_SECRET=whsec_xxxxx  # For webhook signature verification

# Super Admin (comma-separated email addresses)
SUPER_ADMIN_EMAILS=admin@example.com

# App
BASE_URL=http://localhost:3000
```

## File Structure

```
/
├── app/                     # Next.js App Router (React + TypeScript)
│   ├── page.tsx            # Main app page (auth-protected)
│   ├── login/page.tsx      # Login page
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles (imports styles.css)
│   ├── components/         # React components
│   │   ├── agents/         # Agent display components
│   │   │   ├── AgentCard.tsx
│   │   │   ├── AgentGrid.tsx
│   │   │   └── AgentGroupSection.tsx
│   │   ├── forms/          # Form components
│   │   │   └── AgentModal.tsx
│   │   ├── layout/         # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── MainToolbar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── ui/             # Reusable UI components
│   │   │   ├── LoadingOverlay.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   ├── org/                # Organization components
│   │   │   └── MembersWidget.tsx   # WorkOS members management widget
│   │   ├── MembershipSync.tsx  # Syncs org memberships on app load
│   │   ├── WorkOSWidgetsProvider.tsx  # WorkOS widgets context provider
│   │   └── AppProviders.tsx    # Provider hierarchy wrapper
│   ├── contexts/           # React Context providers
│   │   ├── AgentContext.tsx
│   │   ├── AppStateContext.tsx
│   │   ├── AuthContext.tsx
│   │   ├── CanvasContext.tsx
│   │   ├── ConvexClientProvider.tsx
│   │   └── GroupingContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useConvex.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useLucideIcons.ts
│   │   ├── useResizable.ts
│   │   └── useWidgetToken.ts   # WorkOS widget token management
│   ├── types/              # TypeScript type definitions
│   │   ├── agent.ts
│   │   ├── auth.ts
│   │   ├── canvas.ts
│   │   └── config.ts
│   ├── utils/              # Utility functions
│   │   ├── config.ts
│   │   ├── grouping.ts
│   │   └── validation.ts
│   └── api/                # Next.js Route Handlers
│       ├── config/route.ts         # App configuration endpoint
│       ├── widgets/
│       │   └── token/route.ts      # WorkOS widget token generation
│       └── auth/
│           └── [...authkit]/route.ts  # WorkOS AuthKit SDK catch-all (handles callback, session, logout)
├── middleware.ts            # WorkOS AuthKit middleware
├── server/                  # Shared server utilities (TypeScript)
│   ├── org-utils.ts        # Organization access helpers
│   └── workos.ts           # WorkOS org API helpers
├── public/                  # Static assets served by Next.js
│   └── styles.css          # Main CSS stylesheet
├── convex/                  # Convex backend (TypeScript)
│   ├── schema.ts           # Database schema (includes userOrgMemberships, syncLog)
│   ├── agents.ts           # Agent CRUD + history
│   ├── canvases.ts         # Canvas CRUD
│   ├── orgSettings.ts      # Org configuration
│   ├── orgMemberships.ts   # Org membership queries + manual sync
│   ├── agentHistory.ts     # Audit trail queries
│   ├── http.ts             # HTTP routes for WorkOS webhooks
│   ├── crons.ts            # Daily membership reconciliation
│   ├── auth.config.ts      # Convex auth provider config (WorkOS JWKS)
│   └── lib/
│       ├── auth.ts         # Auth helpers (reads from DB, not JWT claims)
│       └── membershipSync.ts # Shared sync logic for webhooks/cron/manual
├── next.config.js          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
└── tests/                   # Vitest tests (unit/, integration/)
```

## Convex Schema

```typescript
// Tables with proper indexes
orgSettings          // Org-level config (tools, colors, defaults)
canvases             // Canvas containers per org (includes phases[], categories[] for ordering)
agents               // Individual agents (phase, agentOrder, name, tools, metrics, category, status)
agentHistory         // Audit trail for all agent changes
userOrgMemberships   // Org memberships synced from WorkOS (real-time source of truth)
syncLog              // Audit trail for membership sync operations
```

Key patterns:
- All mutations use `requireAuth()` and `requireOrgAccess()` from `convex/lib/auth.ts`
- Org access checked via database (userOrgMemberships table), not JWT claims
- Agent changes automatically record history
- Real-time subscriptions via Convex enable collaborative editing
- Org memberships sync via three layers: webhooks (instant), daily cron (safety net), manual sync (debugging)
- **Batch queries**: Use `Promise.all` (not sequential loops) since Convex lacks JOINs/WHERE IN

## Auth Flow

Uses `@workos-inc/authkit-nextjs` SDK + `@workos-inc/widgets` for member management.

```
Login → getSignInUrl() → WorkOS AuthKit → /api/auth/[...authkit] → Session cookie
```

### Org Membership Sync

**Source of truth**: `userOrgMemberships` table in Convex (not JWT claims)

Three sync layers: webhooks (`convex/http.ts`), daily cron (`convex/crons.ts`), manual button (`convex/orgMemberships.ts`) — all use `convex/lib/membershipSync.ts`.

### WorkOS Widgets

Member management uses pre-built WorkOS widgets. Token endpoint `/api/widgets/token` requires org admin. Widgets require origin in WorkOS Dashboard → Allowed Origins.

### Key Auth Files
- `middleware.ts` - Route protection
- `convex/lib/auth.ts` - `requireAuth()`, `requireOrgAccess()` (queries DB, not JWT)
- `server/org-utils.ts` - `isSuperAdmin()`, `isUserOrgAdmin()`

## Key Patterns

### State Management
```typescript
// React Context providers manage global state
<AuthProvider>          // User authentication state
<ConvexClientProvider>  // Convex client instance
<CanvasProvider>        // Canvas list and current canvas
<AgentProvider>         // Agent list with real-time updates
<GroupingProvider>      // UI grouping/filtering state
<AppStateProvider>      // App-wide UI state (modals, loading, toasts)
```

### Authorization
```typescript
// In Convex functions (convex/lib/auth.ts)
const auth = await requireAuth(ctx);  // Returns {workosUserId, email, isSuperAdmin, orgs}
requireOrgAccess(auth, workosOrgId);  // Checks database memberships (no await, no ctx)
```

### Real-time Updates
```typescript
// React hooks subscribe to Convex queries
const agents = useQuery(api.agents.list, { canvasId });
// Agents automatically update when changed in Convex
```

### Persisted UI Preferences
Use `useLocalStorage` hook + `AppStateContext` for UI state that persists across sessions (e.g., `sidebarWidth`, `isSidebarCollapsed`). Keys prefixed with `agentcanvas-`.

## Styling System

- CSS variables in `:root` for theming
- `.surface-card`, `.surface-panel` for containers
- `.chip`, `.badge` for inline elements
- `generateDynamicCSS()` injects tool colors from config
- Utility classes: `u-flex`, `u-gap-sm`, `u-wrap`

## Code Standards

### DRY & Type Safety
- **Derive frontend types from Convex schema** using `Doc<"tableName">` - never duplicate interfaces
- **Centralize constants** - grep before adding any string literal; if it exists elsewhere, extract to shared constant
- **Constants locations**: `app/types/validationConstants.ts` (domain values), `app/utils/config.ts` (UI config)

### Naming
- **Functions/Variables**: camelCase
- **CSS Classes**: kebab-case
- **React Components**: PascalCase, functional components with hooks
- **TypeScript**: Used throughout the app (pages, components, API routes, utilities)
- **File Extensions**: `.tsx` for React components, `.ts` for utilities
- **API Routes**: All use Edge runtime for WebCrypto support (session encryption)
- **Path Aliases**: Use `@/` prefix for imports (e.g., `@/components/agents/AgentCard`)
- **Architecture**: Fully React-based with Next.js App Router. Client-side state managed via React Context and Convex real-time subscriptions.

## Debugging

Common issues:
- **Auth fails**: Check WORKOS_* env vars, ensure WorkOS dashboard has correct redirect URIs
- **Convex errors**: Run `npx convex dev` to sync schema, check Convex dashboard logs
- **Session issues**: WORKOS_COOKIE_PASSWORD must be 32+ chars
- **Next.js build errors**: Check TypeScript errors with `pnpm build`, ensure all imports use correct paths
- **React hydration errors**: Check browser console for mismatched server/client rendering
- **Route handler errors**: Check Edge runtime compatibility (WebCrypto APIs work, Node.js APIs don't)
- **Blank page**: Check browser console for React errors, ensure contexts are properly nested

## Related Files

- `.env.example` - Environment variable template
- `docs/DEPLOYMENT_GUIDE.md` - Vercel deployment instructions
- `docs/VERCEL_PROJECTS.md` - Project IDs and URLs
