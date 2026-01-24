import { describe, expect, it } from 'vitest';
import {
  prepareYamlImport,
  parseYaml,
  slugifyTitle,
  generateUniqueSlug,
  extractTitleFromYaml,
  exportToYaml,
} from '@/utils/yaml';
import { Agent } from '@/types/agent';
import { Id } from '../../convex/_generated/dataModel';

describe('YAML import', () => {
  it('parses YAML and converts agents to Convex format', () => {
    const yamlText = `
documentTitle: Example Canvas
agents:
  - name: Lead Qualifier
    phase: Sales
    agentOrder: 0
    objective: Qualify leads
    tools: [CRM]
    journeySteps: [Step 1]
    metrics:
      numberOfUsers: 10
      timeSaved: "5"
    category: Sales
    status: live
  - name: Triage Bot
    phase: Support
    agentOrder: 0
    tools: []
    journeySteps: []
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.title).toBe('Example Canvas');
    expect(result.agents).toHaveLength(2);
    expect(result.phases).toEqual(['Sales', 'Support']);
    expect(result.categories).toEqual(['Sales']);
    expect(result.agents[0]).toMatchObject({
      phase: 'Sales',
      agentOrder: 0,
      name: 'Lead Qualifier',
      objective: 'Qualify leads',
      tools: ['CRM'],
      journeySteps: ['Step 1'],
      metrics: { numberOfUsers: 10, timeSaved: 5 },
      category: 'Sales',
      status: 'live',
    });
    expect(result.agents[1]).toMatchObject({
      phase: 'Support',
      agentOrder: 0,
      name: 'Triage Bot',
    });
  });

  it('prepares import with unique slug generation', () => {
    const yamlText = `
documentTitle: Example Canvas
agents:
  - name: Lead Qualifier
    phase: Sales
    `.trim();

    const result = prepareYamlImport({
      yamlText,
      overrideTitle: 'Imported Title',
      existingSlugs: new Set(['imported-title']),
    });

    expect(result.title).toBe('Imported Title');
    expect(result.slug).toBe('imported-title-2');
    expect(result.agents).toHaveLength(1);
    expect(result.phases).toEqual(['Sales']);
  });

  it('returns complete structure for canvas creation', () => {
    const yamlText = `
documentTitle: Complete Canvas
agents:
  - name: Research Agent
    phase: Discovery
    agentOrder: 0
    category: Engineering
  - name: Build Agent
    phase: Development
    agentOrder: 0
    category: Engineering
  - name: Test Agent
    phase: Development
    agentOrder: 1
    category: QA
    `.trim();

    const result = prepareYamlImport({
      yamlText,
      existingSlugs: new Set(),
    });

    // Verify all fields needed by ImportYamlModal -> canvases.create
    expect(result).toHaveProperty('title', 'Complete Canvas');
    expect(result).toHaveProperty('slug', 'complete-canvas');
    expect(result).toHaveProperty('phases');
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('agents');

    // Phases in order of first appearance
    expect(result.phases).toEqual(['Discovery', 'Development']);

    // Categories extracted from agents (unique values)
    expect(result.categories).toEqual(['Engineering', 'QA']);

    // Agents have required fields
    expect(result.agents).toHaveLength(3);
    result.agents.forEach((agent) => {
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('phase');
      expect(agent).toHaveProperty('agentOrder');
      expect(agent).toHaveProperty('tools');
      expect(agent).toHaveProperty('journeySteps');
    });
  });

  it('handles YAML with no agents', () => {
    const yamlText = `
documentTitle: Empty
agents: []
    `.trim();

    const result = prepareYamlImport({
      yamlText,
      existingSlugs: new Set(),
    });

    expect(result.title).toBe('Empty');
    expect(result.agents).toHaveLength(0);
    expect(result.phases).toEqual(['Backlog']);
    expect(result.categories).toEqual(['Uncategorized']);
  });

  it('extracts title from YAML', () => {
    const yamlText = `
documentTitle: Test Canvas
agents: []
    `.trim();

    const title = extractTitleFromYaml(yamlText);
    expect(title).toBe('Test Canvas');
  });

  it('throws error for invalid YAML', () => {
    const yamlText = 'invalid: [ unclosed';
    expect(() => parseYaml(yamlText)).toThrow(/YAML parse error/);
  });

  it('throws error for agents without names', () => {
    const yamlText = `
documentTitle: Test
agents:
  - phase: Phase
    objective: Has objective but no name
    `.trim();

    expect(() => parseYaml(yamlText)).toThrow(/missing a name/);
  });

  it('defaults phase to Backlog when not specified', () => {
    const yamlText = `
documentTitle: Test
agents:
  - name: Agent without phase
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].phase).toBe('Backlog');
    expect(result.phases).toEqual(['Backlog']);
  });

  it('ignores invalid status values', () => {
    const yamlText = `
documentTitle: Test Canvas
agents:
  - name: Agent with invalid status
    phase: Phase
    status: invalid_status_value
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBeUndefined();
  });

  it('parses valid status values', () => {
    const yamlText = `
documentTitle: Test Canvas
agents:
  - name: Active Agent
    phase: Phase
    status: live
  - name: Draft Agent
    phase: Phase
    status: idea
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].status).toBe('live');
    expect(result.agents[1].status).toBe('idea');
  });

  it('defaults agentOrder to 0 when not specified', () => {
    const yamlText = `
documentTitle: Test Canvas
agents:
  - name: Agent without order
    phase: Phase
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agentOrder).toBe(0);
  });

  it('preserves explicit agentOrder values', () => {
    const yamlText = `
documentTitle: Test Canvas
agents:
  - name: Third Agent
    phase: Phase
    agentOrder: 2
  - name: First Agent
    phase: Phase
    agentOrder: 0
  - name: Second Agent
    phase: Phase
    agentOrder: 1
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(3);
    expect(result.agents[0].agentOrder).toBe(2);
    expect(result.agents[1].agentOrder).toBe(0);
    expect(result.agents[2].agentOrder).toBe(1);
  });
});

