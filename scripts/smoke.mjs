import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { sendSmtp } from '../src/lib/smtp.mjs';

const port = 4391;
const root = process.cwd();
const logFile = path.join(root, 'storage', 'mail.log');
fs.rmSync(logFile, { force: true });

await testSmtp();
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed'))));
});

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', MAIL_DRIVER: 'log', PUBLIC_SITE_URL: `http://127.0.0.1:${port}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

try {
  await waitFor(`http://127.0.0.1:${port}/`);
  const paths = ['/', '/about', '/programs', '/programs/mental-mastery', '/programs/gratitude-journal', '/gallery', '/contact', '/privacy', '/terms', '/disclaimer', '/cancellation', '/sitemap.xml', '/robots.txt'];
  for (const item of paths) {
    const response = await fetch(`http://127.0.0.1:${port}${item}`);
    if (!response.ok) throw new Error(`${item} returned ${response.status}`);
    const html = await response.text();
    if (html.includes('10xwealthcreators@gmail.com') || html.includes('+91 88978 68747')) {
      throw new Error(`${item} contains Business Startup School contact details`);
    }
  }
  const missing = await fetch(`http://127.0.0.1:${port}/missing-page`);
  if (missing.status !== 404) throw new Error('missing page was not a 404');

  const bad = await post({ fullName: 'A', email: 'nope', phone: '123', enquiry: 'general', message: 'hi', consent: 'yes', startedAt: String(Date.now() - 5000) });
  if (bad.status !== 422) throw new Error(`invalid form returned ${bad.status}`);

  const fast = await post({ fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '9876543210', enquiry: 'general', message: 'Please tell me about the next workshop.', consent: 'yes', startedAt: String(Date.now()) });
  if (fast.status !== 422) throw new Error(`fast form returned ${fast.status}`);

  const good = await post({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '9876543210',
    enquiry: 'mental-mastery',
    message: 'Please tell me about the next workshop.',
    consent: 'yes',
    startedAt: String(Date.now() - 5000),
  });
  if (good.status !== 200 || !good.body.ok) throw new Error(`valid form failed ${good.status} ${JSON.stringify(good.body)}`);
  const logged = fs.readFileSync(logFile, 'utf8');
  if (!logged.includes('ada@example.com') || !logged.includes('Mental Mastery workshop')) throw new Error('mail log missing enquiry');

  const trap = await post({
    fullName: 'Spam Bot',
    email: 'spam@example.com',
    phone: '9876543210',
    enquiry: 'general',
    message: 'This should not be delivered to anyone.',
    consent: 'yes',
    startedAt: String(Date.now() - 5000),
    hp_token: 'filled',
  });
  if (trap.status !== 200) throw new Error('honeypot was not absorbed');
  if (fs.readFileSync(logFile, 'utf8').includes('spam@example.com')) throw new Error('honeypot was logged');

  console.log('Holistic Living smoke test passed');
} finally {
  server.kill();
}

async function post(fields) {
  const response = await fetch(`http://127.0.0.1:${port}/api/contact`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function waitFor(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Server did not start.\n${output}`);
}

function testSmtp() {
  return new Promise((resolve, reject) => {
    const messages = [];
    const smtp = net.createServer((socket) => {
      socket.on('error', () => {});
      socket.write('220 test.local ready\r\n');
      let buffer = '';
      let expect = 'command';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        while (buffer.includes('\r\n')) {
          const index = buffer.indexOf('\r\n');
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (expect === 'data') {
            messages.push(line);
            if (line === '.') {
              expect = 'command';
              socket.write('250 queued\r\n');
            }
            continue;
          }
          if (expect === 'user') {
            expect = 'pass';
            socket.write('334 UGFzc3dvcmQ6\r\n');
            continue;
          }
          if (expect === 'pass') {
            expect = 'command';
            socket.write('235 authenticated\r\n');
            continue;
          }
          if (/^EHLO/i.test(line)) socket.write('250-test.local\r\n250 OK\r\n');
          else if (/^AUTH LOGIN/i.test(line)) {
            expect = 'user';
            socket.write('334 VXNlcm5hbWU6\r\n');
          } else if (/^MAIL FROM/i.test(line)) socket.write('250 sender\r\n');
          else if (/^RCPT TO/i.test(line)) socket.write('250 recipient\r\n');
          else if (/^DATA/i.test(line)) {
            expect = 'data';
            socket.write('354 go ahead\r\n');
          } else if (/^QUIT/i.test(line)) socket.write('221 bye\r\n');
          else socket.write('500 unexpected\r\n');
        }
      });
    });
    smtp.listen(0, '127.0.0.1', async () => {
      const address = smtp.address();
      try {
        await sendSmtp({
          host: '127.0.0.1',
          port: address.port,
          secure: false,
          startTls: false,
          user: 'mailer@example.com',
          pass: 'secret',
          from: 'Holistic Living <mailer@example.com>',
          to: 'ecs.sampathkumar@gmail.com',
          replyTo: 'ada@example.com',
          subject: 'Test enquiry',
          text: 'Hello from the form',
          html: '<p>Hello from the form</p>',
        });
        const joined = messages.join('\n');
        if (!joined.includes('Reply-To: ada@example.com') || !joined.includes('Hello from the form')) {
          throw new Error('SMTP message was incomplete');
        }
        smtp.close();
        resolve();
      } catch (error) {
        smtp.close();
        reject(error);
      }
    });
  });
}
