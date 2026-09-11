/* ============================================================
   Помощник «Молли»

   Отвечает мгновенно, без оператора и без внешних сервисов.
   Знания берёт прямо со страницы: меню, афишу и часы работы —
   значит, правим меню или афишу, и Молли узнаёт об этом сама.

   Что тут внутри:
     1. разбор написанного текста по ключевым словам
     2. поиск по меню (блюда, категории, цена)
     3. афиша с привязкой к сегодняшнему числу
     4. «сейчас открыто или закрыто»
     5. сбор заявки на бронь
     6. учёт вопросов, чтобы понимать, о чём спрашивают
   ============================================================ */
(function () {
  'use strict';

  var TEL  = '+73519453737',
      VK   = 'https://vk.com/molly174',
      BOOK = 'https://416936.restoplace.ws',
      MAP  = 'https://yandex.ru/maps/?text=Магнитогорск, Завенягина, 8а';

  /* ---------- мелкие помощники ---------- */

  function norm(s) {
    return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  var CALL = '<a href="tel:' + TEL + '">45-37-37</a>';

  /* ---------- знания со страницы ---------- */

  var MENU = [];
  function readMenu() {
    MENU = [].map.call(document.querySelectorAll('.menu-side .mi'), function (li) {
      var side  = li.closest('.menu-side').getAttribute('data-side');
      var grp   = li.closest('.mgroup').querySelector('h3').textContent.trim();
      var name  = li.querySelector('.mi-name').textContent.trim();
      var pTxt  = li.querySelector('.mi-price').textContent.trim();
      var dEl   = li.querySelector('.mi-desc');
      var desc  = dEl ? dEl.textContent.trim() : '';
      var num   = pTxt.replace(/\s/g, '').match(/\d+/);
      return {
        side: side, group: grp, name: name, desc: desc,
        priceTxt: pTxt, price: num ? +num[0] : 0,
        hay: norm(name + ' ' + desc + ' ' + grp)
      };
    });
  }

  var EVENTS = [];
  function readEvents() {
    EVENTS = [].map.call(document.querySelectorAll('#afisha .ev'), function (ev) {
      var t = ev.querySelector('h4').textContent.trim();
      var p = ev.querySelector('.ev-txt p');
      return {
        from:  ev.getAttribute('data-from'),
        until: ev.getAttribute('data-until'),
        date:  ev.querySelector('.ev-date').textContent.trim(),
        title: t,
        sub:   p ? p.textContent.trim() : '',
        hay:   norm(t + ' ' + (p ? p.textContent : ''))
      };
    });
  }

  function day0(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function parseDate(s) { var p = (s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- часы работы ----------
     Пн–Чт и Вс: 18:00–02:00, Пт–Сб: 18:00–05:00.
     Закрытие приходится на следующие сутки, поэтому в час ночи
     заведение ещё открыто «со вчера». */
  var CLOSE = { 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 5, 6: 5 };

  function openState(now) {
    now = now || new Date();
    var d = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
    var prev = (d + 6) % 7;
    if (h >= 18)             return { open: true,  closes: CLOSE[d] };
    if (h < CLOSE[prev])     return { open: true,  closes: CLOSE[prev] };
    return { open: false, opensToday: true };
  }
  function hh(n) { return (n < 10 ? '0' + n : n) + ':00'; }

  function hoursNowAnswer() {
    var st = openState();
    var head = st.open
      ? '<b>Сейчас открыты</b> — работаем до ' + hh(st.closes) + '.'
      : '<b>Сейчас закрыто.</b> Откроемся сегодня в 18:00.';
    return head +
      '<div class="rows"><i>Понедельник — четверг</i> — с 18:00 до 02:00' +
      '<i>Пятница — суббота</i> — с 18:00 до 05:00' +
      '<i>Воскресенье</i> — с 18:00 до 02:00</div>' +
      'Работаем каждый день, выходных нет.';
  }

  /* ---------- афиша ---------- */

  function eventCard(e) {
    return '<div class="rows"><i>' + esc(e.date) + '</i> — <b>' + esc(e.title) + '</b>' +
      (e.sub ? '<i style="color:var(--muted)">' + esc(e.sub) + '</i>' : '') + '</div>';
  }

  function eventsOn(dayOffset) {
    var t = day0(new Date());
    t.setDate(t.getDate() + dayOffset);
    return EVENTS.filter(function (e) {
      if (!e.from || !e.until) return false;
      return parseDate(e.from) <= t && t <= parseDate(e.until);
    });
  }

  function nearestEvents(n) { return EVENTS.slice(0, n || 2); }

  function eventsAnswer(when) {
    if (!EVENTS.length) {
      return 'Программа на ближайшие даты сейчас готовится — загляните в <a href="' + VK + '" target="_blank" rel="noopener">наше сообщество</a>, там всё появляется первым.';
    }
    if (when === 'today' || when === 'tomorrow') {
      var list = eventsOn(when === 'today' ? 0 : 1);
      var word = when === 'today' ? 'Сегодня' : 'Завтра';
      if (list.length) {
        return word + ' у нас <b>' + esc(list[0].title) + '</b>.' + eventCard(list[0]) +
          'Двери с 18:00, вход платный. Стол лучше забронировать заранее.';
      }
      var next = nearestEvents(1)[0];
      return word + ' особой программы нет — работаем в обычном режиме: кухня, бар, караоке.<br><br>' +
        'Ближайшее событие:' + eventCard(next);
    }
    var near = nearestEvents(2);
    return 'Ближайшее у нас вот что:' +
      near.map(eventCard).join('') +
      'Вся афиша — <a href="#program">в разделе «Программа»</a>.';
  }

  function findEvent(q) {
    var n = norm(q);
    var words = n.split(' ').filter(function (w) { return w.length > 3; });
    if (!words.length) return null;
    for (var i = 0; i < EVENTS.length; i++) {
      for (var j = 0; j < words.length; j++) {
        if (EVENTS[i].hay.indexOf(words[j]) > -1) return EVENTS[i];
      }
    }
    return null;
  }

  /* ---------- поиск по меню ---------- */

  function menuList(items, limit) {
    return '<div class="rows">' + items.slice(0, limit || 6).map(function (m) {
      return '<i>' + esc(m.name) + '</i> — ' + esc(m.priceTxt);
    }).join('') + '</div>';
  }

  function menuByGroup(re) {
    return MENU.filter(function (m) { return re.test(m.group.toLowerCase()); });
  }

  function menuSearch(q) {
    var n = norm(q);
    var words = n.split(' ').filter(function (w) { return w.length > 3; });
    if (!words.length) return [];
    return MENU.filter(function (m) {
      return words.some(function (w) {
        var stem = w.length > 5 ? w.slice(0, w.length - 2) : w;
        return m.hay.indexOf(stem) > -1;
      });
    });
  }

  function priceLimitAnswer(limit) {
    var items = MENU.filter(function (m) { return m.side === 'food' && m.price && m.price <= limit; })
                    .sort(function (a, b) { return a.price - b.price; });
    if (!items.length) {
      var min = Math.min.apply(null, MENU.filter(function (m) { return m.side === 'food' && m.price; }).map(function (m) { return m.price; }));
      return 'До ' + limit + ' ₽ из кухни ничего нет — самая недорогая позиция стоит ' + min + ' ₽.<br><br>' +
        'Зато в баре есть чай и кофе от 300 ₽.';
    }
    return 'Из кухни до ' + limit + ' ₽ есть вот что:' + menuList(items, 8) +
      (items.length > 8 ? 'И ещё ' + (items.length - 8) + ' позиций — <a href="#menu">смотрите меню целиком</a>.' : '<a href="#menu">Всё меню на странице</a>.');
  }

  /* ---------- ответы, которых мы пока не знаем ---------- */

  var UNKNOWN = {
    parking:  'парковку',
    kids:     'детское меню и условия для детей',
    dress:    'дресс-код',
    delivery: 'доставку',
    wifi:     'интернет в зале',
    job:      'вакансии',
    entry:    'стоимость входа'
  };
  function dontKnow(key) {
    return 'Про ' + UNKNOWN[key] + ' я точно не скажу — не хочу вводить вас в заблуждение.<br><br>' +
      'Позвоните администратору, он ответит сразу: ' + CALL + '.';
  }

  /* ---------- темы (кнопки) ---------- */

  var TOPICS = {
    book: {
      q: 'Забронировать стол',
      a: function () {
        return 'Займём вам место — выбирайте, как удобнее:' +
          '<div class="rows"><i>· Онлайн</i> — <a href="' + BOOK + '" target="_blank" rel="noopener">на схеме зала</a>' +
          '<i>· Через меня</i> — соберу заявку, вам останется её отправить' +
          '<i>· По телефону</i> — ' + CALL + ', администратор подберёт стол' +
          '<i>· ВКонтакте</i> — <a href="' + VK + '" target="_blank" rel="noopener">в сообщения сообщества</a></div>' +
          'На выходные и концерты бронируйте заранее — зал заполняется быстро.';
      },
      next: ['request', 'hours', 'program']
    },
    request:  { q: 'Оставить заявку', a: function () { startRequest(); return null; }, next: [] },
    hours:    { q: 'Часы работы',      a: hoursNowAnswer, next: ['book', 'where', 'program'] },
    where: {
      q: 'Как добраться',
      a: function () {
        return 'Мы в Магнитогорске, <b>улица Завенягина, 8а</b>.<br><a href="' + MAP + '" target="_blank" rel="noopener">Открыть на карте</a><br><br>' +
          'Если не найдёте вход — звоните ' + CALL + ', подскажем.';
      },
      next: ['hours', 'book']
    },
    menu: {
      q: 'Меню и кухня',
      a: function () {
        return 'Гриль, паста, пицца и азиатская кухня — от закусок к пенному до рамп-стейка и дорадо.' +
          '<div class="rows"><i>· Закуски</i> — от 450 ₽<i>· Салаты</i> — от 580 ₽<i>· Горячее и гриль</i> — от 600 ₽' +
          '<i>· Пивная тарелка на компанию</i> — 1200 ₽<i>· Мясной пир на гриле</i> — 3500 ₽</div>' +
          'Спросите про любое блюдо — найду в меню. Или <a href="#menu">откройте меню целиком</a>.';
      },
      next: ['beer', 'banquet', 'book']
    },
    beer: {
      q: 'Какое есть пиво',
      a: function () {
        var b = menuByGroup(/^пиво$/);
        if (!b.length) return 'Сорта уточню у бармена — позвоните: ' + CALL + '.';
        return 'В разливе и бутылке:' + menuList(b, 8) +
          'Есть и безалкогольное. Полная карта бара — <a href="#menu">в разделе «Меню»</a>.';
      },
      next: ['menu', 'alcohol', 'book']
    },
    banquet: {
      q: 'Банкет и день рождения',
      a: function () {
        return 'Банкетное меню — <b>2500 ₽ с человека</b>. Имениннику и компании от 10 человек скидка 10% при оплате наличными, 5% по карте — выходит 2250 ₽.<br><br>' +
          'В меню входят закуски на стол, закуска на персону, салат и горячее на выбор.' +
          '<div class="rows"><i>· 50%</i> — скидка на вход в караоке и на танцпол<i>· 50%</i> — скидка на горячие напитки' +
          '<i>· Можно</i> принести свой крепкий алкоголь, торт и фрукты</div>' +
          'Обсудить детали: ' + CALL + '.';
      },
      next: ['birthday', 'request', 'menu']
    },
    program: {
      q: 'Что у вас происходит',
      a: function () { return eventsAnswer('near'); },
      next: ['book', 'birthday', 'menu']
    },
    alcohol: {
      q: 'Можно со своим алкоголем?',
      a: function () {
        return 'Да. Закажите по меню <b>на 1000 ₽ на человека</b> — и приносите свои напитки.<br><br>' +
          'Условия уточните у администратора при бронировании: ' + CALL + '.<br><br>' +
          '<span style="font-size:13px;color:#7d8a7a">Скидки и акции не суммируются и не действуют в праздничные и концертные дни.</span>';
      },
      next: ['book', 'menu']
    },
    birthday: {
      q: 'Я именинник',
      a: function () {
        return 'Тогда вам к нам — <b>скидка на меню</b> имениннику и компаниям от 10 человек: 10% наличными или 5% по карте.<br><br>' +
          'Если хотите с размахом, есть банкетное меню за 2500 ₽ с человека — со скидкой выйдет 2250 ₽.<br><br>' +
          'Предупредите заранее при бронировании, чтобы всё успели подготовить.';
      },
      next: ['banquet', 'book']
    }
  };
  var MAIN = ['book', 'hours', 'menu', 'program', 'banquet', 'beer', 'alcohol', 'birthday'];

  /* ---------- разбор написанного ---------- */

  var RULES = [
    [/сейчас работа|сейчас откр|сейчас закр|открыт|закрыт|до скольки|во сколько|часы|режим работ|работаете/, function () { return hoursNowAnswer(); }],
    [/сегодня/,                       function () { return eventsAnswer('today'); }],
    [/завтра/,                        function () { return eventsAnswer('tomorrow'); }],
    [/афиш|событ|вечеринк|концерт|программ|выходн|в субботу|в пятницу/, function () { return eventsAnswer('near'); }],
    [/забронир|бронь|бронир|столик|заказать стол|место на/, function () { return TOPICS.book.a(); }],
    [/адрес|где вы|где наход|как добра|как найти|карт[ае]|проезд/,     function () { return TOPICS.where.a(); }],
    [/банкет|корпоратив|юбилей|свадьб|поминк|выпускн/,                 function () { return TOPICS.banquet.a(); }],
    [/именинник|день рожден|днюх|скидк/,                               function () { return TOPICS.birthday.a(); }],
    [/свой алког|со своим|принести свое|принести свой/,                function () { return TOPICS.alcohol.a(); }],
    [/пиво|пенн|сорта|разлив/,                                         function () { return TOPICS.beer.a(); }],
    [/парковк|машин|припарк/,                                          function () { return dontKnow('parking'); }],
    [/дет[еия]|ребен|ребят|коляск/,                                    function () { return dontKnow('kids'); }],
    [/дресс|одежд|фейс|как одеть/,                                     function () { return dontKnow('dress'); }],
    [/доставк|навынос|с собой еду/,                                    function () { return dontKnow('delivery'); }],
    [/вайфай|wifi|интернет/,                                           function () { return dontKnow('wifi'); }],
    [/ваканс|работу|устроит|требуют/,                                  function () { return dontKnow('job'); }],
    [/вход платн|стоимость входа|сколько вход|вход стоит/,             function () { return dontKnow('entry'); }],
    [/кальян|курить|курен/, function () {
      return 'Этот вопрос лучше задать администратору — ' + CALL + '.';
    }],
    [/караоке/, function () {
      return 'Да, у нас <b>отдельный зал караоке</b> — можно петь своей компанией, не выходя на общую сцену.<br><br>' +
        'По выходным караоке идёт и в основном зале, вместе с диджеем и танцполом.';
    }],
    [/вип|отдельн[ыа]|комнат|кабинет/, function () {
      return 'Есть <b>отдельные VIP-комнаты</b> — для компании, которая хочет посидеть отдельно от общего зала.<br><br>' +
        'Забронировать: ' + CALL + '.';
    }],
    [/танцпол|потанц|дискотек|диджей|dj/, function () {
      return 'Танцпол работает <b>по пятницам и субботам до 05:00</b>. Резиденты — DJ Skimmi, Zarya и MC Rahmat.<br><br>' +
        'В будни спокойнее: кухня, бар и караоке.';
    }],
    [/живая музык|группа|музыкант|выступ/, function () {
      return 'Живая музыка у нас <b>каждые выходные</b> — на сцене выступают музыканты и артисты, после играет диджей.' +
        (EVENTS.length ? '<br><br>Ближайшее:' + eventCard(EVENTS[0]) : '');
    }],
    [/оплат|картой|наличн|безнал|перевод/, function () {
      return 'Принимаем и наличные, и карты.<br><br>' +
        'Один момент про скидки: имениннику и компаниям от 10 человек — <b>10% при оплате наличными</b> и 5% по карте.';
    }],
    [/возраст|18|со скольки лет|несовершен/, function () {
      return 'Паб работает <b>18+</b>. С собой лучше иметь документ — на входе могут спросить.';
    }],
    [/суши|ролл|сашими|японск/, function () {
      var a = menuByGroup(/азиатск/);
      return 'Суши и роллов у нас нет — не хочу, чтобы вы приехали зря.<br><br>' +
        'Но есть азиатский раздел:' + menuList(a, 5);
    }],
    [/веган|вегетариан|постн|мясо не ем/, function () {
      var v = MENU.filter(function (m) { return /овощ|греческ|гриб|картоф|сырн|фрукт/.test(m.hay) && m.side === 'food'; });
      return 'Отдельного вегетарианского меню нет, но выбрать есть из чего:' + menuList(v, 6) +
        'Состав блюд уточните у официанта — подскажет точнее меня.';
    }],
    [/спасибо|благодар|понял|ясно|отлично|круто/, function () {
      return 'Обращайтесь! Будет что спросить — я тут.';
    }],
    [/привет|здравств|добрый|хай|доброе утро|добрый вечер/, function () {
      var st = openState();
      return 'Здравствуйте! ' + (st.open ? 'Мы сейчас открыты, ждём вас.' : 'Сегодня открываемся в 18:00.') +
        '<br><br>О чём рассказать — меню, афиша, бронь?';
    }]
  ];

  /* цена: «до 500», «дешевле 600», «за 400 рублей» */
  function priceQuery(n) {
    var m = n.match(/(?:до|дешевле|меньше|не дороже|в пределах)\s*(\d{2,5})/);
    return m ? +m[1] : null;
  }

  function answerFor(text) {
    var n = norm(text);
    if (!n) return null;

    var lim = priceQuery(n);
    if (lim) return priceLimitAnswer(lim);

    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(n)) return RULES[i][1]();
    }

    var ev = findEvent(n);
    if (ev) {
      return '<b>' + esc(ev.title) + '</b> — ' + esc(ev.date) + '.' + eventCard(ev) +
        'Двери с 18:00. Забронировать стол: ' + CALL + '.';
    }

    var found = menuSearch(n);
    if (found.length) {
      var head = found.length === 1
        ? 'Есть такое:'
        : 'Нашла в меню ' + found.length + (found.length < 5 ? ' позиции:' : ' позиций, вот часть:');
      return head + menuList(found, 6) + '<a href="#menu">Открыть меню целиком</a>';
    }

    return null;
  }

  /* ---------- учёт вопросов ---------- */

  function track(kind, q) {
    try { if (window.ym && window.MOLLY_YM) window.ym(window.MOLLY_YM, 'reachGoal', 'asst_' + kind); } catch (e) {}
    try {
      var k = 'molly_asst_log';
      var log = JSON.parse(store(k) || '{}');
      var key = (kind === 'miss' ? '× ' : '') + q.slice(0, 60);
      log[key] = (log[key] || 0) + 1;
      store(k, JSON.stringify(log));
    } catch (e) {}
  }
  /* в консоли: mollyStats() — покажет, о чём спрашивали на этом устройстве */
  window.mollyStats = function () {
    try {
      var log = JSON.parse(store('molly_asst_log') || '{}');
      return Object.keys(log).sort(function (a, b) { return log[b] - log[a]; })
        .map(function (k) { return log[k] + ' × ' + k; });
    } catch (e) { return []; }
  };

  /* ---------- интерфейс ---------- */

  var panel   = document.getElementById('panel'),
      chat    = document.getElementById('chat'),
      chips   = document.getElementById('chips'),
      teaser  = document.getElementById('teaser'),
      asstBtn = document.getElementById('asstBtn'),
      asstDot = document.getElementById('asstDot'),
      form    = document.getElementById('asstForm'),
      input   = document.getElementById('asstInput'),
      started = false;

  if (!panel) return;

  function toBottom() {
    chat.scrollTop = chat.scrollHeight;
    if (window.requestAnimationFrame) requestAnimationFrame(function () { chat.scrollTop = chat.scrollHeight; });
    setTimeout(function () { chat.scrollTop = chat.scrollHeight; }, 60);
  }
  function add(cls, html) {
    var m = document.createElement('div');
    m.className = 'msg ' + cls;
    m.innerHTML = html;
    chat.appendChild(m); toBottom();
    return m;
  }
  function typing() {
    var t = document.createElement('div');
    t.className = 'msg msg-bot typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    chat.appendChild(t); toBottom();
    return t;
  }
  function say(html, delay) {
    var dots = typing();
    setTimeout(function () { dots.remove(); add('msg-bot', html); }, delay || 480);
  }
  function setChips(keys) {
    chips.innerHTML = '';
    (keys || []).forEach(function (k) {
      if (!TOPICS[k]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = TOPICS[k].q;
      b.addEventListener('click', function () { ask(k); });
      chips.appendChild(b);
    });
    var cb = document.createElement('button');
    cb.type = 'button';
    cb.className = 'call';
    cb.textContent = 'Позвонить 45-37-37';
    cb.addEventListener('click', function () { track('call', 'кнопка звонка'); window.location.href = 'tel:' + TEL; });
    chips.appendChild(cb);
  }

  function ask(key) {
    var t = TOPICS[key];
    add('msg-user', t.q);
    track('topic', t.q);
    setChips([]);
    var html = typeof t.a === 'function' ? t.a() : t.a;
    if (html === null) return;                 // тема сама управляет диалогом
    var dots = typing();
    setTimeout(function () {
      dots.remove();
      add('msg-bot', html);
      setChips(t.next && t.next.length ? t.next : MAIN.slice(0, 4));
    }, 520);
  }

  /* ---------- заявка на бронь ---------- */

  var flow = null;
  var STEPS = [
    { key: 'when',   q: 'Хорошо, соберу заявку. <b>На какое число и время?</b><br><span style="font-size:13px;color:#7d8a7a">Например: 18 октября, 20:00</span>' },
    { key: 'guests', q: '<b>Сколько будет гостей?</b>' },
    { key: 'name',   q: '<b>На чьё имя записать?</b>' }
  ];

  function startRequest() {
    flow = { i: 0, data: {} };
    setChips([]);
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Отменить';
    cancel.addEventListener('click', function () { flow = null; say('Отменила. Спрашивайте что-нибудь ещё.'); setChips(MAIN.slice(0, 4)); });
    chips.appendChild(cancel);
    say(STEPS[0].q);
    focusInput();
  }

  function stepRequest(text) {
    flow.data[STEPS[flow.i].key] = text;
    flow.i++;
    if (flow.i < STEPS.length) { say(STEPS[flow.i].q); return; }

    var d = flow.data;
    flow = null;
    var msg = 'Здравствуйте! Хочу забронировать стол в пабе «Молли».\n' +
              'Когда: ' + d.when + '\nГостей: ' + d.guests + '\nИмя: ' + d.name;
    track('request', 'заявка на бронь');

    var dots = typing();
    setTimeout(function () {
      dots.remove();
      var box = add('msg-bot',
        'Готово, вот заявка:' +
        '<div class="req" id="reqText">' + esc(msg).replace(/\n/g, '<br>') + '</div>' +
        'Отправьте её администратору — так быстрее всего.');
      var row = document.createElement('div');
      row.className = 'req-acts';
      row.innerHTML =
        '<a class="req-btn" href="tel:' + TEL + '">Позвонить</a>' +
        '<a class="req-btn" href="' + VK + '" target="_blank" rel="noopener">Написать в ВК</a>' +
        '<button class="req-btn" type="button" id="reqCopy">Скопировать</button>';
      box.appendChild(row);
      toBottom();

      document.getElementById('reqCopy').addEventListener('click', function () {
        var btn = this;
        function done(ok) { btn.textContent = ok ? 'Скопировано' : 'Выделите текст'; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(msg).then(function () { done(true); }, function () { done(false); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = msg; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
          document.body.removeChild(ta);
        }
      });
      setChips(['book', 'hours', 'program']);
    }, 520);
  }

  /* ---------- ввод текстом ---------- */

  function focusInput() { if (input && window.innerWidth > 760) input.focus(); }

  function handleText(text) {
    text = text.trim();
    if (!text) return;
    add('msg-user', esc(text));
    input.value = '';

    if (flow) {
      if (/^(отмена|стоп|хватит|не надо)$/i.test(text)) {
        flow = null;
        say('Отменила. Спрашивайте что-нибудь ещё.');
        setChips(MAIN.slice(0, 4));
        return;
      }
      stepRequest(text);
      return;
    }

    var a = answerFor(text);
    if (a) {
      track('hit', text);
      say(a);
      setTimeout(function () { setChips(MAIN.slice(0, 4)); }, 520);
    } else {
      track('miss', text);
      say('Такого я пока не знаю — и придумывать не буду.<br><br>' +
          'Спросите администратора, он ответит точно: ' + CALL + '.<br><br>' +
          'А я хорошо разбираюсь вот в чём:');
      setTimeout(function () { setChips(['menu', 'program', 'book', 'banquet']); }, 520);
    }
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleText(input.value);
    });
  }

  /* ---------- открытие и закрытие ---------- */

  function start() {
    if (started) return;
    started = true;
    readMenu(); readEvents();
    var st = openState();
    var dots = typing();
    setTimeout(function () {
      dots.remove();
      add('msg-bot',
        'Здравствуйте! Я Молли.<br><br>' +
        (st.open ? 'Мы <b>сейчас открыты</b> — работаем до ' + hh(st.closes) + '.'
                 : 'Сейчас закрыто, <b>откроемся в 18:00</b>.') +
        '<br><br>Спросите что угодно про меню, афишу или бронь — или нажмите кнопку ниже.');
      setChips(MAIN.slice(0, 4));
      focusInput();
    }, 450);
  }

  function hideTeaser() { teaser.classList.remove('on'); store('molly_teaser', '1'); }
  function openPanel() {
    hideTeaser();
    panel.classList.add('on');
    asstBtn.classList.add('hide');
    if (asstDot) asstDot.style.display = 'none';
    start();
  }
  function closePanel() {
    panel.classList.remove('on');
    asstBtn.classList.remove('hide');
  }

  asstBtn.addEventListener('click', openPanel);
  document.getElementById('panelX').addEventListener('click', closePanel);
  document.getElementById('teaserX').addEventListener('click', function (e) { e.stopPropagation(); hideTeaser(); });
  teaser.addEventListener('click', openPanel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('on')) closePanel();
  });

  if (!store('molly_teaser')) {
    setTimeout(function () { if (!panel.classList.contains('on')) teaser.classList.add('on'); }, 6000);
  } else if (asstDot) {
    asstDot.style.display = 'none';
  }
})();
