# 🚨 DEPLOYMENT CHECKLIST - WorkOS SDK Migration

> **DELETE THIS FILE** after successful production deployment

---

## Pre-Deployment: Verify Environment Variables

### Vercel Production

| Variable | Required Value | ⚠️ Pitfall |
|----------|----------------|------------|
| `BASE_URL` | `https://canvas.amplify360.ai` | **MUST match deployment URL exactly or you get redirect loop to localhost** |
| `WORKOS_REDIRECT_URI` | `https://canvas.amplify360.ai/api/auth/callback` | Must match WorkOS Dashboard |
| `WORKOS_API_KEY` | Production key | - |
| `WORKOS_CLIENT_ID` | Production client | - |
| `WORKOS_COOKIE_PASSWORD` | 32+ char secret | - |
| `SUPER_ADMIN_EMAILS` | Your admin emails | Comma-separated |

### Convex Production

| Variable | Required Value |
|----------|----------------|
| `WORKOS_API_KEY` | Same as Vercel |
| `WORKOS_CLIENT_ID` | Same as Vercel |
| `WORKOS_WEBHOOK_SECRET` | From WorkOS webhook setup |
| `SUPER_ADMIN_EMAILS` | Same as Vercel |

### Variables to REMOVE

| Variable | Environment | Reason |
|----------|-------------|--------|
| `JWT_PRIVATE_KEY` | Vercel (all) | SDK handles auth |
| `WORKOS_AUTHKIT_DOMAIN` | Convex | SDK doesn't need it |

---

## Pre-Deployment: Verify WorkOS Dashboard

### Redirect URIs (Authentication → Redirects)
- [ ] `https://canvas.amplify360.ai/api/auth/callback`

### CORS Allowed Origins (Authentication → Sessions → CORS)
- [ ] `https://canvas.amplify360.ai`

### Webhooks (if using real-time sync)
- [ ] Endpoint: `https://quaint-bee-380.convex.site/workos/webhook`
- [ ] Events: `organization_membership.created`, `.updated`, `.deleted`

---

## Deployment Order

1. **Convex first**: `npx convex deploy --prod`
2. **Then Vercel**: Merge PR or `vercel --prod`

---

## ⚠️ Common Pitfalls

### Redirect Loop to localhost
**Symptom**: Visiting `canvas.amplify360.ai` redirects to `http://localhost:3000`
**Cause**: `BASE_URL` set to localhost
**Fix**: Set `BASE_URL=https://canvas.amplify360.ai` in Vercel Production, then redeploy

### WorkOS Widgets CORS Error
**Symptom**: Console shows "Failed to GET https://api.workos.com/_widgets/..."
**Cause**: Production URL not in WorkOS Allowed Origins
**Fix**: Add `https://canvas.amplify360.ai` to WorkOS Dashboard → Sessions → CORS

### Auth Callback Fails
**Symptom**: Login fails or redirects to wrong URL
**Cause**: `WORKOS_REDIRECT_URI` doesn't match WorkOS Dashboard
**Fix**: Ensure exact match in both places

### Env Changes Not Taking Effect
**Symptom**: Changed vars but same behavior
**Cause**: Vercel requires redeployment for env changes
**Fix**: Trigger new deployment after env changes

### Trailing Newline in Env Vars (CLI)
**Symptom**: "This is not a valid redirect URI" with `%0A` in URL
**Cause**: Using `echo "value" | vercel env add` adds a newline character
**Fix**: Use `printf '%s' 'value' | vercel env add VAR_NAME environment` instead

---

## Post-Deployment Verification

- [ ] Visit `https://canvas.amplify360.ai` → should show login
- [ ] Login via WorkOS → should return to app (not localhost!)
- [ ] Sidebar shows organizations
- [ ] Click "Members" as admin → widget loads
- [ ] Check Convex logs for errors

---

## Rollback

1. **Vercel**: Redeploy previous commit from dashboard
2. **Convex**: Schema is additive, no rollback needed
3. **WorkOS**: Webhook can be disabled if needed
