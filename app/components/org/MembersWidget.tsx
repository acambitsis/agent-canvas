/**
 * MembersWidget - WorkOS Users Management widget wrapped in a modal
 *
 * Uses the WorkOS pre-built widget for managing organization members
 * including viewing, inviting, and role management.
 */

'use client';

import React from 'react';
import { UsersManagement } from '@workos-inc/widgets';
import { Modal } from '@/components/ui/Modal';
import { useWidgetToken } from '@/hooks/useWidgetToken';

interface MembersWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
}

export function MembersWidget({ isOpen, onClose, orgId }: MembersWidgetProps) {
  const { token, loading, error } = useWidgetToken(orgId, {
    scopes: ['widgets:users-table:manage'],
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Organization Members" size="large">
      <div className="members-widget">
        {loading && (
          <div className="members-widget__loading">
            <div className="loading-spinner" />
            <span>Loading members...</span>
          </div>
        )}
        {error && (
          <div className="members-widget__error">
            <p>Failed to load members: {error}</p>
            <p>Please try again or contact support if the issue persists.</p>
          </div>
        )}
        {token && <UsersManagement authToken={token} />}
      </div>
    </Modal>
  );
}
