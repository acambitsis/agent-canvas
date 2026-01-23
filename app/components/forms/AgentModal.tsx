/**
 * AgentModal - Form for creating/editing agents
 */

'use client';

import React, { useState, useEffect, useId } from 'react';
import { Agent, AgentFormData, AgentMetrics } from '@/types/agent';
import { Modal } from '../ui/Modal';
import { useAgents } from '@/contexts/AgentContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { useQuery } from '@/hooks/useConvex';
import { validateAgentForm } from '@/utils/validation';
import { getAvailableTools, getToolDisplay, DEFAULT_PHASE } from '@/utils/config';
import { AGENT_STATUS, AGENT_STATUS_OPTIONS, AgentStatus } from '@/types/validationConstants';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { api } from '../../../convex/_generated/api';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
  defaultPhase?: string;
}

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

function FormSection({ title, children, defaultCollapsed = false }: FormSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`form-section ${isCollapsed ? 'is-collapsed' : ''}`}>
      <button
        type="button"
        className="form-section__header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>{title}</span>
        <Icon name="chevron-down" />
      </button>
      <div className="form-section__content">{children}</div>
    </div>
  );
}

export function AgentModal({ isOpen, onClose, agent, defaultPhase }: AgentModalProps) {
  const { createAgent, updateAgent } = useAgents();
  const { showToast } = useAppState();
  const { currentOrgId, isAuthenticated } = useAuth();
  const executeOperation = useAsyncOperation();

  // Get existing categories from org for autocomplete
  // Must check isAuthenticated to avoid race condition on page refresh
  // (currentOrgId loads from localStorage before auth is initialized)
  const existingCategories = useQuery(
    api.agents.getDistinctCategories,
    isAuthenticated && currentOrgId ? { workosOrgId: currentOrgId } : 'skip'
  ) || [];
  const categoryDatalistId = useId();

  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    objective: '',
    description: '',
    tools: [],
    journeySteps: [],
    demoLink: '',
    videoLink: '',
    metrics: {},
    category: '',
    status: AGENT_STATUS.IDEA,
    phase: defaultPhase || DEFAULT_PHASE,
    agentOrder: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newJourneyStep, setNewJourneyStep] = useState('');

  // Load agent data when editing
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        objective: agent.objective || '',
        description: agent.description || '',
        tools: agent.tools || [],
        journeySteps: agent.journeySteps || [],
        demoLink: agent.demoLink || '',
        videoLink: agent.videoLink || '',
        metrics: agent.metrics || {},
        category: agent.category || '',
        status: agent.status || AGENT_STATUS.IDEA,
        phase: agent.phase,
        agentOrder: agent.agentOrder,
      });
      setErrors({});
    } else {
      // Reset form for new agent
      setFormData({
        name: '',
        objective: '',
        description: '',
        tools: [],
        journeySteps: [],
        demoLink: '',
        videoLink: '',
        metrics: {},
        category: '',
        status: AGENT_STATUS.IDEA,
        phase: defaultPhase || DEFAULT_PHASE,
        agentOrder: 0,
      });
      setErrors({});
    }
    setNewJourneyStep('');
  }, [agent, defaultPhase]);

  const validateField = (field: string, value: string) => {
    const testData = { ...formData, [field]: value };
    const validationErrors = validateAgentForm(testData);
    const fieldError = validationErrors.find((e) => e.field === field);

    setErrors((prev) => {
      if (fieldError) {
        return { ...prev, [field]: fieldError.message };
      }
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateAgentForm(formData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach((err) => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    await executeOperation(
      async () => {
        if (agent) {
          await updateAgent(agent._id, formData);
        } else {
          await createAgent(formData);
        }
      },
      {
        loadingMessage: agent ? 'Updating agent...' : 'Creating agent...',
        successMessage: agent ? 'Agent updated successfully' : 'Agent created successfully',
        errorMessage: 'Failed to save agent',
        onSuccess: onClose,
      }
    );
  };

  const handleToolToggle = (tool: string) => {
    setFormData((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter((t) => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  const handleAddJourneyStep = () => {
    if (newJourneyStep.trim()) {
      setFormData((prev) => ({
        ...prev,
        journeySteps: [...prev.journeySteps, newJourneyStep.trim()],
      }));
      setNewJourneyStep('');
    }
  };

  const handleRemoveJourneyStep = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      journeySteps: prev.journeySteps.filter((_, i) => i !== index),
    }));
  };

  const handleMetricChange = (key: keyof AgentMetrics, value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    setFormData((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [key]: numValue,
      },
    }));
  };

  const availableTools = getAvailableTools();

  const getInputClassName = (field: string, baseClass: string = 'form-input') => {
    return errors[field] ? `${baseClass} ${baseClass}--error` : baseClass;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={agent ? 'Edit Agent' : 'New Agent'} size="large">
      <form onSubmit={handleSubmit} className="agent-form">
        {/* Basic Info Section */}
        <FormSection title="Basic Info">
          <div className="form-group">
            <label htmlFor="agent-name" className="form-label">
              Agent Name <span className="required">*</span>
            </label>
            <input
              id="agent-name"
              type="text"
              className={getInputClassName('name')}
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              onBlur={(e) => validateField('name', e.target.value)}
              required
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="agent-phase" className="form-label">
                Implementation Phase <span className="required">*</span>
              </label>
              <input
                id="agent-phase"
                type="text"
                className={getInputClassName('phase')}
                value={formData.phase}
                onChange={(e) => setFormData((prev) => ({ ...prev, phase: e.target.value }))}
                onBlur={(e) => validateField('phase', e.target.value)}
                placeholder="e.g., Phase 1, Q2 2025, Backlog"
                required
              />
              {errors.phase && <div className="form-error">{errors.phase}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="agent-category" className="form-label">
                Category
              </label>
              <input
                id="agent-category"
                type="text"
                className="form-input"
                list={categoryDatalistId}
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                onBlur={(e) => {
                  // Normalize: trim whitespace
                  const trimmed = e.target.value.trim();
                  if (trimmed !== e.target.value) {
                    setFormData((prev) => ({ ...prev, category: trimmed }));
                  }
                }}
                placeholder="e.g., Recruitment, Onboarding, Benefits"
              />
              <datalist id={categoryDatalistId}>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="agent-status" className="form-label">
              Status
            </label>
            <select
              id="agent-status"
              className="form-select"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as AgentStatus }))}
            >
              {AGENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </FormSection>

        {/* Details Section */}
        <FormSection title="Details">
          <div className="form-group">
            <label htmlFor="agent-objective" className="form-label">
              Objective
            </label>
            <textarea
              id="agent-objective"
              className="form-textarea"
              value={formData.objective}
              onChange={(e) => setFormData((prev) => ({ ...prev, objective: e.target.value }))}
              rows={2}
              placeholder="What does this agent aim to achieve?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="agent-description" className="form-label">
              Description
            </label>
            <textarea
              id="agent-description"
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Detailed description of the agent's functionality..."
            />
          </div>
        </FormSection>

        {/* Capabilities Section */}
        <FormSection title="Capabilities">
          <div className="form-group">
            <label className="form-label">Tools</label>
            <div className="checkbox-grid">
              {availableTools.map((tool) => {
                const toolDisplay = getToolDisplay(tool);
                return (
                  <label
                    key={tool}
                    className={`checkbox-item ${formData.tools.includes(tool) ? 'is-checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.tools.includes(tool)}
                      onChange={() => handleToolToggle(tool)}
                    />
                    <div className="checkbox-item__check">
                      <Icon name="check" />
                    </div>
                    <Icon name={toolDisplay.icon} style={{ color: toolDisplay.color }} />
                    <span>{toolDisplay.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </FormSection>

        {/* Journey Section */}
        <FormSection title="Journey Steps">
          <div className="journey-editor">
            <div className="journey-editor__input">
              <input
                type="text"
                className="form-input"
                value={newJourneyStep}
                onChange={(e) => setNewJourneyStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddJourneyStep();
                  }
                }}
                placeholder="Add a journey step..."
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleAddJourneyStep}
                disabled={!newJourneyStep.trim()}
              >
                <Icon name="plus" />
                Add
              </button>
            </div>

            {formData.journeySteps.length === 0 ? (
              <div className="journey-editor__empty">
                No journey steps defined. Add steps to describe the agent's workflow.
              </div>
            ) : (
              <div className="journey-editor__list">
                {formData.journeySteps.map((step, index) => (
                  <div key={index} className="journey-editor__item">
                    <div className="journey-editor__item-number">{index + 1}</div>
                    <div className="journey-editor__item-text">{step}</div>
                    <Tooltip content="Remove step" placement="left">
                      <button
                        type="button"
                        className="journey-editor__item-remove"
                        onClick={() => handleRemoveJourneyStep(index)}
                      >
                        <Icon name="x" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        {/* Links Section */}
        <FormSection title="Links">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="agent-demoLink" className="form-label">
                Demo Link
              </label>
              <input
                id="agent-demoLink"
                type="url"
                className={getInputClassName('demoLink')}
                value={formData.demoLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, demoLink: e.target.value }))}
                onBlur={(e) => e.target.value && validateField('demoLink', e.target.value)}
                placeholder="https://example.com/demo"
              />
              {errors.demoLink && <div className="form-error">{errors.demoLink}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="agent-videoLink" className="form-label">
                Video Link
              </label>
              <input
                id="agent-videoLink"
                type="url"
                className={getInputClassName('videoLink')}
                value={formData.videoLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, videoLink: e.target.value }))}
                onBlur={(e) => e.target.value && validateField('videoLink', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
              {errors.videoLink && <div className="form-error">{errors.videoLink}</div>}
            </div>
          </div>
        </FormSection>

        {/* Metrics Section - Collapsed by default */}
        <FormSection title="Metrics" defaultCollapsed={true}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="agent-numberOfUsers" className="form-label">
                Number of Users
              </label>
              <input
                id="agent-numberOfUsers"
                type="number"
                className="form-input"
                value={formData.metrics?.numberOfUsers ?? ''}
                onChange={(e) => handleMetricChange('numberOfUsers', e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="agent-timesUsed" className="form-label">
                Times Used
              </label>
              <input
                id="agent-timesUsed"
                type="number"
                className="form-input"
                value={formData.metrics?.timesUsed ?? ''}
                onChange={(e) => handleMetricChange('timesUsed', e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="agent-timeSaved" className="form-label">
                Time Saved (hours)
              </label>
              <input
                id="agent-timeSaved"
                type="number"
                className="form-input"
                value={formData.metrics?.timeSaved ?? ''}
                onChange={(e) => handleMetricChange('timeSaved', e.target.value)}
                min="0"
                step="0.5"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="agent-roi" className="form-label">
                ROI ($)
              </label>
              <input
                id="agent-roi"
                type="number"
                className="form-input"
                value={formData.metrics?.roi ?? ''}
                onChange={(e) => handleMetricChange('roi', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </FormSection>

        <div className="form-actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {agent ? 'Update' : 'Create'} Agent
          </button>
        </div>
      </form>
    </Modal>
  );
}
