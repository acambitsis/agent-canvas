/**
 * Sidebar - Navigation and organization selector
 */

'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';

export function Sidebar() {
  const { user, userOrgs, currentOrgId, setCurrentOrgId, signOut } = useAuth();
  const { canvases, currentCanvasId, setCurrentCanvasId } = useCanvas();

  // Refresh Lucide icons
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  });

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <i data-lucide="layout-grid"></i>
          <span>AgentCanvas</span>
        </div>
      </div>

      {userOrgs.length > 1 && (
        <div className="sidebar__section">
          <label htmlFor="org-select">Organization</label>
          <select
            id="org-select"
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

      <div className="sidebar__section">
        <h3>Canvases</h3>
        <div className="sidebar__canvas-list">
          {canvases.map((canvas) => (
            <button
              key={canvas._id}
              className={`sidebar__canvas-item ${currentCanvasId === canvas._id ? 'active' : ''}`}
              onClick={() => setCurrentCanvasId(canvas._id)}
            >
              <i data-lucide="file-text"></i>
              <span>{canvas.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="sidebar__user-email">{user?.email}</span>
          </div>
          <button className="btn-icon" onClick={signOut} title="Sign out">
            <i data-lucide="log-out"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
