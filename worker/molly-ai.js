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

const CF_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8'; // 30B, хорошо знает русский, дёшев по нейронам
const YA_MODEL = 'yandexgpt-lite/latest';
const MAX_QUESTION = 500;      // длиннее вопрос не принимаем
const MAX_ANSWER_TOKENS = 350; // и не даём разогнаться ответу

const SYSTEM = `Ты — Молли, помощница ирландского паба «Молли» в Магнитогорске.

ГЛАВНОЕ ПРАВИЛО: отвечай ТОЛЬКО по справочнику ниже. Если сведений в нём нет —
честно скажи «этого я не знаю» и предложи позвонить по телефону +7 (3519) 45-37-37.
НИКОГДА не выдумывай блюда, цены, даты, условия акций и события. Лучше признаться,
что не знаешь, чем назвать цифру наугад: гость приедет с ней и будет скандал.

КАК ОТВЕЧАТЬ:
- по-русски, на «вы», дружелюбно и коротко: две-четыре фразы, без воды;
- цены называй ровно так, как в справочнике;
- если спрашивают о том, чего в пабе нет, — так и скажи, но предложи, что есть взамен;
- разговор только о пабе: меню, часы, афиша, банкеты, бронь, как добраться.
  На вопросы о политике, здоровье, других заведениях и прочем вежливо ответь,
  что помогаешь только по пабу, и верни к делу;
- не обещай скидок и условий, которых нет в справочнике;
- не упоминай, что ты нейросеть или что у тебя есть «справочник» — просто отвечай.

СПРАВОЧНИК:
`;

function cors(origin, allowed) {
  const ok = allowed && origin && origin.startsWith(allowed);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
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
    if (request.method !== 'POST') return reply({ error: 'only POST' }, 405, head);

    /* пускаем только со своего сайта — чтобы ключом не пользовались посторонние */
    if (env.SITE_ORIGIN && origin && !origin.startsWith(env.SITE_ORIGIN)) {
      return reply({ error: 'чужой источник' }, 403, head);
    }

    let data;
    try { data = await request.json(); } catch (e) { return reply({ error: 'плохой json' }, 400, head); }

    const question = String(data.q || '').trim().slice(0, MAX_QUESTION);
    if (!question) return reply({ error: 'пустой вопрос' }, 400, head);

    let book;
    try { book = await knowledge(env); }
    catch (e) { return reply({ error: 'справочник недоступен' }, 503, head); }

    const messages = [
      { role: 'system', content: SYSTEM + book },
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
      const answer = out?.result?.alternatives?.[0]?.message?.text?.trim();
      if (!answer) return reply({ error: 'пустой ответ' }, 502, head);
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
    answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!answer) return reply({ error: 'пустой ответ' }, 502, head);

    return reply({ answer, engine: 'cloudflare' }, 200, head);
  }
};
