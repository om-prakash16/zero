import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!user || !pass) {
      throw new Error('SMTP credentials not configured in environment (SMTP_USER / SMTP_PASS)');
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

export async function sendOtpEmail({
  to,
  otp,
  purpose,
}: {
  to: string;
  otp: string;
  purpose: 'signup' | 'recovery';
}) {
  const mailer = getTransporter();
  const senderName = process.env.SMTP_SENDER_NAME || 'CROSSWIRE';
  const senderEmail = process.env.SMTP_USER || '';

  const isSignup = purpose === 'signup';
  const title = isSignup ? 'Verify Your Account' : 'Password Reset Code';
  const subtitle = isSignup
    ? 'Use the 8-digit verification code below to complete your registration.'
    : 'Use the 8-digit security code below to reset your CROSSWIRE password.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 480px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(225, 29, 72, 0.15); border: 1px solid rgba(225, 29, 72, 0.3); color: #fb7185; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #ffffff; }
    p { font-size: 14px; line-height: 1.5; color: #94a3b8; margin: 0 0 24px 0; }
    .otp-box { background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #f43f5e; text-shadow: 0 0 20px rgba(244, 63, 94, 0.4); }
    .footer { font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">CROSSWIRE SECURITY</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    
    <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">
      Enter this 8-digit numeric code in the verification prompt to continue.
    </p>
    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
      This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.
    </p>

    <div class="footer">
      <strong>CROSSWIRE Real-Time Multilingual Debate Platform</strong><br>
      This is an automated security transmission. No links are included in this message for your security.
    </div>
  </div>
</body>
</html>
  `;

  return await mailer.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject: `Your CROSSWIRE ${isSignup ? 'Verification' : 'Password Reset'} Code: ${otp}`,
    html,
  });
}
