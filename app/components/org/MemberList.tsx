/**
 * MemberList - Display organization members with their roles
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { MemberActions } from './MemberActions';
import { API_ENDPOINTS } from '@/constants/api';

export interface Member {
  id: string; // membership ID
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string;
  role: string;
  status: string;
  createdAt: string;
}

interface MemberListProps {
  orgId: string;
  currentUserId: string;
  onMemberUpdated?: () => void;
}

export function MemberList({ orgId, currentUserId, onMemberUpdated }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.orgMembers(orgId));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleMemberUpdated = () => {
    fetchMembers();
    onMemberUpdated?.();
  };

  if (loading) {
    return (
      <div className="member-list member-list--loading">
        <Icon name="loader-2" className="spin" />
        <span>Loading members...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="member-list member-list--error">
        <Icon name="alert-circle" />
        <span>{error}</span>
        <button onClick={fetchMembers} className="btn btn--text">
          Retry
        </button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="member-list member-list--empty">
        <Icon name="users" />
        <span>No members found</span>
      </div>
    );
  }

  return (
    <div className="member-list">
      <table className="member-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="member-row">
              <td className="member-info">
                <div className="member-avatar">
                  {member.profilePictureUrl ? (
                    <img
                      src={member.profilePictureUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                    />
                  ) : (
                    <Icon name="user" size={20} />
                  )}
                </div>
                <div className="member-details">
                  <span className="member-name">
                    {member.firstName || member.lastName
                      ? `${member.firstName} ${member.lastName}`.trim()
                      : member.email}
                  </span>
                  <span className="member-email">{member.email}</span>
                </div>
              </td>
              <td>
                <span className={`role-badge role-badge--${member.role}`}>
                  {member.role}
                </span>
              </td>
              <td>
                <span className={`status-badge status-badge--${member.status}`}>
                  {member.status}
                </span>
              </td>
              <td className="member-actions-cell">
                {member.userId !== currentUserId && (
                  <MemberActions
                    orgId={orgId}
                    member={member}
                    onUpdated={handleMemberUpdated}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
