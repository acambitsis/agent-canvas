'use client';

import { useEffect, useState } from 'react';
import '../globals.css';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for error in URL
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');

    if (urlError) {
      let message = 'Authentication failed. Please try again.';

      switch (urlError) {
        case 'missing_code':
          message = 'Authorization code was not provided.';
          break;
        case 'auth_failed':
          message = 'Authentication failed. Please try again.';
          break;
        case 'config_error':
          message = 'Server configuration error. Please contact support.';
          break;
        case 'not_allowed':
          message = 'Your account is not authorized to access this application.';
          break;
        case 'access_denied':
          message = 'Access was denied. Please contact your administrator.';
          break;
      }

      setError(message);
    }

    // Check if already authenticated
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          window.location.href = '/';
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirectUri: window.location.origin + '/api/auth/callback',
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('Failed to initiate sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="surface-card login-card">
        <h1 className="login-title">AgentCanvas</h1>
        <p className="login-subtitle">Sign in to manage your agent workflows</p>

        {error && (
          <div className="error-message show" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="sign-in-btn"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Redirecting...
            </>
          ) : (
            'Sign in with WorkOS'
          )}
        </button>

        <div className="features">
          <ul>
            <li>Secure authentication</li>
            <li>Magic link, social login, or SSO</li>
            <li>Enterprise-ready access control</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
