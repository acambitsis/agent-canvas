---
name: debug-production
description: Debug production issues in AgentCanvas by querying Convex logs, Vercel logs, and database state. Use when user reports errors, authentication failures, or needs to diagnose issues in the deployed app.
---

# Production Debugging Guide for AgentCanvas

Use this skill to diagnose production issues efficiently using available tools.

## Available Diagnostic Tools

### 1. Convex MCP Tools (Backend)

**Get deployment info first:**
```
mcp__convex__status with projectDir: /Users/andreas/src/agent-canvas
```

This returns the deployment selector needed for other queries. Use the `ownDev` selector for dev environment.

**Fetch logs (most useful for debugging):**
```
mcp__convex__logs with:
  - deploymentSelector: (from status)
  - entriesLimit: 50 (adjust as needed, max 1000)
```

**Query database tables:**
```
mcp__convex__tables with deploymentSelector  # List all tables and schemas
mcp__convex__data with tableName, order: "desc", limit: 20  # Read table data
```

**Run ad-hoc queries:**
```
mcp__convex__runOneoffQuery with a query string
```

### 2. Vercel CLI (Edge Functions/API Routes)

**List recent deployments:**
```bash
vercel ls | head -10
```

**Check which deployment is live:**
Look for the most recent "Production" deployment.

**View logs (text format works better than JSON):**
```bash
vercel logs canvas.amplify360.ai --follow  # Real-time
vercel logs canvas.amplify360.ai | head -100  # Recent logs
```

Note: Vercel logs can timeout after 5 minutes with no activity.

**Check environment variables:**
```bash
vercel env ls  # Lists vars (values are encrypted)
```

### 3. Convex CLI (Alternative to MCP)

```bash
npx convex logs --prod  # Production logs (may run in background)
npx convex deploy --yes  # Deploy Convex functions to production
npx convex env get VAR_NAME  # Get specific env var
```

## Common Issues and Diagnosis

### Auth: "Authentication required" in Convex

**Symptoms:** All Convex queries fail with this error.

**Cause:** JWT issuer doesn't match `convex/auth.config.ts` providers.

**Diagnosis steps:**
1. Check Convex logs for the error pattern
2. Verify `BASE_URL` on Vercel matches an issuer in auth.config.ts
3. Check if auth.config.ts was deployed: `npx convex deploy --yes`

**Key issuers in auth.config.ts:**
- `http://localhost:3000` (local dev)
- `https://agent-canvas.vercel.app` (Vercel default)
- `https://canvas.amplify360.ai` (custom domain)

### Auth: "no_organization" Error on Login

**Symptoms:** Invited users redirected to login with `?error=no_organization`.

**Cause:** `fetchUserOrgs()` returns empty array.

**Diagnosis steps:**
1. Check Vercel logs for `[Auth]` prefixed entries
2. Look for `[Auth Callback]` logs showing org membership count
3. Verify in WorkOS dashboard:
   - User Management → Invitations (status: Accepted?)
   - User Management → Organization Memberships (user linked to org?)
   - AuthKit Settings → Redirect URIs includes callback URL

**Relevant code:** `app/api/auth/callback/route.ts:69-72`

### Database State Issues

**Check org memberships in Convex:**
```
mcp__convex__data with tableName: "userOrgMemberships", order: "desc", limit: 20
```

**Check canvases:**
```
mcp__convex__data with tableName: "canvases", order: "desc"
```

## Log Prefixes to Search For

| Prefix | Location | Purpose |
|--------|----------|---------|
| `[Auth]` | server/workos.ts | WorkOS API calls |
| `[Auth Callback]` | app/api/auth/callback | Login flow |
| `CONVEX Q(...)` | Convex logs | Query errors |
| `CONVEX M(...)` | Convex logs | Mutation errors |

## Quick Diagnostic Workflow

1. **Identify the error type:**
   - Convex error → Check Convex logs first
   - API route error → Check Vercel logs
   - Auth error → Check both

2. **Get recent Convex logs:**
   ```
   mcp__convex__logs with entriesLimit: 50
   ```

3. **Get recent Vercel logs:**
   ```bash
   vercel logs canvas.amplify360.ai | head -50
   ```

4. **Check relevant database state:**
   - Auth issues → `userOrgMemberships` table
   - Canvas issues → `canvases` table
   - Agent issues → `agents` table

5. **Verify environment:**
   - `BASE_URL` must match JWT issuer
   - `WORKOS_*` vars must be set
   - Convex must be deployed with latest auth.config.ts

## Adding Debug Logging

When adding temporary logging for diagnosis:

1. **Prefix logs** with `[ComponentName]` for easy filtering
2. **Log key values** like user IDs, org IDs, counts
3. **Commit and push** - Vercel auto-deploys from main
4. **Remove after debugging** - Don't leave verbose logs in production

Example:
```typescript
console.log(`[Auth Callback] User ${user.email}: ${orgs.length} memberships`);
console.error(`[Auth] fetchUserOrgs failed: ${response.status}`);
```
