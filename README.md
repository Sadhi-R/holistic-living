# Holistic Living

The website for Holistic Living Mental Mastery, the NLP-based workshops led by Sampath Kumar, Growth Mindset Mentor.

The site is a small Node.js application. It has no npm dependencies. Node.js 20 or newer builds the pages and serves them, including the contact form.

## What the site includes

- Home, about, programmes, workshop detail, gratitude journal, gallery, and contact
- Privacy policy, terms, disclaimer, and cancellation, refund, and rescheduling
- A contact form with client and server validation, a spam honeypot, a short wait before submit, and a limit of 10 submissions an hour for each IP address
- Server-side email, with the visitor’s address set as Reply-To
- Poppins, self-hosted
- A sitemap, robots.txt, canonical URLs, and Open Graph tags

October 2026 workshop dates are shown as sessions that have already been held. The site does not invent a future date, testimonials, or the brochure’s “1000+ people trained”, “psychologist”, and “NLP practitioner” lines. Those brochure lines are listed under [Still needed](#still-needed).

## Contact details on this site

- Phone: +91 79810 88978
- WhatsApp: +91 80960 80360
- Email: ecs.sampathkumar@gmail.com

## Local setup

1. Install Node.js 20 or newer.
2. In this folder, copy the environment file:

```
copy .env.example .env
```

3. For a local test that does not send real email, set this in `.env`:

```
MAIL_DRIVER=log
```

4. Build and start:

```
node build.mjs
node server.mjs
```

Open http://localhost:4321

`node scripts/smoke.mjs` builds the site, checks the pages, and submits valid and invalid forms. With `MAIL_DRIVER=log`, a successful enquiry is appended to `storage/mail.log`. That file is not committed.

## Email

Real delivery is not switched on until SMTP settings are present and a test message arrives.

Set these in the server environment, not in the pages:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Live origin, such as `https://example.com`, with no path |
| `SMTP_HOST` | For Gmail, `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` for port 465 |
| `SMTP_USER` | The mailbox that is allowed to send |
| `SMTP_PASS` | An app password or provider secret. Never commit this. |
| `SMTP_FROM` | A verified From address, for example `Holistic Living <ecs.sampathkumar@gmail.com>` |
| `CONTACT_TO` | `ecs.sampathkumar@gmail.com` |
| `MAIL_DRIVER` | Leave empty in production. Use `log` only on a private machine. |

Gmail accounts with 2-step verification need an app password. The From address must be one the provider will let that account send as. The visitor’s email is Reply-To, not From.

A local SMTP conversation was tested against a fake server. A message was not sent to `ecs.sampathkumar@gmail.com`, because no mailbox password was available. Do not describe the form as delivering mail until you submit the live form and see the message arrive.

If the variables are missing, the form returns a clear error and does not pretend the enquiry was sent. The phone, WhatsApp, and email links still work.

## Production build

Set `PUBLIC_SITE_URL` to the real domain, then run `node build.mjs`. Canonical links, the sitemap, and robots.txt use that value. Leave `MAIL_DRIVER` unset on the server.

Deployment steps are in [HOSTINGER.md](HOSTINGER.md).

## Still needed

- The live domain name
- An SMTP app password or other sending credential for `ecs.sampathkumar@gmail.com`
- Confirmation, if you want them published, of the brochure lines “NLP practitioner”, “psychologist”, and “1000+ people trained”
- The registered business name, address, and tax registration, if they should appear on the legal pages
- Official social profile URLs. None were found in the project files, so none are shown. Add them in `src/config.mjs` under `socials`, as `{ label, href }`, then rebuild
- Any future workshop date, and the written fee and refund window if a later session is paid
- Whether a copy of *The Ultimate Gratitude Journal* should be offered, and on what terms. The full journal is not published here
