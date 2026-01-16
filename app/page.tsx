'use client';

import { useEffect, useState } from 'react';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication first before loading the client app
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        if (!data.authenticated) {
          // Redirect to login if not authenticated
          window.location.href = '/login';
          return;
        }
        
        setIsAuthenticated(true);
        
        // Load the existing client/main.js module as a script
        // This preserves the existing DOM-based app architecture
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/client/main.js';
        document.body.appendChild(script);
      } catch (error) {
        console.error('Auth check failed:', error);
        // On error, redirect to login
        window.location.href = '/login';
      }
    }
    
    checkAuth();
    
    return () => {
      // Cleanup on unmount
      const existingScript = document.querySelector('script[src="/client/main.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <>
      {/* Mount point for the existing client app */}
      <div id="app-root">
        {/* The existing index.html content will be rendered here by client/main.js */}
        {/* We need to include the HTML structure that main.js expects */}
        <aside className="sidebar" id="sidebar">
          <div className="sidebar__logo">
            <div className="sidebar__logo-icon">
              <i data-lucide="workflow"></i>
            </div>
            <span className="sidebar__logo-text">AgentCanvas</span>
          </div>

          <div className="sidebar__section">
            <div className="sidebar__org-switcher" id="orgSwitcher">
              <button type="button" className="sidebar__org-trigger" id="orgSwitcherTrigger">
                <div className="sidebar__org-icon">
                  <i data-lucide="building-2"></i>
                </div>
                <div className="sidebar__org-info">
                  <span className="sidebar__org-label">Organization</span>
                  <span className="sidebar__org-name" id="currentOrgName">Select org...</span>
                </div>
                <i data-lucide="chevrons-up-down" className="sidebar__org-chevron"></i>
              </button>
              <div className="sidebar__dropdown" id="orgDropdown"></div>
            </div>
          </div>

          <div className="sidebar__section sidebar__section--grow">
            <div className="sidebar__section-header">
              <span className="sidebar__section-title">Canvases</span>
              <button type="button" className="sidebar__action-btn" id="newCanvasBtn" title="New Canvas">
                <i data-lucide="plus"></i>
              </button>
            </div>
            <div className="sidebar__canvas-list" id="canvasList"></div>
          </div>

          <div className="sidebar__section">
            <button type="button" className="sidebar__menu-item" id="importCanvasBtn">
              <i data-lucide="upload"></i>
              <span>Import Canvas</span>
            </button>
          </div>

          <div className="sidebar__user" id="userMenuTrigger">
            <div className="sidebar__user-avatar" id="userAvatar">U</div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name" id="userDisplayName">User</span>
              <span className="sidebar__user-email" id="userEmail">user@example.com</span>
            </div>
            <button type="button" className="sidebar__user-menu-btn" id="userMenuBtn">
              <i data-lucide="more-vertical"></i>
            </button>
            <div className="sidebar__dropdown sidebar__dropdown--up" id="userMenuDropdown">
              <div className="sidebar__dropdown-item" id="signOutBtn" data-action="signout">
                <i data-lucide="log-out"></i>
                <span>Sign out</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="main-wrapper">
          <header className="toolbar">
            <div className="toolbar__left">
              <button type="button" className="toolbar__menu-toggle" id="sidebarToggle">
                <i data-lucide="menu"></i>
              </button>

              <div className="toolbar__title-group">
                <h1 className="toolbar__title" id="documentTitle">AgentCanvas</h1>
                <button type="button" className="toolbar__title-btn" id="boardMenuTrigger" title="Canvas options">
                  <i data-lucide="chevron-down"></i>
                </button>
                <div className="toolbar__dropdown" id="board-menu">
                  <div className="toolbar__dropdown-item" data-board-action="edit-title">
                    <i data-lucide="edit-3"></i>
                    <span>Edit Title</span>
                  </div>
                  <div className="toolbar__dropdown-divider"></div>
                  <div className="toolbar__dropdown-item" data-board-action="add-section">
                    <i data-lucide="plus"></i>
                    <span>Add Section</span>
                  </div>
                </div>
              </div>

              <span id="agent-count" className="toolbar__badge">
                <i data-lucide="bot"></i>
                <span>0 Agents</span>
              </span>
            </div>

            <div className="toolbar__right">
              <div className="toolbar__control" id="groupingControl">
                <span className="toolbar__control-label">Group by</span>
                <button type="button" className="toolbar__control-btn" id="groupingValue">
                  <span>Phase</span>
                  <i data-lucide="chevron-down"></i>
                </button>
                <div className="toolbar__dropdown" id="groupingDropdown">
                  <div className="toolbar__dropdown-item is-active" data-tag-type="phase">
                    <i data-lucide="layers"></i>
                    <span>Phase</span>
                  </div>
                  <div className="toolbar__dropdown-item" data-tag-type="department">
                    <i data-lucide="building-2"></i>
                    <span>Department</span>
                  </div>
                  <div className="toolbar__dropdown-item" data-tag-type="status">
                    <i data-lucide="activity"></i>
                    <span>Status</span>
                  </div>
                </div>
              </div>

              <button type="button" className="toolbar__btn" id="collapseAllBtn" title="Collapse/Expand All">
                <i id="collapseAllIcon" data-lucide="chevrons-down"></i>
                <span id="collapseAllText">Collapse</span>
              </button>

              <button type="button" className="toolbar__btn toolbar__btn--icon" id="documentMenuBtn" title="Canvas actions">
                <i data-lucide="more-horizontal"></i>
              </button>
              <div className="toolbar__dropdown toolbar__dropdown--right" id="documentMenu">
                <div className="toolbar__dropdown-item" data-action="rename">
                  <i data-lucide="edit-3"></i>
                  <span>Rename</span>
                </div>
                <div className="toolbar__dropdown-divider"></div>
                <div className="toolbar__dropdown-item toolbar__dropdown-item--danger" data-action="delete">
                  <i data-lucide="trash-2"></i>
                  <span>Delete</span>
                </div>
              </div>
            </div>
          </header>

          <input type="file" id="documentFileInput" className="is-hidden" accept=".yaml,.yml,text/yaml" />

          <main className="main-content">
            <p className="document-status" id="documentStatusMessage"></p>

            <div className="empty-state" id="emptyState">
              <div className="empty-state__icon">
                <i data-lucide="layout-grid"></i>
              </div>
              <h2 className="empty-state__title">No canvas selected</h2>
              <p className="empty-state__description">Create a new canvas or select one from the sidebar to get started.</p>
              <button type="button" className="empty-state__btn" id="emptyStateNewBtn">
                <i data-lucide="plus"></i>
                Create Canvas
              </button>
            </div>

            <div id="agentGroupsContainer"></div>
          </main>
        </div>

        <div id="agentModal" className="modal-overlay">
          <div className="modal modal--large">
            <div className="modal__header">
              <h2 className="modal__title" id="modalAgentTitle">Edit Agent</h2>
              <button type="button" className="modal__close" id="agentModalClose">
                <i data-lucide="x"></i>
              </button>
            </div>
            <div className="modal__body">
              <form id="agentForm">
                <div id="agentFormContent">
                  <div className="form-group">
                    <label className="form-label form-label--required" htmlFor="agentName">Agent Name</label>
                    <input type="text" id="agentName" className="form-input" required />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="agentObjective">Objective</label>
                    <input type="text" id="agentObjective" className="form-input" placeholder="Brief summary of what this agent does" />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="agentDescription">Description</label>
                    <textarea id="agentDescription" className="form-textarea" rows={3} placeholder="Detailed description of capabilities"></textarea>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tags</label>
                    <div className="u-flex u-flex-column u-gap-3">
                      <div>
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                          Department
                        </label>
                        <div className="tag-select" id="agentDepartmentTags"></div>
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
                          Status
                        </label>
                        <div className="tag-select" id="agentStatusTags"></div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tools</label>
                    <div id="agentTools" className="checkbox-group"></div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="journeySteps">Journey Steps</label>
                    <textarea id="journeySteps" className="form-textarea" rows={4} placeholder="Enter one step per line"></textarea>
                  </div>

                  <div className="u-flex u-gap-3">
                    <div className="form-group u-flex-1">
                      <label className="form-label" htmlFor="metricsUsage">Usage This Week</label>
                      <input type="text" id="metricsUsage" className="form-input" placeholder="e.g., 25 uses" />
                    </div>
                    <div className="form-group u-flex-1">
                      <label className="form-label" htmlFor="metricsTimeSaved">Time Saved</label>
                      <input type="text" id="metricsTimeSaved" className="form-input" placeholder="e.g., 60%" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn btn--danger" id="deleteAgentBtn">
                <i data-lucide="trash-2"></i> Delete
              </button>
              <div className="u-flex-1"></div>
              <button type="button" className="btn" id="agentCancelBtn">Cancel</button>
              <button type="button" className="btn btn--primary" id="agentSaveBtn">
                <i data-lucide="check"></i> Save
              </button>
            </div>
          </div>
        </div>

        <div id="titleModal" className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <h2 className="modal__title">Edit Title</h2>
              <button type="button" className="modal__close" id="titleModalClose">
                <i data-lucide="x"></i>
              </button>
            </div>
            <div className="modal__body">
              <form id="titleForm">
                <div className="form-group">
                  <label className="form-label form-label--required" htmlFor="documentTitleInput">Title</label>
                  <input type="text" id="documentTitleInput" className="form-input" required placeholder="Enter document title" />
                </div>
              </form>
            </div>
            <div className="modal__footer">
              <button type="button" className="btn" id="titleModalCancel">Cancel</button>
              <button type="button" className="btn btn--primary" id="titleModalSave">
                <i data-lucide="check"></i> Save
              </button>
            </div>
          </div>
        </div>

        <div id="loadingOverlay" className="modal-overlay" style={{ background: 'var(--bg-primary)' }}>
          <div className="u-flex u-flex-column u-align-center u-gap-4">
            <div className="spinner spinner--lg"></div>
            <p id="loadingMessage" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          </div>
        </div>

        <div className="toast-container" id="toastContainer"></div>
      </div>
    </>
  );
}
