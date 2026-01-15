import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Convex client helpers used by legacy importer
vi.mock('../../client/convex-client.js', () => {
  return {
    createCanvas: vi.fn(async () => 'canvas_123'),
    bulkCreateAgents: vi.fn(async () => []),
  };
});

import { createCanvas, bulkCreateAgents } from '../../client/convex-client.js';
import { importLegacyYamlToNative } from '../../client/legacy-yaml-import.js';

describe('Legacy YAML importer (one-way)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a canvas and bulk-creates agents (no YAML stored)', async () => {
    const yamlText = `
documentTitle: Example Canvas
agentGroups:
  - groupName: Sales
    agents:
      - name: Lead Qualifier
        tools: [CRM]
        journeySteps: [Step 1]
        metrics:
          usageThisWeek: "10"
          timeSaved: "5"
  - groupName: Support
    agents:
      - name: Triage Bot
        tools: []
        journeySteps: []
    `.trim();

    const result = await importLegacyYamlToNative({
      workosOrgId: 'org_1',
      yamlText,
      overrideTitle: 'Imported Title',
      existingSlugs: new Set(['imported-title']),
    });

    expect(createCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        workosOrgId: 'org_1',
        title: 'Imported Title',
        slug: 'imported-title-2',
      })
    );

    expect(bulkCreateAgents).toHaveBeenCalledWith(
      'canvas_123',
      expect.arrayContaining([
        expect.objectContaining({
          phase: 'Sales',
          name: 'Lead Qualifier',
          tools: ['CRM'],
          metrics: { adoption: 10, satisfaction: 5 },
        }),
      ])
    );

    expect(result).toEqual({ canvasId: 'canvas_123', title: 'Imported Title', agentCount: 2 });
  });

  it('does not call bulkCreateAgents when YAML has no agents', async () => {
    const yamlText = `
documentTitle: Empty
agentGroups: []
    `.trim();

    await importLegacyYamlToNative({
      workosOrgId: 'org_1',
      yamlText,
      overrideTitle: 'Empty Canvas',
      existingSlugs: new Set(),
    });

    expect(createCanvas).toHaveBeenCalled();
    expect(bulkCreateAgents).not.toHaveBeenCalled();
  });
});

