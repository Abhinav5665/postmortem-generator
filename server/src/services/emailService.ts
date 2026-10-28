import nodemailer from 'nodemailer'

const smtpConfigured = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
)

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Fail fast: some hosts block SMTP, and the request must not hang
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    })
  : null

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export function buildInviteUrl(token: string): string {
  const base = (
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '')
  return `${base}/invite/accept?token=${token}`
}

// Returns true if the email was sent, false if email is not configured or failed.
// It never throws, so the caller can fall back to showing the invite link.
export async function sendInvitationEmail(
  email: string,
  inviteToken: string,
  invitedByName: string
): Promise<boolean> {
  if (!transporter) return false

  const inviteUrl = buildInviteUrl(inviteToken)

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `You've been invited to PostmortemAI`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1e1e2e;">You've been invited to PostmortemAI</h2>
          <p style="color: #555;">
            <strong>${escapeHtml(invitedByName)}</strong> has invited you to join their team on PostmortemAI,
            an AI-powered incident postmortem tool.
          </p>
          <a
            href="${inviteUrl}"
            style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;"
          >
            Accept Invitation
          </a>
          <p style="color: #888; font-size: 12px;">
            This invitation expires in 48 hours. If you didn't expect this email, ignore it.
          </p>
          <p style="color: #888; font-size: 12px;">
            Or copy this link: ${inviteUrl}
          </p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Invitation email failed:', (error as Error).message)
    return false
  }
}