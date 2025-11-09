export const config = {
  runtime: 'edge',
};

export default function middleware(request) {
  const basicAuth = request.headers.get('authorization');
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  // If no password is configured, deny access
  if (!expectedPassword) {
    return new Response('Authentication not configured', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];

    try {
      const [user, pwd] = atob(authValue).split(':');

      // Username can be anything, password must match environment variable
      if (pwd === expectedPassword) {
        // Authentication successful, continue to the original request
        return;
      }
    } catch (e) {
      // Invalid base64 or malformed header
    }
  }

  // Authentication failed or not provided
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
