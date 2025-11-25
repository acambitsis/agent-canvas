import { describe, it, expect, beforeEach } from 'vitest';
import yaml from 'js-yaml';
import { getAvailableTools } from '../../config.js';
import { getAgentMetrics, toArray, deepClone } from '../../state.js';

/**
 * Test #3: Form ↔ YAML Synchronization
 * 
 * Tests bidirectional sync between form fields and YAML editor:
 * - Form → YAML: buildAgentDraftFromForm() produces valid YAML
 * - YAML → Form: applyYamlToForm() populates all fields correctly
 * - Round-trip: Form → YAML → Form preserves all data
 */
describe('Form ↔ YAML Synchronization', () => {
  let form, agentForm;

  // Replicate functions from main.js for testing
  function buildAgentDraftFromForm(state, configData) {
    if (!form) return null;

    const groupIndex = parseInt(form.dataset.groupIndex || '0');
    const agentIndex = parseInt(form.dataset.agentIndex || '-1');
    const isNew = agentIndex === -1;
    const baseAgent = deepClone(state.agentModalOriginal || {});
    const group = configData?.agentGroups?.[groupIndex];

    const draft = { ...baseAgent };
    const existingAgentNumber = !isNew ? (baseAgent.agentNumber || group?.agents?.[agentIndex]?.agentNumber) : null;
    draft.agentNumber = existingAgentNumber || ((group?.agents?.length || 0) + 1);
    draft.name = document.getElementById('agentName').value;
    draft.objective = document.getElementById('agentObjective').value;
    draft.description = document.getElementById('agentDescription').value;
    draft.tools = Array.from(document.querySelectorAll('#agentTools input:checked')).map(cb => cb.value);

    // Parse journey steps from textarea (one per line)
    const journeyStepsText = document.getElementById('journeySteps').value;
    draft.journeySteps = journeyStepsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const metrics = { ...(baseAgent.metrics || {}), ...getAgentMetrics(baseAgent) };
    metrics.usageThisWeek = document.getElementById('metricsUsage').value;
    metrics.timeSaved = document.getElementById('metricsTimeSaved').value;
    draft.metrics = metrics;

    return draft;
  }

  function populateAgentFormFields(agent = {}) {
    document.getElementById('agentName').value = agent.name || '';
    document.getElementById('agentObjective').value = agent.objective || '';
    document.getElementById('agentDescription').value = agent.description || '';

    const toolsContainer = document.getElementById('agentTools');
    if (toolsContainer) {
      toolsContainer.innerHTML = '';
      const selectedTools = toArray(agent.tools);
      getAvailableTools().forEach(toolName => {
        const checked = selectedTools.includes(toolName) ? 'checked' : '';
        toolsContainer.innerHTML += `
          <label class="tool-checkbox-label">
            <input type="checkbox" name="tools" value="${toolName}" ${checked}>
            ${toolName}
          </label>
        `;
      });
    }

    // Populate journey steps textarea (one per line)
    const journeySteps = toArray(agent.journeySteps);
    document.getElementById('journeySteps').value = journeySteps.join('\n');

    const metrics = getAgentMetrics(agent);
    document.getElementById('metricsUsage').value = metrics.usageThisWeek || '';
    document.getElementById('metricsTimeSaved').value = metrics.timeSaved || '';
  }

  function applyYamlToForm(yamlText) {
    try {
      const parsed = yaml.load(yamlText) || {};
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Agent YAML must describe an object.');
      }
      populateAgentFormFields(parsed);
      return parsed;
    } catch (error) {
      throw error;
    }
  }

  beforeEach(() => {
    // Create form structure
    document.body.innerHTML = `
      <form id="agentForm" data-group-index="0" data-agent-index="-1">
        <input type="text" id="agentName" />
        <input type="text" id="agentObjective" />
        <textarea id="agentDescription"></textarea>
        <div id="agentTools"></div>
        <textarea id="journeySteps"></textarea>
        <input type="text" id="metricsUsage" />
        <input type="text" id="metricsTimeSaved" />
      </form>
    `;
    form = document.getElementById('agentForm');
    agentForm = form;
  });

  describe('Form → YAML (buildAgentDraftFromForm)', () => {
    it('should extract all form fields into agent object', () => {
      // Populate form
      document.getElementById('agentName').value = 'Test Agent';
      document.getElementById('agentObjective').value = 'Test objective';
      document.getElementById('agentDescription').value = 'Test description';
      document.getElementById('journeySteps').value = 'Step 1\nStep 2\nStep 3';
      document.getElementById('metricsUsage').value = '100';
      document.getElementById('metricsTimeSaved').value = '50%';

      // Create tool checkboxes
      const toolsContainer = document.getElementById('agentTools');
      ['Forms', 'Code'].forEach(toolName => {
        const label = document.createElement('label');
        label.className = 'tool-checkbox-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'tools';
        checkbox.value = toolName;
        checkbox.checked = true;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(toolName));
        toolsContainer.appendChild(label);
      });

      const state = { agentModalOriginal: {} };
      const configData = {
        agentGroups: [{
          agents: []
        }]
      };

      const draft = buildAgentDraftFromForm(state, configData);

      expect(draft).toBeTruthy();
      expect(draft.name).toBe('Test Agent');
      expect(draft.objective).toBe('Test objective');
      expect(draft.description).toBe('Test description');
      expect(draft.tools).toEqual(['Forms', 'Code']);
      expect(draft.journeySteps).toEqual(['Step 1', 'Step 2', 'Step 3']);
      expect(draft.metrics.usageThisWeek).toBe('100');
      expect(draft.metrics.timeSaved).toBe('50%');
    });

    it('should handle empty form fields', () => {
      const state = { agentModalOriginal: {} };
      const configData = {
        agentGroups: [{
          agents: []
        }]
      };

      const draft = buildAgentDraftFromForm(state, configData);

      expect(draft.name).toBe('');
      expect(draft.objective).toBe('');
      expect(draft.description).toBe('');
      expect(draft.tools).toEqual([]);
      expect(draft.journeySteps).toEqual([]);
    });

    it('should preserve existing agentNumber for edits', () => {
      form.dataset.agentIndex = '0';
      const state = {
        agentModalOriginal: { agentNumber: 5 }
      };
      const configData = {
        agentGroups: [{
          agents: [{ agentNumber: 5 }]
        }]
      };

      document.getElementById('agentName').value = 'Updated Agent';

      const draft = buildAgentDraftFromForm(state, configData);

      expect(draft.agentNumber).toBe(5);
    });
  });

  describe('YAML → Form (applyYamlToForm)', () => {
    it('should populate all form fields from YAML', () => {
      const yamlText = `
name: Test Agent
objective: Test objective
description: Test description
tools: [Forms, Code]
journeySteps:
  - Step 1
  - Step 2
  - Step 3
metrics:
  usageThisWeek: "100"
  timeSaved: "50%"
  roiContribution: High
      `.trim();

      const parsed = applyYamlToForm(yamlText);

      expect(document.getElementById('agentName').value).toBe('Test Agent');
      expect(document.getElementById('agentObjective').value).toBe('Test objective');
      expect(document.getElementById('agentDescription').value).toBe('Test description');
      expect(document.getElementById('journeySteps').value).toBe('Step 1\nStep 2\nStep 3');
      expect(document.getElementById('metricsUsage').value).toBe('100');
      expect(document.getElementById('metricsTimeSaved').value).toBe('50%');

      // Check tool checkboxes
      const checkedTools = Array.from(document.querySelectorAll('#agentTools input:checked'))
        .map(cb => cb.value);
      expect(checkedTools).toContain('Forms');
      expect(checkedTools).toContain('Code');
    });

    it('should handle invalid YAML gracefully', () => {
      const invalidYaml = 'invalid: yaml: syntax: error:';

      expect(() => {
        applyYamlToForm(invalidYaml);
      }).toThrow();
    });

    it('should reject YAML that is not an object', () => {
      const arrayYaml = '- item1\n- item2';
      const stringYaml = 'just a string';

      expect(() => {
        applyYamlToForm(arrayYaml);
      }).toThrow('Agent YAML must describe an object');

      expect(() => {
        applyYamlToForm(stringYaml);
      }).toThrow('Agent YAML must describe an object');
    });
  });

  describe('Round-trip: Form → YAML → Form', () => {
    it('should preserve all data through round-trip', () => {
      const originalAgent = {
        name: 'Round Trip Agent',
        objective: 'Test round trip',
        description: 'This should be preserved',
        tools: ['Forms', 'Code', 'RAG'],
        journeySteps: ['Step 1', 'Step 2', 'Step 3'],
        metrics: {
          usageThisWeek: '200',
          timeSaved: '75%',
          roiContribution: 'High'
        }
      };

      // Step 1: Populate form from agent object
      populateAgentFormFields(originalAgent);

      // Step 2: Extract from form
      const state = { agentModalOriginal: {} };
      const configData = {
        agentGroups: [{
          agents: []
        }]
      };
      const draft = buildAgentDraftFromForm(state, configData);

      // Step 3: Convert to YAML
      const yamlText = yaml.dump(draft);

      // Step 4: Parse YAML back
      const parsed = yaml.load(yamlText);

      // Step 5: Populate form again
      populateAgentFormFields(parsed);

      // Step 6: Extract again
      const finalDraft = buildAgentDraftFromForm({ agentModalOriginal: {} }, configData);

      // Verify all fields preserved
      expect(finalDraft.name).toBe(originalAgent.name);
      expect(finalDraft.objective).toBe(originalAgent.objective);
      expect(finalDraft.description).toBe(originalAgent.description);
      expect(finalDraft.tools).toEqual(originalAgent.tools);
      expect(finalDraft.journeySteps).toEqual(originalAgent.journeySteps);
      expect(finalDraft.metrics.usageThisWeek).toBe(originalAgent.metrics.usageThisWeek);
      expect(finalDraft.metrics.timeSaved).toBe(originalAgent.metrics.timeSaved);
    });

    it('should handle multiline descriptions correctly', () => {
      const agentWithMultiline = {
        name: 'Multiline Agent',
        description: 'Line 1\nLine 2\nLine 3'
      };

      populateAgentFormFields(agentWithMultiline);

      const state = { agentModalOriginal: {} };
      const configData = {
        agentGroups: [{
          agents: []
        }]
      };
      const draft = buildAgentDraftFromForm(state, configData);
      const yamlText = yaml.dump(draft);
      const parsed = yaml.load(yamlText);

      expect(parsed.description).toBe(agentWithMultiline.description);
    });

    it('should handle empty arrays and defaults', () => {
      const minimalAgent = {
        name: 'Minimal Agent'
      };

      populateAgentFormFields(minimalAgent);

      const state = { agentModalOriginal: {} };
      const configData = {
        agentGroups: [{
          agents: []
        }]
      };
      const draft = buildAgentDraftFromForm(state, configData);
      const yamlText = yaml.dump(draft);
      const parsed = yaml.load(yamlText);

      // Should have defaults
      expect(parsed.tools).toEqual([]);
      expect(parsed.journeySteps).toEqual([]);
      expect(parsed.metrics).toBeDefined();
      expect(parsed.metrics.roiContribution).toBe('Medium');
    });
  });
});

