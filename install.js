/* Предложение вынести паб на экран телефона.

   Кружок с эмблемой стоит в шапке, слева от трёх полосок, и ждёт, пока
   гость созреет. По нажатию: если браузер умеет ставить приложение сам —
   отдаём ему команду; если нет (айфон и всё на его движке) — показываем,
   как это делается руками.

   Раньше кружок появлялся только после команды beforeinstallprompt либо
   на айфоне. Команда приходит не всегда и не сразу, а на Android её может
   не быть вовсе — кружка в итоге не было ни там, ни там. Теперь он есть
   на любом телефоне, и нажатие всегда к чему-то приводит.

   Единственная причина не показывать его — паб уже открыт как
   приложение: предлагать установить то, что установлено, незачем. */
(function () {
  var KEY = 'molly_install';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* Уже открыто как приложение — предлагать нечего.
     Отметку в памяти для этого не используем: человек мог удалить
     иконку, а отметка осталась бы навсегда и прятала кружок. */
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
  if (standalone) { document.documentElement.classList.add('in-app'); return; }

  var isPhone = window.innerWidth <= 900;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var prompt = null;
  var кружок = null;

  /* Браузер готов поставить приложение — придерживаем его команду себе:
     покажем свой кружок вместо того, чтобы браузер спрашивал сам. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    prompt = e;
    показатьКружок();
  });

  function показатьКружок() {
    if (кружок || !isPhone) return;
    кружок = document.createElement('button');
    кружок.type = 'button';
    кружок.className = 'install-dot';
    кружок.setAttribute('aria-label', 'Поставить Молли на экран «Домой»');
    кружок.title = 'Поставить на экран «Домой»';
    /* Внутри — сам знак установки, а не эмблема паба: эмблема уже стоит
       в этой же строке слева, и две одинаковые рядом выглядят ошибкой.
       Стрелка рисуется цветом текста кнопки, поэтому на новогодней
       странице сама станет синей вместе с остальной шапкой. */
    кружок.innerHTML =
      '<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false">' +
        '<path d="M12 3.5v10.5m0 0l-4.1-4.1M12 14l4.1-4.1M4.5 19.5h15" ' +
        'fill="none" stroke="currentColor" stroke-width="2.1" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    /* Место кружка — в шапке, слева от трёх полосок: гость ищет кнопки
       там, а не поверх текста. Если шапки почему-то нет, остаётся
       прежнее поведение, чтобы кнопка не пропала совсем. */
    var полоски = document.getElementById('burger');
    if (полоски && полоски.parentNode) полоски.parentNode.insertBefore(кружок, полоски);
    else document.body.appendChild(кружок);

    setTimeout(function () { кружок.classList.add('on'); }, 600);

    кружок.addEventListener('click', function () {
      if (prompt) {
        prompt.prompt();
        prompt.userChoice.then(function (r) {
          if (r && r.outcome === 'accepted') {
            кружок.remove();
            кружок = null;
            remember('done');
          }
        });
      } else {
        подсказка();
      }
    });
  }

  /* Команды от браузера нет — объясняем словами. Текст разный:
     на айфоне кнопка «Поделиться» внизу, в остальных браузерах
     нужный пункт лежит в меню с тремя точками. */
  function подсказка() {
    if (document.querySelector('.install')) return;

    var как = isIOS
      ? 'Нажмите <b>Поделиться</b> внизу, затем «На экран «Домой»»'
      : 'Откройте меню браузера (три точки) и выберите «Установить приложение» или «На главный экран»';

    var el = document.createElement('div');
    el.className = 'install';
    el.innerHTML =
      '<img src="images/icon-192.png" alt="" width="48" height="48">' +
      '<div class="install-txt">' +
        '<b>Молли на экране «Домой»</b>' +
        '<span>' + как + '</span>' +
      '</div>' +
      '<button class="install-x" data-no aria-label="Понятно">×</button>';
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('on'); }, 50);

    el.querySelector('[data-no]').addEventListener('click', function () {
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 300);
    });
  }

  /* Кружок показываем сразу, не дожидаясь команды браузера: она может
     прийти через несколько секунд, а может не прийти никогда. Если
     придёт позже — обработчик выше просто найдёт кружок на месте. */
  if (isPhone) показатьКружок();

  /* регистрируем обслуживающий скрипт — без него установка недоступна */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
