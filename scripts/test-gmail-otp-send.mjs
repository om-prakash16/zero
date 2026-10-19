import nodemailer from 'nodemailer';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach((l) => {
  const idx = l.indexOf('=');
  if (idx !== -1 && !l.trim().startsWith('#')) {
    env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
  }
});

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

async function testSend() {
  console.log('Testing SMTP connection with:', env.SMTP_USER);
  const verify = await transporter.verify();
  console.log('Transporter verified:', verify);

  const info = await transporter.sendMail({
    from: `"${env.SMTP_SENDER_NAME || 'CROSSWIRE'}" <${env.SMTP_USER}>`,
    to: env.SMTP_USER,
    subject: 'CROSSWIRE Verification Code [TEST]',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #ffffff; border-radius: 12px; max-width: 500px;">
        <h2 style="color: #ef4444; margin-top: 0;">CROSSWIRE Security Code</h2>
        <p style="font-size: 14px; color: #cbd5e1;">Your 8-digit verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background: #1e293b; padding: 14px; text-align: center; border-radius: 8px; color: #ffffff; font-family: monospace;">
          88224411
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">This code expires in 10 minutes. Do NOT share it with anyone.</p>
      </div>
    `,
  });

  console.log('Email sent successfully! MessageId:', info.messageId);
}

testSend().catch(err => {
  console.error('SMTP Error:', err);
  process.exit(1);
});
