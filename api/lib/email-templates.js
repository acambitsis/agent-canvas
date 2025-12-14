/**
 * Email templates for group invitations
 */

import { Resend } from 'resend';

let resendClient = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getAppName() {
  return process.env.APP_NAME || 'AgentCanvas';
}

function getAppUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Build HTML email template for group invite
 */
function buildInviteEmailHtml(groupName, inviterEmail, signUpUrl, appName) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${groupName}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f5f5f5; padding: 40px;">
  <table width="600" style="background: #fff; border-radius: 8px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px; text-align: center;">
        <h1 style="color: #1a1a1a;">${appName}</h1>
        <h2 style="color: #333;">You've been invited to join "${groupName}"</h2>
        <p style="color: #4a4a4a;">
          <strong>${inviterEmail}</strong> has invited you to collaborate on ${appName}.
        </p>
        <a href="${signUpUrl}"
           style="display: inline-block; padding: 14px 32px; background: #0070f3; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">
          Accept Invitation
        </a>
        <p style="color: #6a6a6a; font-size: 14px; margin-top: 20px;">
          Or copy this URL: ${signUpUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #8a8a8a; font-size: 12px;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain text email template for group invite
 */
function buildInviteEmailText(groupName, inviterEmail, signUpUrl, appName) {
  return `You've been invited to ${groupName}

${inviterEmail} has invited you to collaborate on ${appName}.

Click the link below to accept the invitation:

${signUpUrl}

This invitation expires in 7 days.

If you didn't expect this email, you can safely ignore it.`;
}

/**
 * Build HTML email template for "added to group" notification
 */
function buildAddedToGroupEmailHtml(groupName, inviterEmail, loginUrl, appName) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been added to ${groupName}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f5f5f5; padding: 40px;">
  <table width="600" style="background: #fff; border-radius: 8px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px; text-align: center;">
        <h1 style="color: #1a1a1a;">${appName}</h1>
        <h2 style="color: #333;">You've been added to "${groupName}"</h2>
        <p style="color: #4a4a4a;">
          <strong>${inviterEmail}</strong> added you to their group on ${appName}.
        </p>
        <a href="${loginUrl}"
           style="display: inline-block; padding: 14px 32px; background: #0070f3; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0;">
          View Group
        </a>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #8a8a8a; font-size: 12px;">
          If you didn't expect this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain text email template for "added to group" notification
 */
function buildAddedToGroupEmailText(groupName, inviterEmail, loginUrl, appName) {
  return `You've been added to ${groupName}

${inviterEmail} added you to their group on ${appName}.

Click the link below to view the group:

${loginUrl}

If you didn't expect this email, you can safely ignore it.`;
}

/**
 * Send invite email via Resend
 * @param {string} toEmail - Recipient email address
 * @param {string} groupName - Name of the group
 * @param {string} inviterEmail - Email of the person who sent the invite
 * @returns {Promise<Object>} Result with success boolean and optional error
 */
export async function sendInviteEmail(toEmail, groupName, inviterEmail) {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) {
    console.warn('RESEND_FROM_EMAIL not configured, skipping invite email');
    return { success: false, error: 'RESEND_FROM_EMAIL not configured' };
  }

  try {
    const resend = getResendClient();
    const appName = getAppName();
    const appUrl = getAppUrl();
    const signUpUrl = `${appUrl}/login`;

    console.log('[EMAIL] Sending invite email:', {
      from: fromEmail,
      to: toEmail,
      groupName
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `You've been invited to join "${groupName}" on ${appName}`,
      html: buildInviteEmailHtml(groupName, inviterEmail, signUpUrl, appName),
      text: buildInviteEmailText(groupName, inviterEmail, signUpUrl, appName),
    });

    if (result?.error) {
      console.error('[EMAIL] Resend API error:', result.error);
      return { success: false, error: result.error.message };
    }

    if (result?.data?.id) {
      console.log('[EMAIL] Invite email sent successfully:', result.data.id);
      return { success: true, emailId: result.data.id };
    }

    return { success: false, error: 'Unexpected response from Resend' };
  } catch (error) {
    console.error('[EMAIL] Exception sending invite email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send "added to group" notification email via Resend
 * @param {string} toEmail - Recipient email address
 * @param {string} groupName - Name of the group
 * @param {string} inviterEmail - Email of the person who added them
 * @returns {Promise<Object>} Result with success boolean and optional error
 */
export async function sendAddedToGroupEmail(toEmail, groupName, inviterEmail) {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) {
    console.warn('RESEND_FROM_EMAIL not configured, skipping notification email');
    return { success: false, error: 'RESEND_FROM_EMAIL not configured' };
  }

  try {
    const resend = getResendClient();
    const appName = getAppName();
    const appUrl = getAppUrl();
    const loginUrl = `${appUrl}/login`;

    console.log('[EMAIL] Sending added-to-group email:', {
      from: fromEmail,
      to: toEmail,
      groupName
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `You've been added to "${groupName}" on ${appName}`,
      html: buildAddedToGroupEmailHtml(groupName, inviterEmail, loginUrl, appName),
      text: buildAddedToGroupEmailText(groupName, inviterEmail, loginUrl, appName),
    });

    if (result?.error) {
      console.error('[EMAIL] Resend API error:', result.error);
      return { success: false, error: result.error.message };
    }

    if (result?.data?.id) {
      console.log('[EMAIL] Added-to-group email sent successfully:', result.data.id);
      return { success: true, emailId: result.data.id };
    }

    return { success: false, error: 'Unexpected response from Resend' };
  } catch (error) {
    console.error('[EMAIL] Exception sending added-to-group email:', error);
    return { success: false, error: error.message };
  }
}
