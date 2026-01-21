/**
 * Canvas page - Direct link to a specific canvas
 */

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AppProviders } from '@/components/AppProviders';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCanvas } from '@/contexts/CanvasContext';
import { Icon } from '@/components/ui/Icon';

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

function CanvasErrorView() {
  const router = useRouter();
  const { initialCanvasError } = useCanvas();

  if (!initialCanvasError) {
    return null;
  }

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="canvas-error">
      <div className="canvas-error__content">
        <h1>
          {initialCanvasError === 'not_found'
            ? 'Canvas Not Found'
            : 'Access Denied'}
        </h1>
        <p>
          {initialCanvasError === 'not_found'
            ? 'This canvas may have been deleted or the link is invalid.'
            : 'You do not have access to this canvas.'}
        </p>
        <button className="btn btn--primary" onClick={handleGoHome}>
          Go to Home
        </button>
      </div>
    </div>
  );
}

function CanvasLoadingView() {
  return (
    <div className="canvas-error">
      <div className="canvas-error__loading">
        <Icon name="loader-2" className="loading-icon" />
        <p>Loading canvas...</p>
      </div>
    </div>
  );
}

function CanvasContent() {
  const { initialCanvasError, isLoading, currentCanvas } = useCanvas();

  // Show loading while resolving initial canvas
  if (isLoading && !initialCanvasError && !currentCanvas) {
    return <CanvasLoadingView />;
  }

  if (initialCanvasError) {
    return <CanvasErrorView />;
  }

  return <AppLayout />;
}

export default function CanvasPage({ params }: CanvasPageProps) {
  const { id } = use(params);

  return (
    <AppProviders initialCanvasId={id}>
      <CanvasContent />
    </AppProviders>
  );
}
