/**
 * WorkOS AuthKit catch-all route handler
 *
 * This route handles all auth-related endpoints:
 * - /api/auth/callback - OAuth callback from WorkOS
 * - /api/auth/logout - Sign out and clear session
 *
 * The handleAuth() function from the SDK manages these automatically.
 *
 * Deep linking (RelayState) is handled automatically:
 * - When middleware redirects unauthenticated users to AuthKit, it encodes
 *   the original URL in the OAuth state parameter
 * - After successful auth, handleAuth() decodes the state and redirects
 *   users back to their intended destination
 *
 * Token revocation on logout is handled by the SDK's signOut() function,
 * which clears the session cookie and revokes the session with WorkOS.
 */

import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth();
export const POST = handleAuth();
