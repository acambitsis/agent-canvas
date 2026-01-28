/**
 * Icon component - wrapper for lucide-react icons
 * Replaces <i data-lucide="icon-name"> with React components
 */

'use client';

import * as LucideIcons from 'lucide-react';
import { createElement } from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  // Convert kebab-case to PascalCase (e.g., "edit-3" -> "Edit3")
  const componentName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (LucideIcons as any)[componentName];

  if (!IconComponent) {
    // Fallback: show icon name as text for debugging
    return <span className={className} style={style} title={`Icon: ${name}`}>{name}</span>;
  }

  return createElement(IconComponent, { size, className, style });
}
