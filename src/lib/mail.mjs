import fs from 'node:fs';
import path from 'node:path';
import { site } from '../config.mjs';
import { sendSmtp } from './smtp.mjs';

export class MailNotConfiguredError extends Error {
  constructor() {
    super('MAIL_NOT_CONFIGURED');
    this.name = 'MailNotConfiguredError';
  }
}

export async function sendEnquiry(payload) {
  const submittedAt = new Date().toISOString();
  const subject = `[${site.name}] ${payload.enquiryLabel} — ${payload.fullName}`;
  const text = plainText(payload, submittedAt);
  const html = htmlEmail(payload, submittedAt);
  const to = (process.env.CONTACT_TO || site.email).trim();
  const from = (process.env.SMTP_FROM || `${site.name} <${site.email}>`).trim();
  const driver = (process.env.MAIL_DRIVER || '').trim().toLowerCase();

  if (driver === 'log') {
    const dir = path.join(process.cwd(), 'storage');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'mail.log'),
      `${JSON.stringify({ submittedAt, subject, to, replyTo: payload.email, text })}\n`,
      'utf8',
    );
    return;
  }

  const host = process.env.SMTP_HOST?.trim();
  if (!host || !from || !to || !process.env.SMTP_USER?.trim()) throw new MailNotConfiguredError();

  await sendSmtp({
    host,
    port: process.env.SMTP_PORT || 465,
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT || 465) === 465,
    user: process.env.SMTP_USER.trim(),
    pass: process.env.SMTP_PASS || '',
    from,
    to,
    replyTo: payload.email,
    subject,
    text,
    html,
    messageDomain: site.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'website',
  });
}

function plainText(payload, submittedAt) {
  return [
    `New enquiry from the ${site.sourceLabel}`,
    '',
    `Submitted: ${submittedAt}`,
    `Source: ${site.sourceLabel}`,
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Enquiry: ${payload.enquiryLabel}`,
    '',
    'Message:',
    payload.message,
    '',
    `IP: ${payload.ip}`,
    `User agent: ${payload.userAgent}`,
  ].join('\n');
}

function htmlEmail(payload, submittedAt) {
  const rows = [
    ['Submitted', submittedAt],
    ['Website', site.sourceLabel],
    ['Name', payload.fullName],
    ['Email', payload.email],
    ['Phone', payload.phone],
    ['Enquiry', payload.enquiryLabel],
    ['Message', payload.message],
    ['IP address', payload.ip],
    ['Browser', payload.userAgent],
  ];
  const body = rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:12px 14px;width:34%;font-weight:700;vertical-align:top;background:${index % 2 ? '#f7f4ee' : '#fff'};border-bottom:1px solid #eadfce;">${esc(label)}</td><td style="padding:12px 14px;line-height:1.5;border-bottom:1px solid #eadfce;">${esc(value)}</td></tr>`,
    )
    .join('');
  const accent = site.mailAccent || '#234237';
  const paper = site.mailPaper || '#f4efe6';
  return `<div style="font-family:Poppins,Arial,sans-serif;background:${paper};padding:24px;">
    <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:${accent};color:#fbf8f3;padding:22px 28px;">
        <p style="margin:0 0 6px;letter-spacing:.14em;text-transform:uppercase;font-size:12px;">${esc(site.name)}</p>
        <h1 style="margin:0;font-size:22px;">New website enquiry</h1>
      </td></tr>
      <tr><td style="padding:12px 20px 24px;"><table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;">${body}</table>
        <p style="color:#5c675f;font-size:13px;">Reply to this email to reach the visitor. Their address is the Reply-To.</p>
      </td></tr>
    </table>
  </div>`;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}
