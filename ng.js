/* Оживление новогодней страницы.

   Две вещи:
   1) блоки выплывают снизу при прокрутке — как на соседнем проекте,
      откуда просьба и пришла;
   2) заголовки набираются по буквам.

   Побуквенный набор сделан осторожно: буквы режутся внутри слов, а слова
   остаются целыми, иначе строка переносилась бы посреди слова. Читалкам
   экрана отдаём цельный текст через aria-label — иначе они диктуют по
   букве, а это издевательство. При системной настройке «меньше движения»
   не делаем ничего: и появление, и набор выключены.  */
(function () {
  var тише = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function показать(el) { el.classList.add('in'); }

  /* ---------- появление блоков ---------- */
  var блоки = document.querySelectorAll('.rv');

  /* ---------- набор по буквам ---------- */
  var заголовки = document.querySelectorAll('[data-type]');

  function разрезать(el) {
    if (el.dataset.cut) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

    function обойти(узел) {
      var дети = [].slice.call(узел.childNodes);
      дети.forEach(function (n) {
        if (n.nodeType === 3) {
          var куски = n.nodeValue.split(/(\s+)/);
          var фрагмент = document.createDocumentFragment();
          куски.forEach(function (кусок) {
            if (!кусок) return;
            if (/^\s+$/.test(кусок)) { фрагмент.appendChild(document.createTextNode(кусок)); return; }
            /* слово целиком — чтобы перенос строки не рвал его посередине */
            var слово = document.createElement('span');
            слово.className = 'w';
            for (var i = 0; i < кусок.length; i++) {
              var б = document.createElement('span');
              б.className = 'ch';
              б.textContent = кусок[i];
              слово.appendChild(б);
            }
            фрагмент.appendChild(слово);
          });
          узел.replaceChild(фрагмент, n);
        } else if (n.nodeType === 1) {
          обойти(n);
        }
      });
    }
    обойти(el);

    [].forEach.call(el.querySelectorAll('.ch'), function (б, i) {
      б.style.transitionDelay = (i * 26) + 'ms';
    });
    el.dataset.cut = '1';
  }

  if (тише || !('IntersectionObserver' in window)) {
    [].forEach.call(блоки, показать);
    [].forEach.call(заголовки, показать);
    return;
  }

  var глаз = new IntersectionObserver(function (записи) {
    записи.forEach(function (з) {
      if (!з.isIntersecting) return;
      показать(з.target);
      глаз.unobserve(з.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  [].forEach.call(блоки, function (el) { глаз.observe(el); });
  [].forEach.call(заголовки, function (el) { разрезать(el); глаз.observe(el); });
})();
