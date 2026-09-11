/* ================= ФОТО ВО ВЕСЬ ЭКРАН =================

   Любой снимок на странице открывается по клику: интерьер, зал,
   банкетный стол, кадры с вечеринок. Между фото можно листать
   стрелками, колесом мыши и свайпом на телефоне.

   Снимки собираются сами — отдельно размечать ничего не нужно.
   Достаточно, чтобы картинка лежала внутри .shot или .banq-gal.
   ====================================================== */
(function () {
  'use strict';

  var СЕЛЕКТОР = '.shot img, .banq-gal img';
  var снимки = [].slice.call(document.querySelectorAll(СЕЛЕКТОР));
  if (!снимки.length) return;

  var окно = null, текущий = 0;

  снимки.forEach(function (img, i) {
    var рамка = img.closest('.shot') || img.parentNode;
    рамка.classList.add('zoomable');
    рамка.setAttribute('role', 'button');
    рамка.setAttribute('tabindex', '0');
    рамка.setAttribute('aria-label', 'Открыть фото во весь экран');
    рамка.addEventListener('click', function () { открыть(i); });
    рамка.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); открыть(i); }
    });
  });

  function построить() {
    окно = document.createElement('div');
    окно.className = 'zoom';
    окно.innerHTML =
      '<button class="zoom-x" type="button" aria-label="Закрыть">×</button>' +
      '<button class="zoom-nav zoom-prev" type="button" aria-label="Предыдущее фото">‹</button>' +
      '<button class="zoom-nav zoom-next" type="button" aria-label="Следующее фото">›</button>' +
      '<figure class="zoom-fig"><img alt=""><figcaption></figcaption></figure>' +
      '<div class="zoom-count"></div>';
    document.body.appendChild(окно);

    окно.querySelector('.zoom-x').addEventListener('click', закрыть);
    окно.querySelector('.zoom-prev').addEventListener('click', function (e) { e.stopPropagation(); листать(-1); });
    окно.querySelector('.zoom-next').addEventListener('click', function (e) { e.stopPropagation(); листать(1); });
    окно.addEventListener('click', function (e) {
      if (e.target === окно || e.target.classList.contains('zoom-fig')) закрыть();
    });

    /* свайп на телефоне */
    var x0 = null;
    окно.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    окно.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var сдвиг = e.changedTouches[0].clientX - x0;
      if (Math.abs(сдвиг) > 50) листать(сдвиг > 0 ? -1 : 1);
      x0 = null;
    });
  }

  function показать(i) {
    текущий = (i + снимки.length) % снимки.length;
    var из = снимки[текущий];
    var кадр = окно.querySelector('img');
    кадр.src = из.currentSrc || из.src;
    кадр.alt = из.alt || '';
    окно.querySelector('figcaption').textContent = из.alt || '';
    окно.querySelector('.zoom-count').textContent = (текущий + 1) + ' / ' + снимки.length;
    /* одна картинка — листать нечего */
    окно.classList.toggle('alone', снимки.length < 2);
  }

  function открыть(i) {
    if (!окно) построить();
    показать(i);
    document.body.classList.add('zoom-open');
    окно.classList.add('on');
    окно.querySelector('.zoom-x').focus();
    document.addEventListener('keydown', сКлавиатуры);
  }

  function закрыть() {
    окно.classList.remove('on');
    document.body.classList.remove('zoom-open');
    document.removeEventListener('keydown', сКлавиатуры);
  }

  function листать(шаг) { показать(текущий + шаг); }

  function сКлавиатуры(e) {
    if (e.key === 'Escape') закрыть();
    else if (e.key === 'ArrowLeft') листать(-1);
    else if (e.key === 'ArrowRight') листать(1);
  }
})();
