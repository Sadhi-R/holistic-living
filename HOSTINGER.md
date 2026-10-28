# Deploy Holistic Living on Hostinger

This site needs a Node.js process. The contact form sends email from the server. Uploading only the HTML to shared hosting will show the pages and will not send mail.

Use one of these:

- Hostinger web hosting that includes a Node.js app in hPanel (often the Business or Cloud plans)
- A Hostinger VPS

Check the plan before you buy. If the plan has only PHP and no Node.js, this project will not send enquiries there.

## 1. Domain and DNS

The domain is not set in the code. Choose it, then set `PUBLIC_SITE_URL` to that origin, including `https://`, with no path and no trailing slash.

In the domain registrar, either:

- change the nameservers to the pair Hostinger shows in hPanel, or
- add an A record for `@` and `www` to the IP address Hostinger gives you

Wait until the domain resolves to Hostinger before you test the form. DNS can take from a few minutes to 24 hours.

## 2. HTTPS

In hPanel, open SSL for the domain and install the free certificate. Turn on force HTTPS if that option is shown. The Node app should sit behind Hostinger’s HTTPS proxy. You do not need to put certificate files in this project unless you terminate TLS inside Node yourself (`SERVER_CERT_PATH` and `SERVER_KEY_PATH` are supported by the server only if you add that yourself; the current server does not read those).

Open the site as `https://` and confirm the browser shows a lock before you ask anyone to submit the form.

## 3. Upload the application

Upload this folder. Do not upload `node_modules`, `.env`, or `storage`.

From the application directory on the server:

```
node build.mjs
```

There is nothing to `npm install` unless you want npm to confirm the package file. The site does not depend on packages.

## 4. Node.js app settings

In hPanel, create a Node.js application:

- Node.js version: 20 or 22
- Application root: the folder you uploaded
- Startup file: `server.mjs`
- Application URL: the domain or subdomain for Holistic Living

Hostinger sets `PORT`. `server.mjs` listens on `process.env.PORT` and `0.0.0.0`.

Add the environment variables from `.env.example` in the hPanel environment screen, not in a file that can be downloaded:

- `PUBLIC_SITE_URL` = `https://your-domain`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CONTACT_TO` = `ecs.sampathkumar@gmail.com`
- Leave `MAIL_DRIVER` empty

Build after `PUBLIC_SITE_URL` is set, so the sitemap and canonical URLs match the domain:

```
node build.mjs
```

Restart the Node.js app from hPanel.

## 5. Email on the server

For the Gmail address `ecs.sampathkumar@gmail.com`:

1. Turn on 2-step verification on that Google account.
2. Create an app password.
3. Use host `smtp.gmail.com`, port `465`, `SMTP_SECURE=true`.
4. Set `SMTP_USER` to that Gmail address and `SMTP_PASS` to the app password.
5. Set `SMTP_FROM` to `Holistic Living <ecs.sampathkumar@gmail.com>` only if Google allows that account to send as itself.

A Hostinger mailbox can be used instead. In hPanel, create the mailbox, then use the SMTP host, port, and username Hostinger shows for that mailbox. The From address must be that mailbox. Keep `CONTACT_TO` as `ecs.sampathkumar@gmail.com` if that is still the inbox that should receive enquiries, or point `CONTACT_TO` at the Hostinger mailbox and forward it.

## 6. Check the live site

- Open `/`, `/about`, `/programs`, `/programs/mental-mastery`, `/programs/gratitude-journal`, `/gallery`, `/contact`, and each policy page.
- Confirm the phone is +91 79810 88978, WhatsApp is +91 80960 80360, and the email is ecs.sampathkumar@gmail.com.
- Submit the form with a bad email and confirm the message stays on the page.
- Submit a real test enquiry from an address you control.
- Confirm the message arrives at `CONTACT_TO` and that Reply goes to the test address.
- Open `/sitemap.xml` and check that every URL uses the live domain.

Until that test message arrives, email delivery is not confirmed.

## 7. Later updates

1. Upload the changed files.
2. If page copy changed, run `node build.mjs` again on the server.
3. Restart the Node.js app in hPanel.
4. Reload a page and submit one test enquiry.

## 8. When something fails

**The build prints that `PUBLIC_SITE_URL` is still local.**  
Set the live domain in the server environment and run `node build.mjs` again.

**Pages show 404 for every route.**  
The startup directory is not the folder that contains `dist`. Run the build in the application root and restart.

**The form says mail is not configured.**  
`SMTP_HOST`, `SMTP_USER`, `SMTP_FROM`, or `CONTACT_TO` is missing, or `MAIL_DRIVER=log` was left on a public server. `log` only writes a local file. Fix the variables and restart.

**The form says it could not send, and the variables are set.**  
Read the Node.js log in hPanel. Gmail rejects normal account passwords; use an app password. Port 465 needs `SMTP_SECURE=true`. The From address must belong to the authenticated mailbox.

**The domain does not open.**  
Check the A record or nameservers. Hostinger’s proxy must point at this Node app, not at an empty `public_html`.

**HTTPS fails.**  
Install the certificate after DNS points at Hostinger, then wait and request it again.

**Another site’s phone or email appears.**  
This project’s details live in `src/config.mjs`. Business Startup School is a separate folder and a separate Node.js app. Do not share one `dist` folder or one environment between them.
