/**
 * AgentModal - Form for creating/editing agents
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Agent, AgentFormData } from '@/types/agent';
import { Modal } from '../ui/Modal';
import { useAgents } from '@/contexts/AgentContext';
import { useAppState } from '@/contexts/AppStateContext';
import { validateAgentForm } from '@/utils/validation';
import { getAvailableTools, getToolDisplay } from '@/utils/config';
import { useLucideIcons } from '@/hooks/useLucideIcons';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
  defaultPhase?: string;
}

export function AgentModal({ isOpen, onClose, agent, defaultPhase }: AgentModalProps) {
  const { createAgent, updateAgent } = useAgents();
  const { showLoading, hideLoading, showToast } = useAppState();

  // Initialize Lucide icons
  useLucideIcons();

  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    objective: '',
    description: '',
    tools: [],
    journeySteps: [],
    demoLink: '',
    videoLink: '',
    metrics: { adoption: 0, satisfaction: 0 },
    roiContribution: 'Medium',
    department: '',
    status: 'draft',
    phase: defaultPhase || 'Uncategorized',
    phaseOrder: 0,
    agentOrder: 0,
  });

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
        metrics: agent.metrics || { adoption: 0, satisfaction: 0 },
        roiContribution: agent.roiContribution || 'Medium',
        department: agent.department || '',
        status: agent.status || 'draft',
        phase: agent.phase,
        phaseOrder: agent.phaseOrder,
        agentOrder: agent.agentOrder,
      });
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
        metrics: { adoption: 0, satisfaction: 0 },
        roiContribution: 'Medium',
        department: '',
        status: 'draft',
        phase: defaultPhase || 'Uncategorized',
        phaseOrder: 0,
        agentOrder: 0,
      });
    }
  }, [agent, defaultPhase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateAgentForm(formData);
    if (errors.length > 0) {
      showToast(errors[0].message, 'error');
      return;
    }

    try {
      showLoading(agent ? 'Updating agent...' : 'Creating agent...');

      if (agent) {
        await updateAgent(agent._id, formData);
        showToast('Agent updated successfully', 'success');
      } else {
        await createAgent(formData);
        showToast('Agent created successfully', 'success');
      }

      onClose();
    } catch (error) {
      console.error('Save agent error:', error);
      showToast('Failed to save agent', 'error');
    } finally {
      hideLoading();
    }
  };

  const handleToolToggle = (tool: string) => {
    setFormData((prev) => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter((t) => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  const availableTools = getAvailableTools();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={agent ? 'Edit Agent' : 'New Agent'} size="large">
      <form onSubmit={handleSubmit} className="agent-form">
        <div className="form-group">
          <label htmlFor="agent-name" className="form-label">
            Agent Name <span className="required">*</span>
          </label>
          <input
            id="agent-name"
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="agent-phase" className="form-label">
            Phase <span className="required">*</span>
          </label>
          <input
            id="agent-phase"
            type="text"
            className="form-input"
            value={formData.phase}
            onChange={(e) => setFormData((prev) => ({ ...prev, phase: e.target.value }))}
            required
          />
        </div>

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
          />
        </div>

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
                    <i data-lucide="check"></i>
                  </div>
                  <i data-lucide={toolDisplay.icon} style={{ color: toolDisplay.color }}></i>
                  <span>{toolDisplay.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="agent-department" className="form-label">
            Department
          </label>
          <select
            id="agent-department"
            className="form-select"
            value={formData.department}
            onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
          >
            <option value="">None</option>
            <option value="sales">Sales</option>
            <option value="engineering">Engineering</option>
            <option value="marketing">Marketing</option>
            <option value="operations">Operations</option>
            <option value="support">Support</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="agent-status" className="form-label">
            Status
          </label>
          <select
            id="agent-status"
            className="form-select"
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="review">In Review</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

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
