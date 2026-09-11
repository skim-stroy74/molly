/* Прописывает адрес сайта во все страницы разом.

   Зачем: адрес повторяется в каждой странице трижды — canonical, og:url
   и картинка превью. Руками их правят с ошибками, а битый og:image
   означает, что ссылка в ВК разворачивается без картинки.

   Пока сайт живёт на чужом адресе — он черновик: закрыт от поисковиков.
   Когда появится свой домен, та же команда с ключом --live откроет его
   для индексации и соберёт карту сайта.

   Черновик:  node tools/set-domain.js https://skim174.ru/molly/
   Сдача:     node tools/set-domain.js https://molly-mgn.com/ --live   */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const base = (process.argv[2] || '').trim();
const live = process.argv.includes('--live');

if (!/^https?:\/\/[^\s]+$/.test(base)) {
  console.error('Укажите адрес целиком, например:');
  console.error('  node tools/set-domain.js https://skim174.ru/molly/');
  process.exit(1);
}

const home = base.endsWith('/') ? base : base + '/';
/* тот же адрес без протокола — так его пишут в тексте политики */
const site = home.replace(/^https?:\/\//, '').replace(/\/$/, '');

/* служебные страницы: адрес им прописываем, в карту сайта не кладём */
const SKIP_IN_SITEMAP = ['priglashenie.html'];

const DRAFT_MARK = '<!-- ЧЕРНОВИК: снять перед сдачей -->';
const NOINDEX = '<meta name="robots" content="noindex, nofollow">';

const pages = fs.readdirSync(root).filter(f => f.endsWith('.html')).sort();
if (!pages.length) { console.error('Страниц не найдено'); process.exit(1); }

let touched = 0;

for (const page of pages) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, 'utf8');
  let html = before;

  /* адрес самой страницы: главная живёт по короткому адресу */
  const url = page === 'index.html' ? home : home + page;

  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/g, '$1' + url + '$2');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/g, '$1' + url + '$2');
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/g,
                      '$1' + home + 'images/og-image.jpg$2');

  /* сведения о заведении для поисковиков — там те же адреса */
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, block => block
    .replace(/("url":\s*")[^"]*(")/, '$1' + home + '$2')
    .replace(/("hasMenu":\s*")[^"]*(")/, '$1' + home + '#menu$2')
    .replace(/("logo":\s*")[^"]*(")/, '$1' + home + 'images/logo.png$2')
    .replace(/("image":\s*")[^"]*(")/, '$1' + home + 'images/og-image.jpg$2'));

  /* адрес сайта в тексте политики конфиденциальности */
  html = html.replace(/(<b data-site>)[^<]*(<\/b>)/g, '$1' + site + '$2');

  /* черновик прячем от поисковиков, готовый сайт открываем */
  const hasNoindex = html.includes(NOINDEX);
  if (live && hasNoindex) {
    html = html.replace(/[ \t]*<!--\s*ЧЕРНОВИК[\s\S]*?-->\r?\n/g, '');
    html = html.replace(new RegExp('[ \\t]*' + NOINDEX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\r?\\n', 'g'), '');
  } else if (!live && !hasNoindex) {
    html = html.replace(/(<link rel="canonical"[^>]*>\r?\n)/,
                        '$1' + DRAFT_MARK + '\n' + NOINDEX + '\n');
  }

  if (html !== before) { fs.writeFileSync(file, html, 'utf8'); touched++; }
  console.log('  ' + page.padEnd(20) + url);
}

/* ---------- правила для поисковых роботов ---------- */
fs.writeFileSync(path.join(root, 'robots.txt'),
  live
    ? 'User-agent: *\nAllow: /\n\nSitemap: ' + home + 'sitemap.xml\n'
    : 'User-agent: *\nDisallow: /\n',
  'utf8');

/* ---------- карта сайта ---------- */
const sitemapPath = path.join(root, 'sitemap.xml');
if (live) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = pages
    .filter(p => !SKIP_IN_SITEMAP.includes(p))
    .map(p => {
      const url = p === 'index.html' ? home : home + p;
      const weight = p === 'index.html' ? '1.0' : (p === 'politika.html' ? '0.3' : '0.8');
      return '  <url>\n    <loc>' + url + '</loc>\n    <lastmod>' + today +
             '</lastmod>\n    <priority>' + weight + '</priority>\n  </url>';
    });
  fs.writeFileSync(sitemapPath,
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.join('\n') + '\n</urlset>\n', 'utf8');
} else if (fs.existsSync(sitemapPath)) {
  fs.unlinkSync(sitemapPath);
}

console.log('');
console.log(live ? 'Режим: боевой — сайт открыт для поисковиков, карта сайта собрана.'
                 : 'Режим: черновик — сайт закрыт от поисковиков.');
console.log('Страниц обновлено: ' + touched + ' из ' + pages.length + '.');
