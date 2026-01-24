/**
 * WorkOS AuthKit catch-all route handler
 *
 * This route handles all auth-related endpoints:
 * - /api/auth/callback - OAuth callback from WorkOS
 * - /api/auth/logout - Sign out and clear session
 *
 * The handleAuth() function from the SDK manages these automatically.
 */

import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth();
export const POST = handleAuth();
