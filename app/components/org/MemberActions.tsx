/**
 * MemberActions - Dropdown menu for member role changes and removal
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Member } from './MemberList';
import { API_ENDPOINTS } from '@/constants/api';
import { ORG_ROLES } from '@/types/validationConstants';

interface MemberActionsProps {
  orgId: string;
  member: Member;
  onUpdated: () => void;
}

export function MemberActions({ orgId, member, onUpdated }: MemberActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleRoleChange = async (newRole: string) => {
    if (newRole === member.role) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.orgMember(orgId, member.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role');
      }

      setIsOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove ${member.email} from the organization?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.orgMember(orgId, member.id), {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member');
      }

      setIsOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="member-actions" ref={dropdownRef}>
      <button
        className="btn btn--icon btn--ghost"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        aria-label="Member actions"
      >
        {loading ? (
          <Icon name="loader-2" className="spin" />
        ) : (
          <Icon name="more-vertical" />
        )}
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {error && (
            <div className="dropdown-error">
              <Icon name="alert-circle" size={14} />
              {error}
            </div>
          )}

          <div className="dropdown-section">
            <div className="dropdown-label">Change role</div>
            <button
              className={`dropdown-item ${member.role === ORG_ROLES.ADMIN ? 'active' : ''}`}
              onClick={() => handleRoleChange(ORG_ROLES.ADMIN)}
              disabled={loading}
            >
              <Icon name="shield" size={14} />
              Admin
              {member.role === ORG_ROLES.ADMIN && <Icon name="check" size={14} />}
            </button>
            <button
              className={`dropdown-item ${member.role === ORG_ROLES.MEMBER ? 'active' : ''}`}
              onClick={() => handleRoleChange(ORG_ROLES.MEMBER)}
              disabled={loading}
            >
              <Icon name="user" size={14} />
              Member
              {member.role === ORG_ROLES.MEMBER && <Icon name="check" size={14} />}
            </button>
          </div>

          <div className="dropdown-divider" />

          <button
            className="dropdown-item dropdown-item--danger"
            onClick={handleRemove}
            disabled={loading}
          >
            <Icon name="user-minus" size={14} />
            Remove from organization
          </button>
        </div>
      )}
    </div>
  );
}