describe('slug utilities', () => {
  it('generates slugs correctly', () => {
    expect(slugifyTitle('My Canvas')).toBe('my-canvas');
    expect(slugifyTitle('Multiple   Spaces')).toBe('multiple-spaces');
    expect(slugifyTitle('Special!@#$%Characters')).toBe('special-characters');
  });

  it('generates unique slugs with suffix', () => {
    const existingSlugs = new Set(['my-canvas', 'my-canvas-2']);
    const slug = generateUniqueSlug('My Canvas', existingSlugs);
    expect(slug).toBe('my-canvas-3');
  });
});

describe('YAML export', () => {
  const mockAgent = (overrides: Partial<Agent> = {}): Agent => ({
    _id: 'test-id' as Id<"agents">,
    _creationTime: Date.now(),
    canvasId: 'canvas-id' as Id<"canvases">,
    phase: 'Phase 1',
    agentOrder: 0,
    name: 'Test Agent',
    tools: [],
    journeySteps: [],
    createdBy: 'user-id',
    updatedBy: 'user-id',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  it('exports agents to YAML format', () => {
    const agents: Agent[] = [
      mockAgent({
        name: 'Agent 1',
        phase: 'Discovery',
        agentOrder: 0,
        objective: 'First objective',
        tools: ['Tool A', 'Tool B'],
        journeySteps: ['Step 1', 'Step 2'],
        category: 'Sales',
        status: 'live',
      }),
      mockAgent({
        name: 'Agent 2',
        phase: 'Discovery',
        agentOrder: 1,
      }),
    ];

    const yaml = exportToYaml('Test Canvas', agents);

    expect(yaml).toContain('documentTitle: Test Canvas');
    expect(yaml).toContain('phase: Discovery');
    expect(yaml).toContain('name: Agent 1');
    expect(yaml).toContain('objective: First objective');
    expect(yaml).toContain('- Tool A');
    expect(yaml).toContain('category: Sales');
    expect(yaml).toContain('status: live');
    expect(yaml).toContain('name: Agent 2');
  });

  it('exports metrics correctly', () => {
    const agents: Agent[] = [
      mockAgent({
        metrics: {
          numberOfUsers: 100,
          timesUsed: 50,
          timeSaved: 10,
          roi: 5000,
        },
      }),
    ];

    const yaml = exportToYaml('Metrics Test', agents);

    expect(yaml).toContain('numberOfUsers: 100');
    expect(yaml).toContain('timesUsed: 50');
    expect(yaml).toContain('timeSaved: 10');
    expect(yaml).toContain('roi: 5000');
  });

  it('omits empty optional fields', () => {
    const agents: Agent[] = [mockAgent({ name: 'Minimal Agent' })];

    const yaml = exportToYaml('Minimal', agents);

    expect(yaml).toContain('name: Minimal Agent');
    expect(yaml).not.toContain('objective:');
    expect(yaml).not.toContain('description:');
    expect(yaml).not.toContain('metrics:');
    expect(yaml).not.toContain('category:');
  });

  it('maintains phase ordering using canvas phaseOrder', () => {
    const agents: Agent[] = [
      mockAgent({ name: 'Third', phase: 'Phase C', agentOrder: 0 }),
      mockAgent({ name: 'First', phase: 'Phase A', agentOrder: 0 }),
      mockAgent({ name: 'Second', phase: 'Phase B', agentOrder: 0 }),
    ];

    // Export with canvas-level phase ordering
    const yaml = exportToYaml('Ordered', agents, ['Phase A', 'Phase B', 'Phase C']);

    const phaseAIndex = yaml.indexOf('Phase A');
    const phaseBIndex = yaml.indexOf('Phase B');
    const phaseCIndex = yaml.indexOf('Phase C');

    expect(phaseAIndex).toBeLessThan(phaseBIndex);
    expect(phaseBIndex).toBeLessThan(phaseCIndex);
  });

  it('maintains agent ordering within phases', () => {
    const agents: Agent[] = [
      mockAgent({ name: 'Second', phase: 'Phase', agentOrder: 1 }),
      mockAgent({ name: 'First', phase: 'Phase', agentOrder: 0 }),
      mockAgent({ name: 'Third', phase: 'Phase', agentOrder: 2 }),
    ];

    const yaml = exportToYaml('Ordered', agents);

    const firstIndex = yaml.indexOf('name: First');
    const secondIndex = yaml.indexOf('name: Second');
    const thirdIndex = yaml.indexOf('name: Third');

    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });

  it('handles empty agents array', () => {
    const yaml = exportToYaml('Empty Canvas', []);

    expect(yaml).toContain('documentTitle: Empty Canvas');
    expect(yaml).toContain('agents: []');
  });

  it('throws error for invalid title', () => {
    expect(() => exportToYaml('', [])).toThrow(/title is required/);
    expect(() => exportToYaml('a'.repeat(201), [])).toThrow(/200 characters or less/);
  });
});

describe('YAML round-trip', () => {
  it('import then export produces equivalent structure', () => {
    const originalYaml = `
documentTitle: Round Trip Test
agents:
  - name: Agent Alpha
    phase: Phase One
    agentOrder: 0
    objective: Do something
    description: Description here
    tools:
      - Tool 1
      - Tool 2
    journeySteps:
      - Step A
      - Step B
    demoLink: https://example.com/demo
    videoLink: https://example.com/video
    metrics:
      numberOfUsers: 42
      timesUsed: 100
      timeSaved: 5
      roi: 1000
    category: Engineering
    status: live
  - name: Agent Beta
    phase: Phase Two
    agentOrder: 0
    tools: []
    journeySteps: []
    `.trim();

    // Import
    const imported = parseYaml(originalYaml);

    // Convert to Agent[] format (simulate what would be stored)
    const agents: Agent[] = imported.agents.map((a, i) => ({
      _id: `id-${i}` as Id<"agents">,
      _creationTime: Date.now(),
      canvasId: 'canvas-id' as Id<"canvases">,
      ...a,
      createdBy: 'user',
      updatedBy: 'user',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    // Export using imported phases for ordering
    const exported = exportToYaml(imported.title, agents, imported.phases);

    // Re-import
    const reimported = parseYaml(exported);

    // Verify structure matches
    expect(reimported.title).toBe(imported.title);
    expect(reimported.agents).toHaveLength(imported.agents.length);
    expect(reimported.phases).toEqual(imported.phases);

    for (let i = 0; i < imported.agents.length; i++) {
      expect(reimported.agents[i].name).toBe(imported.agents[i].name);
      expect(reimported.agents[i].phase).toBe(imported.agents[i].phase);
      expect(reimported.agents[i].agentOrder).toBe(imported.agents[i].agentOrder);
      expect(reimported.agents[i].objective).toBe(imported.agents[i].objective);
      expect(reimported.agents[i].description).toBe(imported.agents[i].description);
      expect(reimported.agents[i].tools).toEqual(imported.agents[i].tools);
      expect(reimported.agents[i].journeySteps).toEqual(imported.agents[i].journeySteps);
      expect(reimported.agents[i].demoLink).toBe(imported.agents[i].demoLink);
      expect(reimported.agents[i].videoLink).toBe(imported.agents[i].videoLink);
      expect(reimported.agents[i].metrics).toEqual(imported.agents[i].metrics);
      expect(reimported.agents[i].category).toBe(imported.agents[i].category);
      expect(reimported.agents[i].status).toBe(imported.agents[i].status);
    }
  });
});
