import { readFile, writeFile, mkdir, rm, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'website/dist');
const repository = process.env.GITHUB_REPOSITORY || 'msettles/run-club';
const [owner, repo] = repository.split('/');
const site = new URL(process.env.DOCS_SITE_URL || 'https://' + owner + '.github.io/' + repo + '/');
if (!site.pathname.endsWith('/')) site.pathname += '/';
if (site.protocol !== 'https:') throw new Error('DOCS_SITE_URL must use HTTPS.');
const base = site.pathname;
const sourceUrl = 'https://github.com/' + repository;
// Only these files are published. Audits, data, app builds and private files are excluded.
const pages = [
  ['website/pages/index.md', '', 'Run Club — The Running Club Toolkit', 'Schedules, attendance, routes and milestones for running clubs. Explore the app, help guides and the path to a reusable running-club setup.', 'Home'],
  ['website/pages/features.md', 'features/', 'Features', 'Explore runner check-in, routes, personal history, staff Table Mode, attendance and milestone tools.', 'Features'],
  ['website/pages/help.md', 'help/', 'Help and guides', 'Practical help for runners, organizers and club admins, with answers to common app questions.', 'Help'],
  ['website/pages/setup.md', 'setup/', 'Set up your club', 'Explore local development, club ownership and deployment requirements for your own Run Club copy.', 'Setup'],
  ['website/pages/roadmap.md', 'roadmap/', 'A gradual roadmap', 'The plan for reusable running-club configuration, a Woodland fork, a fictional demo and optional project support.', 'Roadmap'],
  ['docs/help/runner-guide.md', 'help/runners/', 'Runner guide', 'Join, sign in, RSVP, check in, view My Runs, claim historical attendance and install the club app.', 'Help'],
  ['docs/help/organizer-guide.md', 'help/organizers/', 'Organizer and admin guide', 'Schedule runs, manage routes, run the table, assist check-ins and hand out milestone gear.', 'Help'],
  ['docs/help/troubleshooting.md', 'help/troubleshooting/', 'Troubleshooting and FAQ', 'Answers about sign-in, check-in, history, maps, notifications, app updates and social posting.', 'Help'],
  ['docs/roles-and-permissions.md', 'help/permissions/', 'Roles and permissions', 'What guests, runners, organizers and admins can see and change in the current club app.', 'Help'],
  ['setup.md', 'setup/deployment/', 'Setup and deployment', 'Configure, validate and deploy a club copy with matching hosting, security rules and active server functions.', 'Setup'],
  ['docs/new-club-setup.md', 'setup/new-club/', 'New club setup', 'Current manual steps for adapting the Run Club application for a separate club.', 'Setup'],
].map(([source, route, title, description, nav]) => ({ source, route, title, description, nav }));
if (new Set(pages.map(p => p.route)).size !== pages.length || new Set(pages.map(p => p.title)).size !== pages.length) throw new Error('Page routes and titles must be unique.');
if (pages.some(p => !p.description.trim())) throw new Error('Every page needs a search description.');
const bySource = new Map(pages.map(p => [p.source, p]));
const escape = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const linkFor = page => base + page.route;

function rewriteLink(href, source) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const match = href.match(/^([^?#]*)(.*)$/);
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), match[1]));
  if (relative.startsWith('../') || relative.startsWith('/')) throw new Error('Out-of-repository link: ' + href);
  const target = bySource.get(relative);
  return (target ? linkFor(target) : sourceUrl + '/blob/main/' + relative) + match[2];
}

function renderMarkdown(markdown, source) {
  const seen = new Map();
  const marked = new Marked({ gfm: true, renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const slug = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
      const count = seen.get(slug) || 0; seen.set(slug, count + 1);
      return '<h' + depth + ' id="' + slug + (count ? '-' + count : '') + '">' + text + '</h' + depth + '>\n';
    },
  }});
  return marked.parse(markdown).replace(/href="([^"]*)"/g, (_, href) => 'href="' + escape(rewriteLink(href.replaceAll('&amp;', '&'), source)) + '"');
}

