/**
 * useWidgetToken - Hook for fetching WorkOS widget authentication tokens
 *
 * Manages the lifecycle of widget tokens including fetching, caching,
 * and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWidgetTokenOptions {
  scopes?: string[];
}

interface UseWidgetTokenResult {
  token: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWidgetToken(
  organizationId: string | null,
  options?: UseWidgetTokenOptions
): UseWidgetTokenResult {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the scopes array by value to prevent infinite loops
  const scopesRef = useRef(options?.scopes);
  scopesRef.current = options?.scopes;

  const fetchToken = useCallback(async () => {
    if (!organizationId) {
      setToken(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/widgets/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          scopes: scopesRef.current,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch widget token');
      }

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token fetch error');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return { token, loading, error, refetch: fetchToken };
}
