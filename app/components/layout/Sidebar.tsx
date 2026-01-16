/**
 * Sidebar - Navigation and organization selector
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';
import { Icon } from '@/components/ui/Icon';
import { ImportYamlModal } from '../forms/ImportYamlModal';

export function Sidebar() {
  const { user, userOrgs, currentOrgId, setCurrentOrgId, signOut } = useAuth();
  const { canvases, currentCanvasId, setCurrentCanvasId } = useCanvas();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <Icon name="layout-grid" />
          <span>AgentCanvas</span>
        </div>
      </div>

      {userOrgs.length > 1 && (
        <div className="sidebar__section">
          <label htmlFor="org-select">Organization</label>
          <select
            id="org-select"
            className="form-select"
            value={currentOrgId || ''}
            onChange={(e) => setCurrentOrgId(e.target.value)}
          >
            {userOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name || org.id}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar__section sidebar__section--grow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Canvases</h3>
          <button
            className="icon-btn"
            onClick={() => setIsImportModalOpen(true)}
            title="Import from YAML"
          >
            <Icon name="upload" />
          </button>
        </div>
        <div className="sidebar__canvas-list">
          {canvases.map((canvas) => (
            <button
              key={canvas._id}
              className={`sidebar__canvas-item ${currentCanvasId === canvas._id ? 'active' : ''}`}
              onClick={() => setCurrentCanvasId(canvas._id)}
            >
              <Icon name="file-text" />
              <span>{canvas.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="sidebar__user">
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="sidebar__user-email">{user?.email}</span>
          </div>
          <button className="icon-btn" onClick={signOut} title="Sign out">
            <Icon name="log-out" />
          </button>
        </div>
      </div>

      <ImportYamlModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </aside>
  );
}
