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
agentGroups:
  - groupName: Sales
    agents:
      - name: Lead Qualifier
        objective: Qualify leads
        tools: [CRM]
        journeySteps: [Step 1]
        metrics:
          numberOfUsers: 10
          timeSaved: "5"
        tags:
          department: Sales
          status: deployed
  - groupName: Support
    agents:
      - name: Triage Bot
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
      status: 'deployed',
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
agentGroups:
  - groupName: Sales
    agents:
      - name: Lead Qualifier
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

  it('handles YAML with no agents', () => {
    const yamlText = `
documentTitle: Empty
agentGroups: []
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
agentGroups: []
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
agentGroups:
  - groupName: Phase
    agents:
      - objective: Has objective but no name
    `.trim();

    expect(() => parseYaml(yamlText)).toThrow(/missing a name/);
  });

  it('ignores invalid status values', () => {
    const yamlText = `
documentTitle: Test Canvas
agentGroups:
  - groupName: Phase
    agents:
      - name: Agent with invalid status
        tags:
          status: invalid_status_value
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBeUndefined();
  });

  it('parses valid status values', () => {
    const yamlText = `
documentTitle: Test Canvas
agentGroups:
  - groupName: Phase
    agents:
      - name: Active Agent
        tags:
          status: deployed
      - name: Draft Agent
        tags:
          status: in_concept
    `.trim();

    const result = parseYaml(yamlText);

    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].status).toBe('deployed');
    expect(result.agents[1].status).toBe('in_concept');
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
        status: 'deployed',
      }),
      mockAgent({
        name: 'Agent 2',
        phase: 'Discovery',
        agentOrder: 1,
      }),
    ];

    const yaml = exportToYaml('Test Canvas', agents);

    expect(yaml).toContain('documentTitle: Test Canvas');
    expect(yaml).toContain('groupName: Discovery');
    expect(yaml).toContain('name: Agent 1');
    expect(yaml).toContain('objective: First objective');
    expect(yaml).toContain('- Tool A');
    expect(yaml).toContain('department: Sales');
    expect(yaml).toContain('status: deployed');
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
    expect(yaml).not.toContain('tags:');
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
    expect(yaml).toContain('agentGroups: []');
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
agentGroups:
  - groupName: Phase One
    agents:
      - name: Agent Alpha
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
        tags:
          department: Engineering
          status: deployed
  - groupName: Phase Two
    agents:
      - name: Agent Beta
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
