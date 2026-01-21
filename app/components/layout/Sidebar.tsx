/**
 * Sidebar - Navigation and organization selector with collapsible support
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth, useIsOrgAdmin, useCurrentOrg } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useResizable } from '@/hooks/useResizable';
import { Icon } from '@/components/ui/Icon';
import { ImportYamlModal } from '../forms/ImportYamlModal';
import { CanvasRenameModal } from '../forms/CanvasRenameModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MembersModal } from '../org/MembersModal';

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 400;

interface CanvasMenuState {
  canvasId: string;
  x: number;
  y: number;
}

// Context menu dimensions for viewport boundary calculations
const MENU_WIDTH = 150;
const MENU_HEIGHT = 116; // 3 items
const VIEWPORT_PADDING = 8;

export function Sidebar() {
  const { user, userOrgs, currentOrgId, setCurrentOrgId, signOut } = useAuth();
  const { canvases, currentCanvasId, setCurrentCanvasId, createCanvas, deleteCanvas } = useCanvas();
  const { isSidebarCollapsed, toggleSidebar, showToast, sidebarWidth, setSidebarWidth } = useAppState();

  const { isDragging, resizeHandleProps } = useResizable({
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    currentWidth: sidebarWidth,
    onResize: setSidebarWidth,
  });
  const isOrgAdmin = useIsOrgAdmin();
  const currentOrg = useCurrentOrg();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState | null>(null);
  const [renameCanvas, setRenameCanvas] = useState<{ id: string; title: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Get user initials for avatar
  const getUserInitials = (): string => {
    if (!user) return '??';
    const first = user.firstName?.charAt(0) || '';
    const last = user.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || user.email?.charAt(0).toUpperCase() || '??';
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setCanvasMenu(null);
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(target)) {
        setOrgDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    if (canvasMenu || orgDropdownOpen || userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [canvasMenu, orgDropdownOpen, userMenuOpen]);

  const handleCanvasContextMenu = (e: React.MouseEvent, canvasId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position with viewport boundary checks
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    // Adjust if menu would overflow right edge
    if (x + MENU_WIDTH + VIEWPORT_PADDING > viewportWidth) {
      x = viewportWidth - MENU_WIDTH - VIEWPORT_PADDING;
    }

    // Adjust if menu would overflow bottom edge
    if (y + MENU_HEIGHT + VIEWPORT_PADDING > viewportHeight) {
      y = viewportHeight - MENU_HEIGHT - VIEWPORT_PADDING;
    }

    setCanvasMenu({ canvasId, x, y });
  };

  const handleMenuAction = async (action: 'rename' | 'delete' | 'share') => {
    if (!canvasMenu) return;
    const canvas = canvases.find((c) => c._id === canvasMenu.canvasId);
    if (!canvas) return;

    if (action === 'rename') {
      setRenameCanvas({ id: canvas._id, title: canvas.title });
    } else if (action === 'delete') {
      setDeleteConfirm({ id: canvas._id, title: canvas.title });
    } else if (action === 'share') {
      const url = `${window.location.origin}/c/${canvas._id}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard', 'success');
      } catch {
        // Fallback for browsers that don't support clipboard API
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copied to clipboard', 'success');
      }
    }
    setCanvasMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteCanvas(deleteConfirm.id);
      showToast('Canvas deleted successfully', 'success');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete canvas:', error);
      showToast('Failed to delete canvas', 'error');
      setDeleteConfirm(null);
    }
  };

  // Update URL when canvas changes and select it
  const handleSelectCanvas = (canvasId: string) => {
    setCurrentCanvasId(canvasId);
    // Update URL for shareable links
    window.history.replaceState(null, '', `/c/${canvasId}`);
  };

  const handleCreateCanvas = async () => {
    const title = prompt('Enter canvas name:');
    if (!title?.trim()) return;

    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const canvasId = await createCanvas(title.trim(), slug);
      handleSelectCanvas(canvasId);
      showToast('Canvas created successfully', 'success');
    } catch (error) {
      console.error('Failed to create canvas:', error);
      showToast('Failed to create canvas', 'error');
    }
  };

  return (
    <>
      <aside
        className={`sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
        style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <Icon name="layout-grid" />
          </div>
          <div className="sidebar__org-switcher" ref={orgDropdownRef}>
            {userOrgs.length > 1 ? (
              <>
                <button
                  className="sidebar__org-trigger"
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  title="Switch organization"
                >
                  <span className="sidebar__org-name">{currentOrg?.name}</span>
                  <Icon name="chevron-down" className="sidebar__org-chevron" />
                </button>
                <div className={`sidebar__dropdown ${orgDropdownOpen ? 'open' : ''}`}>
                  {userOrgs.map((org) => (
                    <button
                      key={org.id}
                      className="sidebar__dropdown-item"
                      onClick={() => {
                        setCurrentOrgId(org.id);
                        setOrgDropdownOpen(false);
                      }}
                    >
                      {org.name || org.id}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="sidebar__org-name">{currentOrg?.name}</span>
            )}
          </div>
          <button
            className="sidebar__collapse-btn"
            onClick={toggleSidebar}
            title="Collapse sidebar"
          >
            <Icon name="panel-left-close" />
          </button>
        </div>

        <div className="sidebar__section sidebar__section--grow">
          <div className="sidebar__section-header">
            <h3 className="sidebar__section-title">Canvases</h3>
            <div className="sidebar__section-actions">
              <button
                type="button"
                className="sidebar__action-btn"
                onClick={handleCreateCanvas}
                title="New canvas"
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                className="sidebar__action-btn"
                onClick={() => setIsImportModalOpen(true)}
                title="Import from YAML"
              >
                <Icon name="upload" />
              </button>
            </div>
          </div>
          <div className="sidebar__canvas-list">
            {canvases.map((canvas) => (
              <div
                key={canvas._id}
                className={`sidebar__canvas-item ${currentCanvasId === canvas._id ? 'is-active' : ''}`}
                onClick={() => handleSelectCanvas(canvas._id)}
                onContextMenu={(e) => handleCanvasContextMenu(e, canvas._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectCanvas(canvas._id);
                  }
                }}
              >
                <Icon name="file-text" />
                <span title={canvas.title}>{canvas.title}</span>
                <button
                  className="sidebar__canvas-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCanvasContextMenu(e, canvas._id);
                  }}
                  title="Canvas options"
                >
                  <Icon name="more-vertical" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar__user" ref={userMenuRef}>
          <div className="sidebar__user-avatar">
            {getUserInitials()}
          </div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="sidebar__user-email">{user?.email}</span>
          </div>
          <button
            className="sidebar__user-menu-btn"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title="User menu"
          >
            <Icon name="more-vertical" />
          </button>
          <div className={`sidebar__dropdown sidebar__dropdown--up ${userMenuOpen ? 'open' : ''}`}>
            {isOrgAdmin && (
              <button
                className="sidebar__dropdown-item"
                onClick={() => {
                  setIsMembersModalOpen(true);
                  setUserMenuOpen(false);
                }}
              >
                <Icon name="users" />
                <span>Members</span>
              </button>
            )}
            <button
              className="sidebar__dropdown-item"
              onClick={() => {
                signOut();
                setUserMenuOpen(false);
              }}
            >
              <Icon name="log-out" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        <ImportYamlModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />

        {currentOrgId && user && (
          <MembersModal
            isOpen={isMembersModalOpen}
            onClose={() => setIsMembersModalOpen(false)}
            orgId={currentOrgId}
            currentUserId={user.id}
          />
        )}

        <div
          className={`sidebar__resize-handle ${isDragging ? 'is-dragging' : ''}`}
          {...resizeHandleProps}
        />
      </aside>

      {/* Canvas Context Menu */}
      {canvasMenu && (
        <div
          ref={menuRef}
          className="context-menu open"
          style={{
            position: 'fixed',
            left: canvasMenu.x,
            top: canvasMenu.y,
            zIndex: 1000,
          }}
        >
          <button
            className="context-menu__item"
            onClick={() => handleMenuAction('share')}
          >
            <Icon name="share-2" />
            <span>Copy link</span>
          </button>
          <button
            className="context-menu__item"
            onClick={() => handleMenuAction('rename')}
          >
            <Icon name="pencil" />
            <span>Rename</span>
          </button>
          <button
            className="context-menu__item context-menu__item--danger"
            onClick={() => handleMenuAction('delete')}
          >
            <Icon name="trash-2" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Rename Modal */}
      {renameCanvas && (
        <CanvasRenameModal
          isOpen={true}
          canvasId={renameCanvas.id}
          currentTitle={renameCanvas.title}
          onClose={() => setRenameCanvas(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Canvas"
          message={`Are you sure you want to delete "${deleteConfirm.title}"? This will also delete all agents in this canvas. This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </>
  );
}
