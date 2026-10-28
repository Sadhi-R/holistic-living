import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { site } from './src/config.mjs';
import { loadEnv } from './src/lib/env.mjs';
import { validateEnquiry } from './src/lib/validate.mjs';
import { allowRequest, rememberSubmission } from './src/lib/rate-limit.mjs';
import { sendEnquiry, MailNotConfiguredError } from './src/lib/mail.mjs';

loadEnv();

const root = path.resolve('dist');
const port = Number(process.env.PORT || site.defaultPort);
const host = process.env.HOST || '0.0.0.0';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'POST' && url.pathname === '/api/contact') {
      await handleContact(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return;
    }
    const file = resolveFile(url.pathname);
    if (!file) {
      const missing = path.join(root, '404.html');
      const body = fs.existsSync(missing) ? fs.readFileSync(missing) : 'Not found';
      send(res, 404, body, 'text/html; charset=utf-8');
      return;
    }
    const ext = path.extname(file);
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=604800';
    send(res, 200, req.method === 'HEAD' ? null : fs.readFileSync(file), types[ext] || 'application/octet-stream', cache);
  } catch (error) {
    console.error('request-failed');
    send(res, 500, 'Something went wrong.', 'text/plain; charset=utf-8');
  }
});

server.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});

function resolveFile(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.includes('\0')) return null;
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '') rel = '/index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const index = path.join(file, 'index.html');
  if (fs.existsSync(index)) return index;
  return null;
}

async function handleContact(req, res) {
  const asJson = (req.headers.accept || '').includes('application/json');
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return reply(res, asJson, 403, 'This form can only be submitted from this website.');
      }
    } catch {
      return reply(res, asJson, 400, 'The request could not be accepted.');
    }
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > 40_000) return reply(res, asJson, 413, 'That message is too large. Please shorten it and try again.');

  let raw = '';
  try {
    raw = await readBody(req, 40_000);
  } catch {
    return reply(res, asJson, 413, 'That message is too large. Please shorten it and try again.');
  }

  const type = String(req.headers['content-type'] || '');
  if (type.includes('multipart/form-data')) {
    return reply(res, asJson, 400, 'Please submit the form again.');
  }
  const form = new URLSearchParams(raw);
  if (String(form.get('hp_token') || '').trim()) {
    return reply(res, asJson, 200, 'Thank you. Your enquiry has been sent.', true);
  }

  const ip = clientIp(req);
  if (!allowRequest(ip)) {
    return reply(res, asJson, 429, 'Too many enquiries from this connection. Please wait a while, or call or WhatsApp us.');
  }

  const result = validateEnquiry(form);
  if (!result.ok) {
    return reply(res, asJson, 422, result.fields.form || 'Please correct the highlighted fields.', false, result.fields);
  }

  const duplicateKey = `${result.data.email}|${result.data.enquiry}|${result.data.message}`;
  if (rememberSubmission(duplicateKey, false)) {
    return reply(res, asJson, 200, 'We already have this enquiry. Our team will be in touch.', true);
  }

  try {
    await sendEnquiry({
      ...result.data,
      ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    });
    rememberSubmission(duplicateKey, true);
  } catch (error) {
    if (error instanceof MailNotConfiguredError) {
      return reply(
        res,
        asJson,
        503,
        'The enquiry form cannot send email yet because mail delivery is not configured. Please call, WhatsApp, or email us directly. Your message was not delivered.',
      );
    }
    console.error('contact-mail-failed');
    return reply(
      res,
      asJson,
      500,
      'We could not send your enquiry just now. Please try again, or call or WhatsApp us. Your details are still in the form.',
    );
  }

  return reply(res, asJson, 200, 'Thank you. Your enquiry has been sent. We will reply using the email or phone number you provided.', true);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim().slice(0, 64);
  return (req.socket.remoteAddress || 'unknown').slice(0, 64);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function reply(res, asJson, status, message, ok = false, fields = {}) {
  if (asJson) {
    send(
      res,
      status,
      JSON.stringify({ ok, message, error: ok ? undefined : message, fields }),
      'application/json; charset=utf-8',
      'no-store',
    );
    return;
  }
  const title = ok ? 'Enquiry sent' : 'Enquiry not sent';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:Poppins,Arial,sans-serif;padding:2rem;background:#f4efe6"><main style="max-width:38rem;margin:auto;background:#fff;padding:1.4rem;border-radius:16px"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/contact">Return to the contact form</a></p></main></body></html>`;
  send(res, status, html, 'text/html; charset=utf-8', 'no-store');
}

function send(res, status, body, type, cache = 'no-store') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (body == null) res.end();
  else res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
