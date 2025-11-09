export default function middleware(request) {
  const basicAuth = request.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];

    try {
      const [user, pwd] = atob(authValue).split(':');

      // Username can be anything, password must match
      if (pwd === 'alexthetpsoperatingsystem') {
        return new Response(null, {
          status: 200,
        });
      }
    } catch (e) {
      // Invalid base64 or malformed header
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
