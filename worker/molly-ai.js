/* Посредник между сайтом и нейросетью.
   Разворачивается в Cloudflare Workers (бесплатно до 100 000 запросов в сутки).

   Зачем он нужен: ключ от нейросети нельзя класть в код страницы — его оттуда
   заберёт любой желающий и будет тратить чужие деньги. Ключ живёт здесь,
   на сервере, и наружу не попадает.

   Работает в двух режимах.

   БЕСПЛАТНО (по умолчанию): нейросети самой Cloudflare, прямо внутри воркера.
   Ни второго аккаунта, ни карты. 10 000 нейронов в сутки бесплатно —
   это примерно 320 ответов, для паба с запасом. Нужна привязка AI в настройках
   воркера (Settings → Bindings → AI, имя переменной AI).

   ПЛАТНО (необязательно): YandexGPT. Русский язык у него заметно лучше.
   Включается сам, если задан YANDEX_API_KEY.

   Переменные в панели Cloudflare (Settings → Variables):
     SITE_ORIGIN      — адрес сайта, напр. https://molly-mgn.com
     KNOWLEDGE_URL    — адрес справочника, напр. https://molly-mgn.com/data/knowledge.txt
     YANDEX_API_KEY   — только для платного режима (секрет)
     YANDEX_FOLDER_ID — только для платного режима

   Инструкция по шагам — в файле worker/README.md */

const CF_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // 70B, русский заметно лучше
const YA_MODEL = 'yandexgpt-lite/latest';
const MAX_QUESTION = 500;      // длиннее вопрос не принимаем
const MAX_ANSWER_TOKENS = 600; // и не даём разогнаться ответу

const SYSTEM = `Ты — Молли, помощница ирландского паба «Молли» в Магнитогорске.

ТВОЯ ЗАДАЧА: подобрать гостю подходящее из справочника ниже. Гость спрашивает
своими словами — «острое», «что-нибудь лёгкое», «мы вегетарианцы», — а в справочнике
таких слов нет. Смотри на названия и составы блюд и решай сам, что подходит.
Нашёл подходящее — назови его и цену.

«Этого я не знаю» говори ТОЛЬКО когда сведений действительно нет: цена входа,
парковка, дресс-код, вместимость зала. Тогда предложи позвонить: +7 (3519) 45-37-37.
Отказ там, где ответ есть в справочнике, — плохая работа.

ЧЕГО НЕЛЬЗЯ: называть блюда и цены, которых нет в справочнике ниже. Цену бери
из строки дословно, не округляй и не вспоминай по памяти — если строки с ценой
перед тобой нет, значит цены ты не знаешь. Гость приедет с выдуманной цифрой,
и будет скандал. Отвечай строго на заданный вопрос: спросили про музыку —
не рассказывай про еду.

КАК ОТВЕЧАТЬ:
- ты девушка, говори о себе в женском роде: «посоветовала бы», «нашла», «уточню».
  «Я бы порекомендовал» — грубая ошибка, гость видит на аватаре девушку;
- по-русски, на «вы», дружелюбно и коротко: две-четыре фразы, без воды;
- НИКОГДА не вываливай раздел меню целиком. Если перечисляешь — не больше пяти
  позиций, и только те, что подходят под вопрос;
- цены называй ровно так, как в справочнике;
- если спрашивают о том, чего в пабе нет, — так и скажи, но предложи, что есть взамен;
- разговор только о пабе: меню, часы, афиша, банкеты, бронь, как добраться.
  На вопросы о политике, здоровье, других заведениях и прочем вежливо ответь,
  что помогаешь только по пабу, и верни к делу;
- не обещай скидок и условий, которых нет в справочнике;
- не упоминай, что ты нейросеть или что у тебя есть «справочник» — просто отвечай.

СПРАВОЧНИК:
`;

/* SITE_ORIGIN можно задать списком через запятую:
   впишите сразу и нынешний адрес, и будущий домен — при переезде
   ничего менять не придётся, оба будут работать. */
function allowList(raw) {
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
}
/* сравниваем адрес целиком, а не по началу строки: иначе чужой сайт
   вида skim174.ru.злодей.рф прошёл бы проверку как «наш» */
