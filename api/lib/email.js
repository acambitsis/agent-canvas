import { Resend } from 'resend';

let resendClient = null;

/**
 * Get or initialize Resend client
 */
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

/**
 * Get application name from environment variable or default
 */
function getAppName() {
  return process.env.APP_NAME || 'AgentCanvas';
}

/**
 * Build HTML email template for magic link
 */
function buildEmailHtml(magicLinkUrl, appName = null) {
  const app = appName || getAppName();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${app}</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f5f5f5; padding: 40px;">
  <table width="600" style="background: #fff; border-radius: 8px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px; text-align: center;">
        <h1 style="color: #1a1a1a;">${app}</h1>
        <p style="color: #4a4a4a;">
          Click the button below to sign in. This link expires in <strong>15 minutes</strong>.
        </p>
        <a href="${magicLinkUrl}"
           style="display: inline-block; padding: 14px 32px; background: #0070f3; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Sign In
        </a>
        <p style="color: #6a6a6a; font-size: 14px; margin-top: 20px;">
          Or copy this URL: ${magicLinkUrl}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;">
        <p style="color: #8a8a8a; font-size: 12px;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain text email template for magic link
 */
function buildEmailText(magicLinkUrl, appName = null) {
  const app = appName || getAppName();
  return `Sign in to ${app}

Click the link below to sign in. This link expires in 15 minutes.

${magicLinkUrl}

If you didn't request this email, you can safely ignore it.`;
}

/**
 * Send magic link email via Resend
 * @param {string} toEmail - Recipient email address
 * @param {string} magicLinkUrl - Magic link URL
 * @returns {Promise<Object>} Result with success boolean and optional error
 */
export async function sendMagicLinkEmail(toEmail, magicLinkUrl) {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    return { success: false, error: 'RESEND_FROM_EMAIL not configured' };
  }

  try {
    const resend = getResendClient();
    const appName = getAppName();
    const result = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Sign in to ${appName}`,
      html: buildEmailHtml(magicLinkUrl, appName),
      text: buildEmailText(magicLinkUrl, appName),
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

