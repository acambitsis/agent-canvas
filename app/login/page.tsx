import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { LoginClient } from './LoginClient';
import '../globals.css';

export default async function LoginPage() {
  // Generate sign-in URL on the server
  const signInUrl = await getSignInUrl();

  return <LoginClient signInUrl={signInUrl} />;
}
