import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendInvitationEmail(
  email: string,
  inviteToken: string,
  invitedByName: string
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const inviteUrl = `${frontendUrl}/invite/accept?token=${inviteToken}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `You've been invited to PostmortemAI`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e1e2e;">You've been invited to PostmortemAI</h2>
        <p style="color: #555;">
          <strong>${invitedByName}</strong> has invited you to join their team on PostmortemAI — 
          an AI-powered incident postmortem tool.
        </p>
        <a 
          href="${inviteUrl}" 
          style="
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 16px 0;
          "
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
}