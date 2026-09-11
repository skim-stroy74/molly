/* Собирает базу знаний для помощницы из самого сайта.
   Смысл: данные живут в одном месте — в разметке. Поменяли цену в меню,
   пересобрали файл, и нейросеть отвечает новой ценой. Расходиться нечему.

   Запуск:  node tools/build-knowledge.js
   Результат: data/knowledge.txt */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
                    .replace(/&laquo;|&raquo;/g, '"').replace(/&mdash;/g, '—')
                    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const index = read('index.html');
const afisha = read('afisha.html');
const out = [];

out.push('СПРАВОЧНИК ПАБА «МОЛЛИ». Только эти сведения считаются достоверными.');
out.push('');

/* ---------- общее ---------- */
out.push('== ЗАВЕДЕНИЕ ==');
out.push('Название: Irish Pub Molly, «Паб Молли». Ирландский паб.');
out.push('Адрес: Магнитогорск, улица Завенягина, 8а, 2 этаж.');
out.push('Телефон: +7 (3519) 45-37-37.');
out.push('ВКонтакте: vk.com/molly174. Других соцсетей нет.');
out.push('Возрастное ограничение: 18+.');
out.push('Что есть внутри: зал с деревянной мебелью и витражами, барная стойка,');
out.push('музыкальная сцена, танцпол, зал караоке, отдельные VIP-комнаты.');
out.push('');

out.push('== ЧАСЫ РАБОТЫ ==');
out.push('Понедельник — четверг: с 18:00 до 02:00.');
out.push('Пятница и суббота: с 18:00 до 05:00.');
out.push('Воскресенье: с 18:00 до 02:00.');
out.push('Выходных дней нет, работаем ежедневно. Открытие всегда в 18:00.');
out.push('');

out.push('== ПРОГРАММА ==');
out.push('Живая музыка и диджей — по выходным (пятница и суббота), не каждый день.');
out.push('Резиденты: DJ Skimmi, DJ Zarya, MC Rahmat.');
out.push('По выходным работает ведущий и развлекательная анимация.');
out.push('');

