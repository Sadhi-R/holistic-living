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
    .replaceAll('{{role}}', site.mentorRole);
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
        <a class="btn btn-solid" href="/contact">Enquire</a>
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
        <ul>
          <li><a href="tel:${site.phoneTel}">Call ${escapeHtml(site.phoneDisplay)}</a></li>
          <li><a href="${site.whatsappUrl}" target="_blank" rel="noopener noreferrer">WhatsApp ${escapeHtml(site.whatsappDisplay)}</a></li>
          <li><a href="mailto:${site.email}">${escapeHtml(site.email)}</a></li>
        </ul>
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
