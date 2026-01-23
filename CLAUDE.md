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
- **Libraries**: `next`, `react`, `react-dom`, `lucide-react` (icons), `jose` (session encryption), `convex`, `js-yaml` (legacy YAML import)

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

## Convex Deployments

Two separate Convex deployments exist:
- **Dev** (`expert-narwhal-281`): Used by `npx convex dev` locally
- **Prod** (`quaint-bee-380`): Used by Vercel production

After testing changes locally, promote to prod with `npx convex deploy`. Vercel deploys the frontend; Convex backend must be deployed separately.

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
│   │   └── ui/             # Reusable UI components
│   │       ├── LoadingOverlay.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
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
│   │   └── useResizable.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── agent.ts
│   │   ├── auth.ts
│   │   ├── canvas.ts
│   │   └── config.ts
│   ├── utils/              # Utility functions
│   │   ├── config.ts
│   │   ├── grouping.ts
│   │   └── validation.ts
│   └── api/                # Next.js Route Handlers (Edge runtime)
│       ├── config/route.ts         # App configuration endpoint
│       └── auth/                   # Auth endpoints
│           ├── url/route.ts        # Generate WorkOS auth URL
│           ├── callback/route.ts   # OAuth callback handler
│           ├── session/route.ts    # Get current session
│           ├── refresh/route.ts    # Refresh access token
│           ├── orgs/route.ts       # Get user organizations
│           └── logout/route.ts     # Clear session
├── server/                  # Shared server utilities (TypeScript)
│   ├── session-utils.ts    # Session encryption/decryption, cookie management
│   └── workos.ts           # WorkOS API helpers
├── public/                  # Static assets served by Next.js
│   └── styles.css          # Main CSS stylesheet
├── convex/                  # Convex backend (TypeScript)
│   ├── schema.ts           # Database schema
│   ├── agents.ts           # Agent CRUD + history
│   ├── canvases.ts         # Canvas CRUD
│   ├── orgSettings.ts      # Org configuration
│   ├── agentHistory.ts     # Audit trail queries
│   ├── users.ts            # (minimal - org membership moved to JWT)
│   ├── auth.config.ts      # Convex auth provider config
│   └── lib/auth.ts         # Auth helpers (requireAuth, requireOrgAccess)
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
```

Key patterns:
- All mutations use `requireAuth()` and `requireOrgAccess()` from `convex/lib/auth.ts`
- Org access checked via JWT claims (no database lookup)
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
requireOrgAccess(auth, workosOrgId);  // Checks JWT claims (no await, no ctx)
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
