/**
 * Home page - Main application entry point
 */

'use client';

import { AppProviders } from '@/components/AppProviders';
import { AppLayout } from '@/components/layout/AppLayout';

export default function HomePage() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}