function layout(page, content, notFound = false) {
  const title = page.route ? page.title + ' | Run Club' : page.title;
  const nav = pages.slice(0, 5).map(p => '<a href="' + linkFor(p) + '"' + (page.nav === p.nav ? ' aria-current="page"' : '') + '>' + p.nav + '</a>').join('');
  const canonical = new URL(page.route, site).href;
  const structured = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Run Club', url: site.href, description: pages[0].description }).replaceAll('<', '\\u003c');
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escape(title) + '</title><meta name="description" content="' + escape(page.description) + '">',
    '<meta name="theme-color" content="#174c48"><meta name="robots" content="' + (notFound ? 'noindex,follow' : 'index,follow') + '">',
    '<link rel="canonical" href="' + canonical + '"><link rel="icon" type="image/png" href="' + base + 'assets/runclub-icon.png">',
    '<meta property="og:type" content="website"><meta property="og:title" content="' + escape(title) + '"><meta property="og:description" content="' + escape(page.description) + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + new URL('assets/runclub.png', site).href + '">',
    '<meta name="twitter:card" content="summary"><link rel="stylesheet" href="' + base + 'assets/site.css"><script type="application/ld+json">' + structured + '</script></head>',
    '<body><a class="skip-link" href="#main">Skip to content</a>',
    '<header class="site-header"><div class="header-inner"><a class="brand" href="' + base + '" aria-label="Run Club home"><img src="' + base + 'assets/runclub-icon.png" width="36" height="36" alt=""><span>Run Club<span class="brand-note">The Running Club Toolkit</span></span></a><nav aria-label="Main navigation">' + nav + '</nav><a class="source-link" href="' + sourceUrl + '">GitHub <span aria-hidden="true">↗</span></a></div></header>',
    '<main id="main" tabindex="-1" class="' + (page.route ? 'document' : 'home') + '">',
    page.route ? '<div class="page-context"><a href="' + base + '">Run Club</a><span aria-hidden="true">/</span><span>' + escape(page.nav || page.title) + '</span></div>' : '<p class="eyebrow">BUILT FOR RUNNING CLUBS. SHAPED BY RUN NIGHT.</p>',
    content,
    page.route ? '<aside class="page-end"><a href="' + sourceUrl + '/blob/main/' + (page.source || 'website/README.md') + '">View this page’s source ↗</a><a href="' + base + 'help/">Help and guides →</a></aside>' : '',
    '</main><footer><div class="footer-top"><a class="brand" href="' + base + '">Run Club</a><p>Made for the people who keep running clubs going.</p><a href="' + sourceUrl + '">Source on GitHub ↗</a></div>',
    '<div class="footer-bottom"><span>© 2026 Matt Settles · <a href="' + sourceUrl + '/blob/main/LICENSE">PolyForm Noncommercial 1.0.0</a></span><a href="' + base + 'roadmap/#support-development-todo">Project support: Ko-fi planned</a><span>Static documentation · No analytics or login</span></div></footer></body></html>',
  ].join('\n');
}

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'assets'), { recursive: true });
for (const asset of ['runclub.png', 'runclub-icon.png']) await copyFile(path.join(root, 'public', asset), path.join(out, 'assets', asset));
await copyFile(path.join(root, 'website/assets/site.css'), path.join(out, 'assets/site.css'));
const htmlPages = [];
for (const page of pages) {
  const html = layout(page, renderMarkdown(await readFile(path.join(root, page.source), 'utf8'), page.source));
  const target = path.join(out, page.route, 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
  htmlPages.push({ ...page, html });
}
const missing = { route: '404.html', title: 'Page not found', description: 'This documentation page could not be found.', nav: '' };
await writeFile(path.join(out, '404.html'), layout(missing, '<h1>Looks like a wrong turn.</h1><p>This page has moved or does not exist. <a href="' + base + '">Return to Run Club</a> or <a href="' + base + 'help/">find a guide</a>.</p>', true));
await writeFile(path.join(out, '.nojekyll'), '');
await writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + new URL('sitemap.xml', site).href + '\n');
await writeFile(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(p => '  <url><loc>' + escape(new URL(p.route, site).href) + '</loc></url>').join('\n') + '\n</urlset>\n');

// Validate generated links and fragments at the real project subpath.
for (const page of htmlPages) {
  if ((page.html.match(/<h1\b/g) || []).length !== 1) throw new Error(page.source + ': expected one h1');
  for (const [, href] of page.html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const url = new URL(href.replaceAll('&amp;', '&'), new URL(page.route, site));
    if (url.origin !== site.origin) continue;
    if (!url.pathname.startsWith(base)) throw new Error('Wrong base path: ' + href);
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    const target = path.join(out, relative, url.pathname.endsWith('/') ? 'index.html' : '');
    if (!(await stat(target).catch(() => null))?.isFile()) throw new Error(page.source + ': missing target ' + href);
    if (url.hash && !(await readFile(target, 'utf8')).includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"')) throw new Error(page.source + ': missing fragment ' + href);
  }
}
console.log('Built and checked ' + pages.length + ' static pages for ' + site.href);
console.log('Only manifest-listed guides, project pages and approved platform assets are published.');
