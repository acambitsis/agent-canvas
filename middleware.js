import { isAuthenticated } from './api/lib/session.js';

export const config = {
  runtime: 'edge',
  // Exclude static files from middleware execution
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|css|js)$).*)',
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Allow access to login page and auth endpoints without authentication
  if (pathname === '/login' || pathname === '/login.html' || pathname.startsWith('/auth/')) {
    return;
  }

  // Check if user is authenticated
  const authenticated = await isAuthenticated(request);

  if (!authenticated) {
    // Redirect to login page
    return Response.redirect(new URL('/login', request.url), 302);
  }

  // User is authenticated, continue to the original request
  return;
}
