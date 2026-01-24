/**
 * Next.js middleware for WorkOS AuthKit authentication
 *
 * This middleware intercepts requests and handles authentication state.
 * It protects routes that require authentication and redirects to login when needed.
 */

import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware({
  // Configure middleware options
  middlewareAuth: {
    // Enable middleware auth (uses cookies, no session endpoint needed)
    enabled: true,
    // Public paths that don't require authentication
    unauthenticatedPaths: [
      '/login',
      '/api/auth/(.*)', // Auth endpoints
      '/api/config',    // Config endpoint for Convex URL
    ],
  },
  // Debug mode for development (will log auth state)
  debug: process.env.NODE_ENV === 'development',
});

export const config = {
  // Match all paths except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
