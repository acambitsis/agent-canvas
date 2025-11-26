# Email Allowlist Management

## Current Implementation

The email allowlist is managed via the `ALLOWED_EMAILS` environment variable, which contains a comma-separated list of allowed email addresses.

**Location**: Vercel Dashboard → Project Settings → Environment Variables

**Format**: Comma-separated list (spaces are trimmed automatically)
```
user1@example.com,user2@example.com,admin@company.com
```

## How It Works

1. When a user requests a magic link, the system checks if their email is in `ALLOWED_EMAILS`
2. If the email is **not** in the allowlist:
   - The system returns a generic success message (security best practice - doesn't reveal if email exists)
   - **No magic link is sent**
   - **No token is stored**
3. If the email **is** in the allowlist:
   - A magic link token is generated and stored
   - An email is sent via Resend
   - User can authenticate

## Current Maintenance Methods

### Method 1: Vercel Dashboard (Recommended for Production)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Find `ALLOWED_EMAILS`
5. Click **Edit**
6. Update the comma-separated list
7. **Important**: Select which environments to apply to (Production, Preview, Development)
8. Click **Save**
9. **Redeploy** for changes to take effect:
   ```bash
   vercel --prod
   ```

### Method 2: Vercel CLI

```bash
# Set allowlist for production
vercel env add ALLOWED_EMAILS production
# Enter: user1@example.com,user2@example.com,admin@company.com

# Set allowlist for preview/development
vercel env add ALLOWED_EMAILS preview
vercel env add ALLOWED_EMAILS development

# View current value
vercel env ls

# Pull to local .env.local
vercel env pull
```

### Method 3: Local Development (.env.local)

For local development, create `.env.local`:

```bash
ALLOWED_EMAILS=user1@example.com,user2@example.com,admin@company.com
```

**Note**: This file should be in `.gitignore` (already configured)

## Best Practices

### 1. Email Format
- Emails are automatically normalized (lowercased and trimmed)
- Case-insensitive matching
- No spaces needed around commas (they're trimmed)

### 2. Security
- **Never commit `ALLOWED_EMAILS` to git** (already in `.gitignore`)
- Use different allowlists for different environments
- Regularly audit the allowlist
- Remove inactive users promptly

### 3. Maintenance
- Keep the list manageable (current implementation loads all emails into memory)
- For large lists (100+ emails), consider implementing a database-backed solution
- Document who has access and why

## Limitations of Current Approach

1. **Manual Updates**: Requires editing environment variables
2. **Redeployment Required**: Changes require redeploy to take effect
3. **No UI**: No web interface for managing the list
4. **No Audit Trail**: No logging of who added/removed emails
5. **No Self-Service**: Users can't request access themselves
6. **Scalability**: Not ideal for large lists (100+ emails)

## Future Improvements

### Option 1: Admin API Endpoint (Recommended)

Create an admin API endpoint to manage the allowlist:

```javascript
// api/admin/allowlist.js
POST /api/admin/allowlist/add
POST /api/admin/allowlist/remove
GET /api/admin/allowlist/list
```

**Pros**:
- No redeployment needed
- Can add audit logging
- Can add validation
- Can integrate with existing admin UI

**Cons**:
- Requires authentication/authorization
- More code to maintain

### Option 2: Database-Backed Allowlist

Store emails in Vercel KV or Postgres:

```javascript
// Store in KV with key pattern: allowlist:email@example.com
await kv.set(`allowlist:${email}`, true);
```

**Pros**:
- Scales to thousands of emails
- No redeployment needed
- Can add metadata (added date, added by, etc.)
- Can add expiration dates

**Cons**:
- More complex implementation
- Requires database/KV access

### Option 3: Domain-Based Allowlist

Allow entire domains instead of individual emails:

```bash
ALLOWED_DOMAINS=example.com,company.com
```

**Pros**:
- Easier to manage for organizations
- Fewer updates needed

**Cons**:
- Less granular control
- May allow unintended users

### Option 4: Self-Service Request Flow

Allow users to request access:

1. User requests access via form
2. Admin receives notification
3. Admin approves via admin panel
4. Email automatically added to allowlist

**Pros**:
- Better user experience
- Reduces admin burden
- Can add approval workflow

**Cons**:
- Most complex implementation
- Requires notification system

## Quick Reference

### Add a User
```bash
# Current value
ALLOWED_EMAILS=user1@example.com,user2@example.com

# New value (add user3@example.com)
ALLOWED_EMAILS=user1@example.com,user2@example.com,user3@example.com
```

### Remove a User
```bash
# Current value
ALLOWED_EMAILS=user1@example.com,user2@example.com,user3@example.com

# New value (remove user2@example.com)
ALLOWED_EMAILS=user1@example.com,user3@example.com
```

### Verify Current Allowlist
```bash
# Via CLI
vercel env ls | grep ALLOWED_EMAILS

# Or check in Vercel Dashboard
# Settings → Environment Variables → ALLOWED_EMAILS
```

## Troubleshooting

### User Can't Authenticate

1. **Check email is in allowlist**:
   ```bash
   vercel env ls | grep ALLOWED_EMAILS
   ```

2. **Verify email normalization**:
   - System lowercases and trims emails
   - `User@Example.COM` becomes `user@example.com`
   - Check allowlist uses lowercase

3. **Check environment**:
   - Ensure allowlist is set for the correct environment (Production/Preview/Development)

4. **Verify redeployment**:
   - Changes require redeploy to take effect
   - Check deployment logs for errors

### Allowlist Not Working

1. **Check environment variable name**: Must be exactly `ALLOWED_EMAILS`
2. **Check format**: Comma-separated, no extra spaces needed
3. **Redeploy**: Changes require redeployment
4. **Check logs**: Look for errors in Vercel function logs

## Related Documentation

- [Magic Link Authentication Spec](./magic-link-auth-spec.md)
- [Environment Variables Setup](../claude.md#environment-variables-required)
- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)