/* ---------- меню ---------- */
const menuGroups = [];
const sideRe = /<div class="menu-side[^"]*" data-side="([^"]+)"[\s\S]*?(?=<div class="menu-side|<div class="shot shot-wide rv")/g;
let sm;
while ((sm = sideRe.exec(index))) {
  const side = sm[1];
  const groupRe = /<div class="mgroup">\s*<h3>([^<]+)<\/h3>([\s\S]*?)<\/ul>/g;
  let gm;
  while ((gm = groupRe.exec(sm[0]))) {
    const title = gm[1].trim();
    const items = [];
    const itemRe = /<li class="mi">([\s\S]*?)<\/li>/g;
    let im;
    while ((im = itemRe.exec(gm[2]))) {
      const name = (im[1].match(/<span class="mi-name">([^<]*)<\/span>/) || [])[1];
      const price = (im[1].match(/<span class="mi-price">([^<]*)<\/span>/) || [])[1];
      const desc = (im[1].match(/<p class="mi-desc">([\s\S]*?)<\/p>/) || [])[1];
      if (!name) continue;
      items.push('- ' + strip(name) + ' — ' + strip(price || '') + (desc ? '. ' + strip(desc) : ''));
    }
    if (items.length) menuGroups.push({ side, title, items });
  }
}
out.push('== МЕНЮ (цены в рублях) ==');
for (const g of menuGroups) {
  out.push('-- ' + g.title + (g.side === 'bar' ? ' (бар)' : '') + ' --');
  out.push(...g.items);
}
out.push('Кухни: европейская, гриль, итальянская (пицца и паста), азиатская.');
out.push('Суши и роллов НЕТ. Ирландских блюд в меню НЕТ.');
out.push('Есть ли бизнес-ланчи и детское меню — неизвестно, надо уточнять по телефону.');
out.push('');

/* ---------- банкеты ---------- */
out.push('== БАНКЕТЫ ==');
out.push('Банкетное меню: 2500 руб. с человека.');
out.push('Имениннику и компании от 10 человек скидка 10% при оплате наличными');
out.push('или 5% по карте — со скидкой выходит 2250 руб. с человека.');
out.push('В банкетное меню входят: общие закуски, закуска на персону,');
out.push('один салат на выбор и одно горячее на выбор.');
out.push('При заказе банкета: скидка 50% на вход в караоке и на танцпол,');
out.push('скидка 50% на горячие напитки, безалкогольные напитки 150 руб. за литр,');
out.push('можно принести свой крепкий алкоголь, свой торт и фрукты.');
out.push('Проводим дни рождения, корпоративы, выпускные, встречи выпускников.');
out.push('Вместимость зала и минимальная сумма заказа — неизвестны, уточнять по телефону.');
out.push('');

/* ---------- акции ---------- */
out.push('== ПОСТОЯННЫЕ АКЦИИ ==');
out.push('Свой алкоголь: закажите по меню на 1000 руб. на человека — и приносите свои напитки.');
out.push('Именинникам: скидка 10% на меню при оплате наличными, 5% по карте.');
out.push('То же для компаний от 10 человек.');
out.push('Важно: скидки и акции не суммируются и не действуют в праздничные и концертные дни.');
out.push('');

/* ---------- афиша ---------- */
out.push('== АФИША ==');
const evRe = /<article class="bill-item" data-from="([\d-]+)" data-until="([\d-]+)">([\s\S]*?)<\/article>/g;
let ev;
while ((ev = evRe.exec(afisha))) {
  const date = (ev[3].match(/<span class="bill-date"><b>([^<]*)<\/b>/) || [])[1];
  const name = (ev[3].match(/<h3>([^<]*)<\/h3>/) || [])[1];
  const desc = (ev[3].match(/<p class="bill-desc">([\s\S]*?)<\/p>/) || [])[1];
  const facts = [...ev[3].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m => strip(m[1]));
  out.push('- ' + strip(date || '') + ' (' + ev[1] + '): ' + strip(name || ''));
  if (desc) out.push('  ' + strip(desc));
  if (facts.length) out.push('  ' + facts.join('; '));
}
out.push('Двери всегда открываются в 18:00.');
out.push('Вход на вечеринки платный, но КОНКРЕТНАЯ СУММА НЕИЗВЕСТНА — говори честно,');
out.push('что не знаешь, и отправляй звонить по телефону.');
out.push('');

/* ---------- бронь ---------- */
out.push('== БРОНИРОВАНИЕ ==');
out.push('Способы: по телефону +7 (3519) 45-37-37; во ВКонтакте vk.com/molly174;');
out.push('онлайн на 416936.restoplace.ws.');
out.push('На выходные и концерты советуй бронировать заранее — зал заполняется быстро.');
out.push('');

/* ---------- чего мы не знаем ---------- */
out.push('== ЧЕГО МЫ НЕ ЗНАЕМ (отвечай честно «не знаю» и отправляй звонить) ==');
out.push('Парковка, наличие Wi-Fi, дресс-код, можно ли с детьми, доставка еды,');
out.push('вместимость зала, минимальная сумма банкета, стоимость входа на вечеринки,');
out.push('вакансии, наличие кальянов, программа на ноябрь и позже.');

/* ---------- меню машинным видом: для калькулятора вечера ---------- */
if (!fs.existsSync(path.join(root, 'data'))) fs.mkdirSync(path.join(root, 'data'));
const menuJson = [];
for (const g of menuGroups) {
  for (const line of g.items) {
    const m = line.match(/^- (.+?) — (\d+)/);
    if (!m) continue;
    menuJson.push({ side: g.side, group: g.title, name: m[1].trim(), price: +m[2] });
  }
}
fs.writeFileSync(path.join(root, 'data', 'menu.json'), JSON.stringify(menuJson), 'utf8');

const text = out.join('\n');
const dir = path.join(root, 'data');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'knowledge.txt'), text, 'utf8');

console.log('data/knowledge.txt собран');
console.log('размер:', Math.round(Buffer.byteLength(text, 'utf8') / 1024) + ' КБ');
console.log('строк:', out.length);
console.log('разделов меню:', menuGroups.length);
