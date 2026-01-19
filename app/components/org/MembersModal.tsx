/**
 * MembersModal - Modal for managing organization members
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { MemberList } from './MemberList';
import { InviteMemberModal } from './InviteMemberModal';

interface MembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  currentUserId: string;
}

export function MembersModal({ isOpen, onClose, orgId, currentUserId }: MembersModalProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMemberUpdated = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Organization Members" size="large">
        <div className="members-modal">
          <div className="members-modal__header">
            <p className="members-modal__description">
              Manage who has access to this organization. Admins can invite new members and change roles.
            </p>
            <button
              className="btn btn--primary"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <Icon name="user-plus" size={16} />
              Invite Member
            </button>
          </div>

          <MemberList
            key={refreshKey}
            orgId={orgId}
            currentUserId={currentUserId}
            onMemberUpdated={handleMemberUpdated}
          />
        </div>
      </Modal>

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        orgId={orgId}
        onInvited={handleMemberUpdated}
      />
    </>
  );
}
