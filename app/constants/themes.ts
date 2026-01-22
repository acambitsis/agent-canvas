/**
 * Theme configuration for AgentCanvas
 * Defines available themes and their metadata
 */

export const THEME_VALUES = ['light', 'dark', 'midnight'] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

export type ThemePreference = ThemeValue | 'system';

export interface ThemeConfig {
  label: string;
  icon: string;
  description: string;
}

export const THEMES: Record<ThemeValue, ThemeConfig> = {
  light: {
    label: 'Light',
    icon: 'sun',
    description: 'Clean, bright interface',
  },
  dark: {
    label: 'Dark',
    icon: 'moon',
    description: 'Easy on the eyes',
  },
  midnight: {
    label: 'Midnight',
    icon: 'sparkles',
    description: 'Deep blue professional',
  },
} as const;

export const SYSTEM_THEME_OPTION = {
  label: 'System',
  icon: 'monitor',
  description: 'Match your device',
} as const;
