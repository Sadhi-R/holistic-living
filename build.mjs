import fs from 'node:fs';
import path from 'node:path';
import { site } from './src/config.mjs';
import { loadEnv } from './src/lib/env.mjs';

loadEnv();

const siteUrl = (process.env.PUBLIC_SITE_URL || `http://localhost:${site.defaultPort}`).replace(/\/$/, '');
const root = process.cwd();
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
copyDir(path.join(root, 'public'), dist);

const contentDir = path.join(root, 'src', 'content');
const pages = fs
  .readdirSync(contentDir)
  .filter((file) => file.endsWith('.html'))
  .map((file) => parsePage(fs.readFileSync(path.join(contentDir, file), 'utf8')));

for (const page of pages) {
  const html = renderPage(page);
  const out = page.path === '/404' ? path.join(dist, '404.html') : pagePath(page.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

const urls = pages
  .filter((page) => page.path !== '/404')
  .map((page) => `${siteUrl}${page.path === '/' ? '/' : page.path}`);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap(urls));
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log(`Built ${pages.length} pages for ${siteUrl}`);
if (siteUrl.includes('localhost')) {
  console.log('PUBLIC_SITE_URL is still the local address. Set the live domain and build again before deployment.');
}

function pagePath(urlPath) {
  if (urlPath === '/') return path.join(dist, 'index.html');
  return path.join(dist, urlPath.replace(/^\//, ''), 'index.html');
}

function parsePage(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('A content file is missing front matter.');
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index < 1) continue;
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return {
    title: fill(meta.title || site.name),
    description: fill(meta.description || site.description),
    path: meta.path || '/',
    image: meta.image || '/images/peace.jpg',
    body: fill(match[2].trim()),
  };
}

function fill(value) {
  return value
    .replaceAll('{{name}}', site.name)
    .replaceAll('{{phone}}', site.phoneDisplay)
    .replaceAll('{{phoneTel}}', site.phoneTel)
    .replaceAll('{{whatsapp}}', site.whatsappDisplay)
    .replaceAll('{{whatsappUrl}}', site.whatsappUrl)
    .replaceAll('{{email}}', site.email)
    .replaceAll('{{mentor}}', site.mentor)
    .replaceAll('{{role}}', site.mentorRole)
    .replaceAll('{{contactIcons}}', contactIcons());
}

function renderPage(page) {
  const canonical = `${siteUrl}${page.path === '/' ? '/' : page.path}`;
  const image = new URL(page.image, `${siteUrl}/`).href;
  const nav = site.nav
    .map(
      (item) =>
        `<a href="${item.href}"${item.href === page.path ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`,
    )
    .join('');
  const explore = site.explore.map((item) => `<li><a href="${item.href}">${escapeHtml(item.label)}</a></li>`).join('');
  const legal = site.legal.map((item) => `<li><a href="${item.href}">${escapeHtml(item.label)}</a></li>`).join('');
  const socials = site.socials.length
    ? `<ul aria-label="Social media">${site.socials
        .map((item) => `<li><a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a></li>`)
        .join('')}</ul>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="robots" content="${page.path === '/404' ? 'noindex' : 'index,follow'}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="${site.locale}" />
  <meta property="og:site_name" content="${escapeHtml(site.name)}" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <meta name="theme-color" content="${site.themeColor}" />
  <link rel="stylesheet" href="/fonts/poppins.css" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="${escapeHtml(site.name)} home">
        ${site.logoHtml}
        ${site.showWordmark === false ? '' : `<span><strong>${escapeHtml(site.name)}</strong><small>${escapeHtml(site.tagline)}</small></span>`}
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="nav" aria-label="Primary">
        ${nav}
      </nav>
    </div>
  </header>
  <main id="main">
    ${page.body}
  </main>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <a class="brand" href="/"${site.showWordmark === false ? ` aria-label="${escapeHtml(site.name)} home"` : ''}>${site.logoHtml}${site.showWordmark === false ? '' : `<span><strong>${escapeHtml(site.name)}</strong><small>${escapeHtml(site.tagline)}</small></span>`}</a>
        <p>${escapeHtml(site.footerBlurb)}</p>
      </div>
      <div><h2>Explore</h2><ul>${explore}</ul></div>
      <div><h2>Policies</h2><ul>${legal}</ul></div>
      <div>
        <h2>Contact</h2>
        ${contactIcons()}
        ${socials}
      </div>
    </div>
    <div class="wrap legal-row">
      <p>© <span id="year"></span> ${escapeHtml(site.name)}. ${escapeHtml(site.footerNote)}</p>
    </div>
  </footer>
  <script src="/js/site.js" defer></script>
</body>
</html>`;
}

function sitemap(urls) {
  const body = urls
    .map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function contactIcons() {
  return `<div class="contact-icons" aria-label="Contact">
  <a class="contact-icon" href="tel:${site.phoneTel}" aria-label="Call ${escapeHtml(site.phoneDisplay)}" title="Call">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>
  </a>
  <a class="contact-icon" href="${site.whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp ${escapeHtml(site.whatsappDisplay)}" title="WhatsApp">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm0 18a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 1 1 12 20zm4.5-6.1c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4 0-.1 0-.3-.1-.4-.1-.1-.5-1.3-.7-1.8-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.2 1.6 2.5 3.9 3.5 2.3 1 2.3.7 2.7.7.4 0 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.2-.4-.3z"/></svg>
  </a>
  <a class="contact-icon" href="mailto:${site.email}" aria-label="Email ${escapeHtml(site.email)}" title="Email">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/></svg>
  </a>
</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}
