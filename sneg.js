/* Снег по всей странице и кнопка, которой его можно выключить.

   Включается классом ny у тела страницы — тем же, которым включено
   остальное новогоднее оформление. Убрали класс в январе — вместе
   с гирляндой пропадёт и снег, и кнопка.

   Слой снега один на всю страницу и прибит к окну, а не к первому
   экрану: иначе при прокрутке снег кончался бы вместе с шапкой.
   Сквозь него ничего не нажимается — pointer-events отключены.

   Выбор гостя запоминается: выключил снег — он остаётся выключенным
   и на других страницах, и при следующем заходе. */
(function () {
  if (!document.body.classList.contains('ny')) return;

  var КЛЮЧ = 'molly_sneg';

  function выбор() {
    try { return localStorage.getItem(КЛЮЧ); } catch (e) { return null; }
  }
  function запомнить(v) {
    try { localStorage.setItem(КЛЮЧ, v); } catch (e) {}
  }

  /* При системной настройке «меньше движения» снега нет по умолчанию:
     человек уже сказал системе, что анимация ему мешает. Включить
     вручную всё равно можно — кнопка на месте. */
  var тише = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var идёт = выбор() === null ? !тише : выбор() === 'да';

  var слой = document.createElement('div');
  слой.className = 'sneg';
  слой.setAttribute('aria-hidden', 'true');
  document.body.appendChild(слой);

  /* Кнопка встаёт к кружкам мессенджеров: там гость уже привык искать
     круглые кнопки, и отдельный угол под неё занимать незачем. */
  var гнездо = document.querySelector('.mess');
  var кнопка = document.createElement('button');
  кнопка.type = 'button';
  кнопка.className = 'mess-a sneg-кнопка';
  (гнездо || document.body).appendChild(кнопка);

  /* Шестилучевая снежинка с ёлочкой на каждом луче — та, которую
     все и представляют. Рисуем сами: присланная картинка оказалась
     платным стоком с водяными знаками, ставить её на сайт нельзя,
     а форма снежинки ничья. Луч задан один и повёрнут шесть раз. */
  function снежинка(включено) {
    var луч =
      '<path d="M12 12V2.5"/>' +
      '<path d="M12 5.3 14.7 2.6M12 5.3 9.3 2.6"/>' +
      '<path d="M12 8.9 13.9 7M12 8.9 10.1 7"/>';
    var лучи = '';
    for (var угол = 0; угол < 360; угол += 60) {
      лучи += '<g transform="rotate(' + угол + ' 12 12)">' + луч + '</g>';
    }
    return '<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" focusable="false">' +
      '<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' + лучи + '</g>' +
      (включено ? '' : '<path d="M4 20 20 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>') +
      '</svg>';
  }

  function показать() {
    слой.classList.toggle('on', идёт);
    кнопка.innerHTML = снежинка(идёт);
    var подпись = идёт ? 'Выключить снег' : 'Включить снег';
    кнопка.setAttribute('aria-label', подпись);
    кнопка.setAttribute('aria-pressed', идёт ? 'true' : 'false');
    кнопка.title = подпись;
  }

  кнопка.addEventListener('click', function () {
    идёт = !идёт;
    запомнить(идёт ? 'да' : 'нет');
    показать();
  });

  показать();
})();