function trimSlash(s) { return String(s).replace(/\/+$/, ''); }
function allowed(origin, raw) {
  if (!origin) return false;
  return allowList(raw).some(a => trimSlash(a) === trimSlash(origin));
}

function cors(origin, raw) {
  const list = allowList(raw);
  const ok = allowed(origin, raw);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (list[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

/* ---------- подбор нужных разделов справочника ----------

   Справочник целиком — 13 КБ, из них меню и афиша занимают 83%.
   Слабая модель в таком объёме тонет: на вопрос «шумно ли в четверг»
   она отвечала, как добраться до паба. Поэтому отдаём ей не всё,
   а только те разделы, которые относятся к заданному вопросу.

   Побочная выгода: запрос втрое короче, значит втрое дешевле
   по нейронам — бесплатного лимита хватает на большее число ответов. */

const CONTEXT_LIMIT = 6500;  // символов справочника на один вопрос

function norm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* режем справочник на разделы; меню дополнительно — на подразделы,
   иначе «Пиво» тянет за собой все 7 КБ карты бара и кухни */
function sections(book) {
  const out = [];
  let head = 'начало', body = [];
  const push = () => { if (body.length) out.push({ head, text: body.join('\n') }); };

  for (const line of book.split('\n')) {
    if (/^== /.test(line)) { push(); head = line; body = [line]; }
    else if (/^-- /.test(line)) { push(); head = line; body = [line]; }
    else body.push(line);
  }
  push();
  return out;
}

/* слова, которые есть в любом вопросе и потому ни на что не указывают:
   без этого «есть что-нибудь острое» вытаскивало карту ликёров */
const STOP = ['есть', 'быть', 'вас', 'ваш', 'наш', 'мне', 'что', 'как', 'где',
  'когда', 'можно', 'сколько', 'какой', 'какая', 'какие', 'какое', 'нибудь',
  'нужно', 'хочу', 'буду', 'подскажи', 'скажи', 'пожалуйста', 'привет',
  'спасибо', 'друг', 'друга', 'двоих', 'троих', 'человек', 'тысячи'];

/* гость говорит своими словами, а в справочнике другие: «вегетарианец»
   там не встречается ни разу, зато есть «овощное плато» и салаты */
const SYNONYMS = {
  /* про праздник спрашивают десятком способов, а деньги паба — в банкетах:
     2500 ₽ с человека и скидка компаниям от десяти. Это нельзя терять */
  'рожден':     ['банкет'],
  'отмет':      ['банкет'],
  'отпраздн':   ['банкет'],
  'праздн':     ['банкет'],
  'юбилей':     ['банкет'],
  'корпоратив': ['банкет'],
  'выпускн':    ['банкет'],
  'компани':    ['банкет'],
  'вегетариан': ['овощ', 'салат', 'сырн', 'гриб'],
  'веган':      ['овощ', 'салат'],
  'мясоед':     ['мясн', 'стейк', 'гриль'],
  'мясо':       ['мясн', 'стейк', 'гриль', 'ребр'],
  'остр':       ['чили', 'том ям', 'пикант'],
  'сладк':      ['десерт', 'мороженое', 'медовик'],
  /* спрашивают про глинтвейн и пунш, а из горячего есть только чай и кофе */
  'глинтвейн':  ['чай', 'кофе'],
  'пунш':       ['чай', 'кофе'],
  'грог':       ['чай', 'кофе'],
  'согрет':     ['чай', 'кофе'],
  'выпить':     ['пиво', 'коктейл', 'виски'],
  'перекус':    ['закуск'],
  'шумн':       ['музык', 'диджей', 'танцпол', 'караоке'],
  'тихо':       ['программ'],
  'доехать':    ['адрес', 'завенягина'],
  'добрат':     ['адрес', 'завенягина'],
  'припарк':    ['парковк']
};

/* Отдельные слова врут, когда вопрос — устойчивая фраза: «под пиво» это
   просьба про закуску, а не про сорта, и по слову «пиво» гостю уезжала
   карта бара вместо пивной тарелки. */
const PHRASES = {
  'под пиво':    ['закуск', 'компани', 'тарелк', 'гренк', 'крылышк', 'сухарик'],
  'к пиву':      ['закуск', 'компани', 'тарелк', 'гренк', 'крылышк', 'сухарик'],
  'под пивко':   ['закуск', 'компани', 'тарелк', 'гренк', 'крылышк'],
  'на компанию': ['компани', 'тарелк', 'плато', 'ассорти'],
  'на всех':     ['компани', 'тарелк', 'плато', 'ассорти']
};

/* ---------- учёт вопросов ----------

   Зачем: пока вопросы копятся только в браузере гостя, никто не знает,
   о чём люди спрашивают и на чём Молли спотыкается. Сводка показывает,
   чего людям не хватает на сайте, и даёт Ваде понять, что сайт живой.

   Что храним: только сам вопрос и получилось ли ответить. Ни имён,
   ни телефонов, ни адресов — длинные числа вырезаем на всякий случай.
   Записи живут месяц и пропадают сами.

   Работает, только если в воркере заведено хранилище KV с именем STATS.
   Нет хранилища — учёт молча выключен, на ответы это не влияет. */

const ХРАНИТЬ_ДНЕЙ = 30;

function обезличить(q) {
  const s = String(q).replace(/\s+/g, ' ').trim();
  /* Гость иногда пишет заявку прямо в окно: «забронируйте на Ивана,
     телефон такой-то». Раньше номер вырезался, а имя оставалось.
     Такие сообщения не храним вовсе: для сводки важно, что спрашивали
     про бронь, а не кто именно и как с ним связаться. */
  if (/\d[\d\s\-()]{5,}/.test(s)) return '(заявка с контактами)';
  return s.slice(0, 90);
}

async function записать(env, вопрос, получилось) {
  if (!env.STATS) return;
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  try {
    await env.STATS.put('q:' + id, JSON.stringify({
      q: обезличить(вопрос),
      ok: !!получилось,
      d: new Date().toISOString().slice(0, 10)
    }), { expirationTtl: ХРАНИТЬ_ДНЕЙ * 24 * 60 * 60 });
  } catch (e) { /* учёт не должен мешать ответу */ }
}

async function сводка(env) {
  if (!env.STATS) return { error: 'хранилище не подключено' };

  const список = await env.STATS.list({ prefix: 'q:', limit: 1000 });
  const записи = [];
  for (const k of список.keys) {
    const v = await env.STATS.get(k.name);
    if (v) { try { записи.push(JSON.parse(v)); } catch (e) {} }
  }

  const поДням = {}, поВопросам = {};
  let всего = 0, неответила = 0;

  for (const з of записи) {
    всего++;
    if (!з.ok) неответила++;
    поДням[з.d] = (поДням[з.d] || 0) + 1;
    const к = з.q.toLowerCase();
    if (!поВопросам[к]) поВопросам[к] = { текст: з.q, сколько: 0, промахов: 0 };
    поВопросам[к].сколько++;
    if (!з.ok) поВопросам[к].промахов++;
  }

  const топ = Object.values(поВопросам).sort((a, b) => b.сколько - a.сколько);

  return {
    всего: всего,
    неответила: неответила,
    поДням: Object.keys(поДням).sort().map(d => ({ день: d, сколько: поДням[d] })),
    частые: топ.slice(0, 40),
    промахи: топ.filter(x => x.промахов > 0).slice(0, 30),
    хранимДней: ХРАНИТЬ_ДНЕЙ
  };
}

function pickContext(book, question) {
  const words = [];
  const целиком = norm(question);
  for (const фраза of Object.keys(PHRASES)) {
    if (целиком.includes(фраза)) words.push(...PHRASES[фраза]);
  }
  for (const raw of norm(question).split(' ')) {
    if (raw.length <= 3 || STOP.includes(raw)) continue;
    const w = raw.length > 5 ? raw.slice(0, raw.length - 2) : raw;
    words.push(w);
    for (const key of Object.keys(SYNONYMS)) {
      if (raw.startsWith(key) || key.startsWith(w)) words.push(...SYNONYMS[key]);
    }
  }

  const secs = sections(book);
  const always = secs.filter(s => /ЧАСЫ РАБОТЫ|СВЕДЕНИЙ НЕТ/.test(s.head));

  const scored = secs
    .filter(s => !always.includes(s))
    .map(s => {
      const hay = norm(s.text), title = norm(s.head);
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 3;   // совпало в заголовке — почти наверняка оно
        else if (hay.includes(w)) score += 1;
      }
      return { s, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  /* Подходящее вопросу идёт ПЕРВЫМ, служебное — в хвост. Модель опирается
     на начало текста: когда «чего мы не знаем» стояло сверху, на вопрос
     про еду она отвечала «мы не знаем про парковку». */
  const chosen = [];
  let size = always.reduce((n, s) => n + s.text.length, 0);
  for (const { s } of scored) {
    if (size + s.text.length > CONTEXT_LIMIT) continue;
    chosen.push(s);
    size += s.text.length;
  }

  /* вопрос ни на что не похож — даём общее описание, пусть ответит по сути */
  if (!chosen.length) {
    for (const s of secs) {
      if (/ЗАВЕДЕНИЕ|ПРОГРАММА|БРОНИРОВАНИЕ/.test(s.head)) chosen.push(s);
    }
  }

  /* Оглавление отдаём всегда. Без него на вопрос «есть ли глинтвейн»
     подходящих разделов не находится, модель остаётся без карты напитков
     и придумывает: в проверке она предложила «горячий ромовый пунш»,
     которого в пабе отродясь не было. Со списком разделов она видит,
     чего нет, и честно говорит об этом. */
  const разделы = sections(book)
    .filter(s => /^-- /.test(s.head))
    .map(s => s.head.replace(/^-- /, '').replace(/ --$/, '').replace(/ \(бар\)/, ''))
    .join(', ');

  const оглавление = разделы
    ? 'ВСЁ МЕНЮ СОСТОИТ ТОЛЬКО ИЗ ЭТИХ РАЗДЕЛОВ: ' + разделы +
      '. Ничего другого в пабе нет — если гость просит блюдо или напиток ' +
      'не отсюда, скажи, что такого нет, и предложи похожее из имеющегося.'
    : '';

  return [оглавление].concat(chosen.concat(always).map(s => s.text))
    .filter(Boolean).join('\n\n');
}

/* ---------- страховка от выдуманных цен ----------

   Просить модель «не выдумывай» недостаточно: на вопрос про глинтвейн
   она ответила «есть горячее вино, 250 рублей» — ни напитка, ни такой
   цены в пабе нет. Гость приедет с этой цифрой, и виноват будет паб.

   Поэтому не надеемся на послушание, а сверяем: каждая сумма из ответа
   должна встречаться в том куске справочника, который мы ей дали.
   Не встречается — ответ не выпускаем. */

function суммы(текст) {
  return [...String(текст).matchAll(/(\d[\d\s]{1,6})\s*(?:₽|руб)/gi)]
    .map(m => +m[1].replace(/\s/g, ''))
    .filter(n => n > 0);
}

function ценыЧестные(ответ, контекст) {
  const свои = new Set(суммы(контекст));
  const выдуманные = суммы(ответ).filter(n => !свои.has(n));
  return { ок: !выдуманные.length, выдуманные };
}

/* Модель иногда упирается в лимит длины и обрывается на полуслове:
   «Точную атмосферу в будние дни не указана, но, скорее». Гостю лучше
   показать последнюю законченную мысль, чем огрызок фразы. */
function tidy(s) {
  if (/[.!?…»)]\s*$/.test(s)) return s;
  const cut = Math.max(s.lastIndexOf('.'), s.lastIndexOf('!'),
                       s.lastIndexOf('?'), s.lastIndexOf('…'));
  /* оставляем всё до последней точки, но только если там есть
     хоть одна законченная мысль, а не два слова */
  return cut >= 19 ? s.slice(0, cut + 1) : s;
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers)
  });
}

/* справочник тянем с сайта и держим в кэше — так он обновляется
   вместе с сайтом, и Worker для этого переразворачивать не надо */
let cached = { text: null, at: 0 };
async function knowledge(env) {
  const TTL = 10 * 60 * 1000; // 10 минут
  if (cached.text && Date.now() - cached.at < TTL) return cached.text;
  const r = await fetch(env.KNOWLEDGE_URL, { cf: { cacheTtl: 600 } });
  if (!r.ok) throw new Error('справочник недоступен: ' + r.status);
  cached = { text: await r.text(), at: Date.now() };
  return cached.text;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const head = cors(origin, env.SITE_ORIGIN);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: head });

    /* Отчёт: что спрашивают у Молли. Отдаём только по ключу, иначе
       выписку мог бы посмотреть любой желающий. */
    if (request.method === 'GET' && new URL(request.url).pathname === '/stats') {
      const ключ = new URL(request.url).searchParams.get('key');
      if (!env.STATS_KEY || ключ !== env.STATS_KEY) {
        return reply({ error: 'нужен ключ' }, 403, head);
      }
      return reply(await сводка(env), 200, head);
    }

    if (request.method !== 'POST') return reply({ error: 'only POST' }, 405, head);

    /* пускаем только со своего сайта — чтобы ключом не пользовались посторонние */
    if (env.SITE_ORIGIN && origin && !allowed(origin, env.SITE_ORIGIN)) {
      return reply({ error: 'чужой источник' }, 403, head);
    }

    let data;
    try { data = await request.json(); } catch (e) { return reply({ error: 'плохой json' }, 400, head); }

    const question = String(data.q || '').trim().slice(0, MAX_QUESTION);
    if (!question) return reply({ error: 'пустой вопрос' }, 400, head);

    let book;
    try { book = await knowledge(env); }
    catch (e) { return reply({ error: 'справочник недоступен' }, 503, head); }

    const контекст = pickContext(book, question);
    const messages = [
      { role: 'system', content: SYSTEM + контекст },
      { role: 'user', content: question }
    ];

    /* ---------- платный режим: YandexGPT ---------- */
    if (env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID) {
      const payload = {
        modelUri: 'gpt://' + env.YANDEX_FOLDER_ID + '/' + YA_MODEL,
        completionOptions: { stream: false, temperature: 0.2, maxTokens: String(MAX_ANSWER_TOKENS) },
        messages: messages.map(m => ({ role: m.role, text: m.content }))
      };

      let res;
      try {
        res = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Api-Key ' + env.YANDEX_API_KEY,
            'x-folder-id': env.YANDEX_FOLDER_ID
          },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        return reply({ error: 'нейросеть недоступна' }, 502, head);
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return reply({ error: 'нейросеть ответила ошибкой', status: res.status, detail: detail.slice(0, 300) }, 502, head);
      }

      const out = await res.json();
      const answer = tidy(out?.result?.alternatives?.[0]?.message?.text?.trim() || '');
      if (!answer) { await записать(env, question, false); return reply({ error: 'пустой ответ' }, 502, head); }
      await записать(env, question, true);
      return reply({ answer, engine: 'yandex' }, 200, head);
    }

    /* ---------- бесплатный режим: нейросети Cloudflare ---------- */
    if (!env.AI) {
      return reply({ error: 'не подключена привязка AI в настройках воркера' }, 500, head);
    }

    let out;
    try {
      out = await env.AI.run(CF_MODEL, {
        messages,
        temperature: 0.2,
        max_tokens: MAX_ANSWER_TOKENS
      });
    } catch (e) {
      /* сюда же попадаем, когда на сутки кончились бесплатные нейроны —
         сайт от этого не ломается, помощница просто вернётся к сценарию */
      return reply({ error: 'нейросеть недоступна', detail: String(e && e.message || e).slice(0, 200) }, 502, head);
    }

    let answer = (out && (out.response || out.result?.response) || '').trim();
    /* некоторые модели думают вслух — отрезаем служебную часть */
    answer = tidy(answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
    if (!answer) { await записать(env, question, false); return reply({ error: 'пустой ответ' }, 502, head); }

    const проверка = ценыЧестные(answer, контекст);
    if (!проверка.ок) {
      await записать(env, question, false);
      return reply({
        answer: 'Тут я не возьмусь называть цену по памяти — уточните, пожалуйста, ' +
                'у администратора: +7 (3519) 45-37-37. Он скажет точно.',
        engine: 'cloudflare'
      }, 200, head);
    }

    await записать(env, question, true);
    return reply({ answer, engine: 'cloudflare' }, 200, head);
  }
};
