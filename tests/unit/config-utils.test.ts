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
    it('returns correct color for live status', () => {
      expect(getStatusColor('live')).toBe(AGENT_STATUS_CONFIG.live.color);
    });

    it('returns correct color for idea status', () => {
      expect(getStatusColor('idea')).toBe(AGENT_STATUS_CONFIG.idea.color);
    });

    it('returns correct color for shelved status', () => {
      expect(getStatusColor('shelved')).toBe(AGENT_STATUS_CONFIG.shelved.color);
    });

    it('returns default color for unknown status', () => {
      expect(getStatusColor('unknown')).toBe(getAgentStatusConfig('unknown').color);
    });

    it('returns default color for undefined status', () => {
      expect(getStatusColor(undefined)).toBe(getAgentStatusConfig(undefined).color);
    });
  });

  describe('getStatusConfig', () => {
    it('returns full config for live status', () => {
      const config = getStatusConfig('live');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.live.color);
      expect(config.bgColor).toBe(AGENT_STATUS_CONFIG.live.bgColor);
      expect(config.label).toBe('Live');
    });

    it('returns full config for idea status', () => {
      const config = getStatusConfig('idea');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.idea.color);
      expect(config.label).toBe('Idea');
    });

    it('returns full config for shelved status', () => {
      const config = getStatusConfig('shelved');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.shelved.color);
      expect(config.label).toBe('Shelved');
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

    it('maps legacy "deployed" status to "Live" config', () => {
      const config = getStatusConfig('deployed');
      expect(config.label).toBe('Live');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.live.color);
    });

    it('maps legacy "in_concept" status to "Idea" config', () => {
      const config = getStatusConfig('in_concept');
      expect(config.label).toBe('Idea');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.idea.color);
    });

    it('maps legacy "in_development" status to "WIP" config', () => {
      const config = getStatusConfig('in_development');
      expect(config.label).toBe('WIP');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.wip.color);
    });

    it('maps legacy "in_testing" status to "Testing" config', () => {
      const config = getStatusConfig('in_testing');
      expect(config.label).toBe('Testing');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.testing.color);
    });

    it('maps legacy "abandoned" status to "Shelved" config', () => {
      const config = getStatusConfig('abandoned');
      expect(config.label).toBe('Shelved');
      expect(config.color).toBe(AGENT_STATUS_CONFIG.shelved.color);
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
