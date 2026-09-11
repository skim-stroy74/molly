/* ================= ДВИЖЕНИЕ =================
   Появление блоков при скролле с задержкой по соседям,
   счётчики цифр, сжатие шапки. Всё на transform и opacity,
   чтобы не грузить слабые телефоны.
   Уважает системную настройку «меньше движения». */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- 1. Готовим сетки к появлению по очереди ---
     Контейнер перестаёт появляться целиком, вместо него
     по одной проявляются карточки внутри. */
  var GRIDS = ['.prog', '.afisha', '.gigs', '.gal', '.banq-gal',
               '.promo', '.inside', '.facts', '.book-ways', '.albums', '.shots'];
  GRIDS.forEach(function(sel){
    [].forEach.call(document.querySelectorAll(sel), function(box){
      box.classList.remove('rv');
      box.classList.add('in');
      [].forEach.call(box.children, function(el){ el.classList.add('rv'); });
    });
  });

  /* --- 2. Появление --- */
  var items = document.querySelectorAll('.rv');

  function showAll(){
    [].forEach.call(items, function(el){ el.classList.add('in'); });
  }

  if (reduce || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (!en.isIntersecting) return;
        var el = en.target;
        /* задержка по месту среди соседей — эффект «волны» */
        var sibs = el.parentNode ? el.parentNode.querySelectorAll(':scope > .rv') : [];
        var idx = [].indexOf.call(sibs, el);
        if (idx > 0) el.style.transitionDelay = Math.min(idx, 8) * 70 + 'ms';
        el.classList.add('in');
        io.unobserve(el);
        if (el.hasAttribute('data-countup')) runCount(el);
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });

    [].forEach.call(items, function(el){ io.observe(el); });

    /* страховка: если наблюдатель не отработал — показываем всё */
    setTimeout(function(){
      if (!document.querySelector('.rv.in')) showAll();
    }, 2500);
  }

  /* --- 3. Счётчики цифр ---
     Берём числа из блока фактов: «21 000» оживает,
     «VIP» и «05:00» трогать не надо. */
  function prepCounters(){
    [].forEach.call(document.querySelectorAll('.fact b'), function(b){
      var txt = b.textContent.trim();
      var m = txt.match(/^(\d[\d\s]*)(\D*)$/);
      if (!m) return;
      var target = parseInt(m[1].replace(/\s/g, ''), 10);
      if (!target || target < 5) return;
      b.setAttribute('data-countup', String(target));
      b.setAttribute('data-suffix', m[2] || '');
      if (!reduce) b.textContent = '0' + (m[2] || '');
    });
  }

  function fmt(n){
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function runCount(el){
    if (reduce || el.dataset.countdone) return;
    el.dataset.countdone = '1';
    var target = +el.getAttribute('data-countup');
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1100, t0 = null;
    function step(ts){
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);           /* плавное торможение */
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    if (window.requestAnimationFrame) requestAnimationFrame(step);
    else el.textContent = fmt(target) + suffix;
  }

  prepCounters();

  function finishCount(el){
    if (el.dataset.countdone) return;
    el.dataset.countdone = '1';
    el.textContent = fmt(+el.getAttribute('data-countup')) + (el.getAttribute('data-suffix') || '');
  }

  /* счётчики внутри .facts наблюдаются вместе с карточками:
     ловим их отдельно, потому что data-count висит на <b> */
  if (!reduce && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: .5 });
    [].forEach.call(document.querySelectorAll('[data-countup]'), function(el){ cio.observe(el); });

    /* страховка: цифра не имеет права остаться нулём,
       если наблюдатель почему-то не отработал */
    setTimeout(function(){
      [].forEach.call(document.querySelectorAll('[data-countup]'), finishCount);
    }, 4000);
  } else {
    [].forEach.call(document.querySelectorAll('[data-countup]'), finishCount);
  }

  /* --- 4. Шапка сжимается при прокрутке --- */
  var hdr = document.querySelector('.hdr');
  if (hdr) {
    var ticking = false;
    function onScroll(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        hdr.classList.toggle('small', window.pageYOffset > 60);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- 5. Кнопка «наверх» ---
     Страница длинная: от контактов до брони прокручивать далеко. */
  (function(){
    var кн = document.createElement('button');
    кн.className = 'to-top';
    кн.type = 'button';
    кн.setAttribute('aria-label', 'Наверх страницы');
    кн.innerHTML = '↑';
    document.body.appendChild(кн);

    кн.addEventListener('click', function(){
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });

    var виднa = false, tick = false;
    window.addEventListener('scroll', function(){
      if (tick) return;
      tick = true;
      requestAnimationFrame(function(){
        var надо = window.pageYOffset > window.innerHeight * 1.5;
        if (надо !== виднa) { кн.classList.toggle('on', надо); виднa = надо; }
        tick = false;
      });
    }, { passive: true });
  })();

  /* --- 5. Первый экран: вход по очереди --- */
  if (!reduce) {
    var heroIn = document.querySelector('.hero-in');
    if (heroIn) heroIn.classList.add('lift');
  }
})();
