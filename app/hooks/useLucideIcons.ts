/**
 * Hook and utility for lucide-react icons
 *
 * Uses a curated icon registry for tree-shaking optimization.
 * Only icons in the registry are included in the bundle.
 */

import { createElement } from 'react';
import { getIconComponent } from '@/utils/iconRegistry';

export function useLucideIcons() {
  // No longer needed - using React components directly
}

/**
 * Get a lucide-react icon element by name
 */
export function getLucideIcon(name: string, props?: Record<string, unknown>) {
  const IconComponent = getIconComponent(name);

  if (!IconComponent) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Icon "${name}" not in registry. Add it to app/utils/iconRegistry.ts`
      );
    }
    return null;
  }

  return createElement(IconComponent, { size: 16, ...props });
}
