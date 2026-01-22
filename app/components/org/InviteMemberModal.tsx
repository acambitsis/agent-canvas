/**
 * InviteMemberModal - Form to invite a new member to the organization
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { ORG_ROLES, OrgRole } from '@/types/validationConstants';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onInvited?: () => void;
}

export function InviteMemberModal({ isOpen, onClose, orgId, onInvited }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>(ORG_ROLES.MEMBER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/org/${orgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setSuccess(true);
      setEmail('');
      setRole(ORG_ROLES.MEMBER);
      onInvited?.();

      // Close after showing success briefly
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole(ORG_ROLES.MEMBER);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Member" size="small">
      <form onSubmit={handleSubmit} className="invite-form">
        {error && (
          <div className="form-error">
            <Icon name="alert-circle" size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="form-success">
            <Icon name="check-circle" size={16} />
            Invitation sent successfully!
          </div>
        )}

        <div className="form-group">
          <label htmlFor="invite-email">Email address</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            disabled={loading || success}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
            disabled={loading || success}
          >
            <option value={ORG_ROLES.MEMBER}>Member</option>
            <option value={ORG_ROLES.ADMIN}>Admin</option>
          </select>
          <span className="form-hint">
            {role === ORG_ROLES.ADMIN
              ? 'Admins can manage members and organization settings.'
              : 'Members can view and edit canvases and agents.'}
          </span>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || success || !email}
          >
            {loading ? (
              <>
                <Icon name="loader-2" className="spin" size={16} />
                Sending...
              </>
            ) : success ? (
              <>
                <Icon name="check" size={16} />
                Sent!
              </>
            ) : (
              <>
                <Icon name="send" size={16} />
                Send Invitation
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
