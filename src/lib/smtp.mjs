import net from 'node:net';
import tls from 'node:tls';

export function sendSmtp({ host, port, secure, user, pass, from, to, replyTo, subject, text, html, messageDomain = 'website' }) {
  const numericPort = Number(port || (secure ? 465 : 587));
  const implicitTls = secure === true || secure === 'true' || numericPort === 465;
  const useStartTls = !implicitTls && arguments[0].startTls !== false;
  const message = buildMessage({ from, to, replyTo, subject, text, html, messageDomain });
  const envelopeFrom = addressOnly(from);
  const recipients = String(to)
    .split(',')
    .map((item) => addressOnly(item))
    .filter(Boolean);

  return new Promise((resolve, reject) => {
    let socket = implicitTls
      ? tls.connect({ host, port: numericPort, servername: host })
      : net.connect({ host, port: numericPort });
    let buffer = '';
    let stage = 'greeting';
    let settled = false;
    const timer = setTimeout(() => finish(new Error('SMTP timed out')), 20000);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeListener('error', onError);
      socket.end();
      if (error) reject(error);
      else resolve();
    }

    function onError(error) {
      finish(error);
    }

    function send(line) {
      socket.write(`${line}\r\n`);
    }

    function upgrade() {
      socket.removeListener('data', onData);
      const plain = socket;
      socket = tls.connect({ socket: plain, host, servername: host });
      socket.on('error', onError);
      socket.once('secureConnect', () => {
        socket.on('data', onData);
        send(`EHLO ${host}`);
      });
    }

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      let end = buffer.lastIndexOf('\n');
      if (end === -1) return;
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      const lines = block.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3));
      next(code, last);
    }

    function next(code, line) {
      if (code >= 400) {
        finish(new Error(`SMTP ${code}`));
        return;
      }
      if (stage === 'greeting') {
        stage = 'ehlo';
        send(`EHLO ${host}`);
        return;
      }
      if (stage === 'ehlo') {
        if (useStartTls) {
          stage = 'starttls';
          send('STARTTLS');
          return;
        }
        return auth();
      }
      if (stage === 'starttls') {
        stage = 'ehlo-tls';
        upgrade();
        return;
      }
      if (stage === 'ehlo-tls') return auth();
      if (stage === 'auth') {
        stage = 'user';
        send(Buffer.from(user).toString('base64'));
        return;
      }
      if (stage === 'user') {
        stage = 'pass';
        send(Buffer.from(pass || '').toString('base64'));
        return;
      }
      if (stage === 'pass') return mailFrom();
      if (stage === 'from') {
        stage = 'rcpt';
        recipientIndex = 0;
        send(`RCPT TO:<${recipients[0]}>`);
        return;
      }
      if (stage === 'rcpt') {
        recipientIndex += 1;
        if (recipientIndex < recipients.length) {
          send(`RCPT TO:<${recipients[recipientIndex]}>`);
          return;
        }
        stage = 'data';
        send('DATA');
        return;
      }
      if (stage === 'data') {
        stage = 'sent';
        socket.write(`${message}\r\n.\r\n`);
        return;
      }
      if (stage === 'sent') {
        stage = 'quit';
        send('QUIT');
        finish();
      }
    }

    let recipientIndex = 0;

    function auth() {
      if (user) {
        stage = 'auth';
        send('AUTH LOGIN');
        return;
      }
      return mailFrom();
    }

    function mailFrom() {
      stage = 'from';
      send(`MAIL FROM:<${envelopeFrom}>`);
    }

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function addressOnly(value) {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : String(value)).trim();
}

function buildMessage({ from, to, replyTo, subject, text, html, messageDomain }) {
  const boundary = `msg_${Date.now().toString(36)}`;
  const headers = [
    `From: ${header(from)}`,
    `To: ${header(to)}`,
    `Reply-To: ${header(replyTo)}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${boundary}@${messageDomain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}`.replace(/^\./gm, '..');
}

function dotStuff(value) {
  return String(value).replace(/\r?\n/g, '\r\n');
}

function header(value) {
  return String(value).replace(/[\r\n]/g, ' ').trim();
}

function encodeSubject(subject) {
  const clean = header(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}
