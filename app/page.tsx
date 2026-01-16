'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    console.log('[AgentCanvas] Page mounted, starting initialization');

    async function initializeApp() {
      try {
        console.log('[AgentCanvas] Checking authentication...');
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        console.log('[AgentCanvas] Auth response:', data.authenticated);

        if (!data.authenticated) {
          console.log('[AgentCanvas] Not authenticated, redirecting to login');
          window.location.href = '/login';
          return;
        }

        console.log('[AgentCanvas] Fetching app shell...');
        const shellResponse = await fetch('/app-shell.html');
        const shellHtml = await shellResponse.text();
        console.log('[AgentCanvas] App shell fetched, length:', shellHtml.length);

        const root = document.getElementById('app-root');
        if (root) {
          console.log('[AgentCanvas] Injecting HTML into root');
          root.innerHTML = shellHtml;
        } else {
          console.error('[AgentCanvas] app-root element not found!');
          return;
        }

        console.log('[AgentCanvas] Loading client/main.js');
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/client/main.js';
        script.onload = () => console.log('[AgentCanvas] client/main.js loaded');
        script.onerror = (e) => console.error('[AgentCanvas] Failed to load client/main.js', e);
        document.body.appendChild(script);

        console.log('[AgentCanvas] Initialization complete');
      } catch (err) {
        console.error('[AgentCanvas] Initialization failed:', err);
      }
    }

    initializeApp();
  }, []);

  return <div id="app-root" style={{ minHeight: '100vh' }}></div>;
}
