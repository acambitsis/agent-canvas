/**
 * Icon component - wrapper for lucide-react icons
 *
 * Uses a curated icon registry for tree-shaking optimization.
 * Only icons in the registry are included in the bundle.
 */

'use client';

import { createElement } from 'react';
import { getIconComponent } from '@/utils/iconRegistry';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  const IconComponent = getIconComponent(name);

  if (!IconComponent) {
    // Log warning in development to help identify missing icons
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Icon "${name}" not in registry. Add it to app/utils/iconRegistry.ts`
      );
    }
    // Fallback: show icon name as text for debugging
    return (
      <span className={className} style={style} title={`Icon: ${name}`}>
        {name}
      </span>
    );
  }

  return createElement(IconComponent, { size, className, style });
}
