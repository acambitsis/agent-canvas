/**
 * DockView - Flat dock display with carousel for agent details
 *
 * Shows agents as compact icons in a row. Click an agent or use
 * carousel controls to view expanded details one at a time.
 */

'use client';

import { useState, useEffect } from 'react';
import { Agent } from '@/types/agent';
import { getToolDisplay } from '@/utils/config';
import { getAgentStatusConfig } from '@/types/validationConstants';
import { Icon } from '@/components/ui/Icon';

interface DockViewProps {
  agents: Agent[];
  onAgentClick: (agent: Agent) => void;
}

export function DockView({ agents, onAgentClick }: DockViewProps) {
  // Track by agent ID for stability with real-time updates
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Derive index and agent from ID
  const selectedIndex = selectedAgentId
    ? agents.findIndex(a => a._id === selectedAgentId)
    : -1;
  const selectedAgent = selectedIndex >= 0 ? agents[selectedIndex] : null;

  // Reset selection if agent no longer exists (e.g., deleted by another user)
  useEffect(() => {
    if (selectedAgentId && !agents.some(a => a._id === selectedAgentId)) {
      setSelectedAgentId(null);
    }
  }, [agents, selectedAgentId]);

  const handlePrev = () => {
    if (selectedIndex < 0) return;
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : agents.length - 1;
    setSelectedAgentId(agents[newIndex]._id);
  };

  const handleNext = () => {
    if (selectedIndex < 0) return;
    const newIndex = selectedIndex < agents.length - 1 ? selectedIndex + 1 : 0;
    setSelectedAgentId(agents[newIndex]._id);
  };

  const handleItemClick = (agent: Agent) => {
    setSelectedAgentId(selectedAgentId === agent._id ? null : agent._id);
  };

  const handleClose = () => {
    setSelectedAgentId(null);
  };

  return (
    <div className="dock-view">
      {/* Flat dock - all agents as compact icons */}
      <div className="dock-view__track">
        {agents.map((agent, index) => {
          const statusConfig = getAgentStatusConfig(agent.status);
          const isSelected = selectedAgentId === agent._id;

          return (
            <button
              key={agent._id}
              className={`dock-item ${isSelected ? 'dock-item--selected' : ''}`}
              onClick={() => handleItemClick(agent)}
            >
              <span className="dock-item__order">
                {(agent.agentOrder ?? index) + 1}
              </span>
              <span
                className="dock-item__status-dot"
                style={{ backgroundColor: statusConfig.color }}
              />
              <div className="dock-item__icon">
                <Icon name="bot" />
              </div>
              <span className="dock-item__compact-name">
                {agent.name.length > 18
                  ? agent.name.substring(0, 17) + '…'
                  : agent.name}
              </span>
              <div className="dock-item__tools-compact">
                {agent.tools.slice(0, 3).map((tool: string) => {
                  const toolDisplay = getToolDisplay(tool);
                  return (
                    <span
                      key={tool}
                      className="tool-dot"
                      style={{ backgroundColor: toolDisplay.color }}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Carousel - expanded view of selected agent */}
      {selectedAgent && (
        <div className="dock-carousel">
          <button
            className="dock-carousel__nav dock-carousel__nav--prev"
            onClick={handlePrev}
            aria-label="Previous agent"
          >
            <Icon name="chevron-left" />
          </button>

          <div className="dock-carousel__card">
            <button
              className="dock-carousel__close"
              onClick={handleClose}
              aria-label="Close"
            >
              <Icon name="x" />
            </button>

            <div className="dock-carousel__header">
              <span className="dock-carousel__order">
                {(selectedAgent.agentOrder ?? selectedIndex) + 1}
              </span>
              <span
                className="dock-carousel__status"
                style={{
                  backgroundColor: getAgentStatusConfig(selectedAgent.status).bgColor,
                  color: getAgentStatusConfig(selectedAgent.status).color
                }}
              >
                {getAgentStatusConfig(selectedAgent.status).label}
              </span>
              <span className="dock-carousel__counter">
                {selectedIndex + 1} of {agents.length}
              </span>
            </div>

            <h3 className="dock-carousel__name">{selectedAgent.name}</h3>

            {selectedAgent.objective && (
              <p className="dock-carousel__objective">{selectedAgent.objective}</p>
            )}

            <div className="dock-carousel__tools">
              {selectedAgent.tools.map((tool: string) => {
                const toolDisplay = getToolDisplay(tool);
                return (
                  <span
                    key={tool}
                    className="dock-carousel__tool"
                    style={{ backgroundColor: toolDisplay.color }}
                  >
                    {toolDisplay.label}
                  </span>
                );
              })}
            </div>

            <button
              className="dock-carousel__action"
              onClick={() => onAgentClick(selectedAgent)}
            >
              <Icon name="external-link" />
              View Details
            </button>
          </div>

          <button
            className="dock-carousel__nav dock-carousel__nav--next"
            onClick={handleNext}
            aria-label="Next agent"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
