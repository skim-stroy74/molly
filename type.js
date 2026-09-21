/* Заголовки набираются по буквам при появлении на экране.

   Осторожности, без которых эффект вредит:
   · режем буквы внутри слов, а слова оставляем целыми — иначе строка
     переносится посреди слова;
   · читалкам экрана отдаём цельный текст через aria-label, иначе они
     диктуют по букве;
   · при системной настройке «меньше движения» текст просто стоит на месте.

   Помечается заголовок атрибутом data-type в разметке.  */
(function () {
  var заголовки = document.querySelectorAll('[data-type]');
  if (!заголовки.length) return;

  var тише = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function показать(el) { el.classList.add('typed'); }

  function разрезать(el) {
    if (el.dataset.cut) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());

    (function обойти(узел) {
      [].slice.call(узел.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var фрагмент = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (кусок) {
            if (!кусок) return;
            if (/^\s+$/.test(кусок)) { фрагмент.appendChild(document.createTextNode(кусок)); return; }
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
    })(el);

    [].forEach.call(el.querySelectorAll('.ch'), function (б, i) {
      б.style.transitionDelay = (i * 26) + 'ms';
    });
    el.dataset.cut = '1';
  }

  if (тише || !('IntersectionObserver' in window)) {
    [].forEach.call(заголовки, показать);
    return;
  }

  var глаз = new IntersectionObserver(function (записи) {
    записи.forEach(function (з) {
      if (!з.isIntersecting) return;
      показать(з.target);
      глаз.unobserve(з.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });

  [].forEach.call(заголовки, function (el) { разрезать(el); глаз.observe(el); });
})();
