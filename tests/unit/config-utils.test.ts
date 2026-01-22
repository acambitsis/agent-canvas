import { describe, it, expect } from 'vitest';
import {
  getToolDisplay,
  getSectionColor,
  getStatusColor,
  getStatusConfig,
  getToolColorClass,
  TOOL_DEFINITIONS,
  SECTION_COLOR_PALETTE,
} from '@/utils/config';
import { AGENT_STATUS_CONFIG, getAgentStatusConfig } from '@/types/validationConstants';

describe('Config Utilities', () => {
  describe('getToolDisplay', () => {
    it('returns correct display info for known tools', () => {
      const result = getToolDisplay('forms');
      expect(result).toEqual({
        label: 'Forms',
        color: '#06B6D4',
        icon: 'file-input',
      });
    });

    it('normalizes tool names with spaces', () => {
      const result = getToolDisplay('Web Search');
      expect(result.label).toBe('Web Search');
      expect(result.color).toBe('#10B981');
    });

    it('returns default for unknown tools', () => {
      const result = getToolDisplay('unknown-tool');
      expect(result).toEqual({
        label: 'unknown-tool',
        color: '#6B7280',
        icon: 'box',
      });
    });

    it('handles case insensitivity', () => {
      const result = getToolDisplay('EMAIL');
      expect(result.label).toBe('Email');
    });
  });

  describe('getSectionColor', () => {
    it('returns colors from palette in order', () => {
      expect(getSectionColor(0)).toBe(SECTION_COLOR_PALETTE[0]);
      expect(getSectionColor(1)).toBe(SECTION_COLOR_PALETTE[1]);
    });

    it('cycles through palette for large indices', () => {
      const paletteLength = SECTION_COLOR_PALETTE.length;
      expect(getSectionColor(paletteLength)).toBe(SECTION_COLOR_PALETTE[0]);
      expect(getSectionColor(paletteLength + 1)).toBe(SECTION_COLOR_PALETTE[1]);
    });
  });

  describe('getStatusColor', () => {
    it('returns correct color for active status', () => {
      expect(getStatusColor('active')).toBe(AGENT_STATUS_CONFIG.active.color);
    });

    it('returns correct color for draft status', () => {
      expect(getStatusColor('draft')).toBe(AGENT_STATUS_CONFIG.draft.color);
    });

    it('returns correct color for deprecated status', () => {
      expect(getStatusColor('deprecated')).toBe(AGENT_STATUS_CONFIG.deprecated.color);
    });

    it('returns default color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe(getAgentStatusConfig('unknown').color);
    });

    it('returns default color for undefined status', () => {
      expect(getStatusColor(undefined)).toBe(getAgentStatusConfig(undefined).color);
    });
  });

  describe('getStatusConfig', () => {
    it('returns full config for active status', () => {
      const config = getStatusConfig('active');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.active.color);
      expect(config.bgColor).toBe(AGENT_STATUS_CONFIG.active.bgColor);
      expect(config.label).toBe('Active');
    });

    it('returns full config for draft status', () => {
      const config = getStatusConfig('draft');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.draft.color);
      expect(config.label).toBe('Draft');
    });

    it('returns full config for deprecated status', () => {
      const config = getStatusConfig('deprecated');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.deprecated.color);
      expect(config.label).toBe('Deprecated');
    });

    it('returns default config with custom label for unknown status', () => {
      const config = getStatusConfig('custom-status');
      expect(config.color).toBe(getAgentStatusConfig('custom-status').color);
      expect(config.label).toBe('custom-status');
    });

    it('returns Unknown label for undefined status', () => {
      const config = getStatusConfig(undefined);
      expect(config.label).toBe('Unknown');
    });
  });

  describe('getToolColorClass', () => {
    it('returns correct class for cyan color', () => {
      expect(getToolColorClass('#06B6D4')).toBe('cyan');
    });

    it('returns correct class for blue color', () => {
      expect(getToolColorClass('#3B82F6')).toBe('blue');
    });

    it('returns correct class for violet color', () => {
      expect(getToolColorClass('#8B5CF6')).toBe('violet');
    });

    it('returns correct class for emerald color', () => {
      expect(getToolColorClass('#10B981')).toBe('emerald');
    });

    it('returns default for unknown colors', () => {
      expect(getToolColorClass('#000000')).toBe('default');
      expect(getToolColorClass('invalid')).toBe('default');
    });

    it('maps all defined tool colors', () => {
      // Verify each tool's color has a corresponding class
      Object.values(TOOL_DEFINITIONS).forEach((tool) => {
        const colorClass = getToolColorClass(tool.color);
        // Should either be a named class or default
        expect(typeof colorClass).toBe('string');
        expect(colorClass.length).toBeGreaterThan(0);
      });
    });
  });
});
