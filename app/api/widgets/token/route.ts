/**
 * Widget Token API Route - Generates authentication tokens for WorkOS widgets
 *
 * This endpoint creates short-lived tokens that authorize the frontend to
 * use WorkOS widgets like the Users Management component.
 *
 * Security: Verifies user is an admin of the organization before issuing token.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';
import { isSuperAdmin, isUserOrgAdmin } from '@/server/org-utils';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export async function POST(request: Request) {
  const { user } = await withAuth();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { organizationId, scopes } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Verify user has admin access to this organization
    const workosApiKey = process.env.WORKOS_API_KEY;
    if (!workosApiKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const isSuper = isSuperAdmin(user.email);
    const isAdmin = await isUserOrgAdmin(user.id, organizationId, workosApiKey);

    if (!isSuper && !isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const token = await workos.widgets.getToken({
      userId: user.id,
      organizationId,
      scopes: scopes || ['widgets:users-table:manage'],
    });

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Widget token error:', error);
    return NextResponse.json(
      { error: 'Failed to get widget token' },
      { status: 500 }
    );
  }
}
