/**
 * Hook to initialize Lucide icons after render
 * Now uses lucide-react components instead of CDN
 */

import * as LucideIcons from 'lucide-react';
import { createElement } from 'react';

export function useLucideIcons() {
  // No longer needed - using React components directly
}

/**
 * Get a lucide-react icon component by name
 */
export function getLucideIcon(name: string, props?: any) {
  // Convert kebab-case to PascalCase (e.g., "edit-3" -> "Edit3")
  const componentName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (LucideIcons as any)[componentName];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return createElement(IconComponent, { size: 16, ...props });
}
