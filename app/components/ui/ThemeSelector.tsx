/**
 * ThemeSelector - Dropdown for selecting app theme
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '@/contexts/AppStateContext';
import { THEMES, SYSTEM_THEME_OPTION, ThemePreference, THEME_VALUES } from '@/constants/themes';
import { Icon } from './Icon';

export function ThemeSelector() {
  const { themePreference, setThemePreference } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (theme: ThemePreference) => {
    setThemePreference(theme);
    setIsOpen(false);
  };

  // Get current display info
  const getCurrentIcon = () => {
    if (themePreference === 'system') {
      return SYSTEM_THEME_OPTION.icon;
    }
    return THEMES[themePreference].icon;
  };

  const getCurrentLabel = () => {
    if (themePreference === 'system') {
      return SYSTEM_THEME_OPTION.label;
    }
    return THEMES[themePreference].label;
  };

  return (
    <div className="theme-selector" ref={dropdownRef}>
      <button
        className="theme-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Theme: ${getCurrentLabel()}`}
        title={`Theme: ${getCurrentLabel()}`}
      >
        <Icon name={getCurrentIcon()} />
      </button>

      {isOpen && (
        <div className="theme-selector__dropdown" role="listbox">
          <div className="theme-selector__header">Theme</div>

          {/* System option */}
          <button
            className={`theme-selector__option ${themePreference === 'system' ? 'theme-selector__option--active' : ''}`}
            onClick={() => handleSelect('system')}
            role="option"
            aria-selected={themePreference === 'system'}
          >
            <Icon name={SYSTEM_THEME_OPTION.icon} />
            <div className="theme-selector__option-content">
              <span className="theme-selector__option-label">{SYSTEM_THEME_OPTION.label}</span>
              <span className="theme-selector__option-desc">{SYSTEM_THEME_OPTION.description}</span>
            </div>
            {themePreference === 'system' && (
              <Icon name="check" className="theme-selector__check" />
            )}
          </button>

          <div className="theme-selector__divider" />

          {/* Theme options */}
          {THEME_VALUES.map((theme) => (
            <button
              key={theme}
              className={`theme-selector__option ${themePreference === theme ? 'theme-selector__option--active' : ''}`}
              onClick={() => handleSelect(theme)}
              role="option"
              aria-selected={themePreference === theme}
            >
              <Icon name={THEMES[theme].icon} />
              <div className="theme-selector__option-content">
                <span className="theme-selector__option-label">{THEMES[theme].label}</span>
                <span className="theme-selector__option-desc">{THEMES[theme].description}</span>
              </div>
              {themePreference === theme && (
                <Icon name="check" className="theme-selector__check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
