/* Предложение вынести паб на экран телефона.

   Android и десктопный Chrome умеют это сами — браузер даёт команду,
   мы её ловим и показываем свою кнопку. Айфон так не умеет: там
   показываем короткую подсказку, как это делается вручную.

   Предложение показывается один раз и только на телефоне — навязываться
   на десктопе смысла нет. */
(function () {
  var KEY = 'molly_install';

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* уже установлено — ничего не предлагаем */
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
  if (standalone) { document.documentElement.classList.add('in-app'); return; }
  /* Установил — больше не предлагаем вовсе. А вот отказ от плашки
     кружок не отменяет: плашка спрашивает не вовремя, кружок молча ждёт. */
  if (stored() === 'done') return;
  var плашкуНеПоказывать = stored() === 'no';

  var isPhone = window.innerWidth <= 900;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var prompt = null;

  function box(inner) {
    var el = document.createElement('div');
    el.className = 'install';
    el.innerHTML = inner;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('on'); }, 400);
    return el;
  }

  function close(el, why) {
    el.classList.remove('on');
    setTimeout(function () { el.remove(); }, 300);
    remember(why);
  }

  /* --- Android и Chrome: браузер сам предлагает, мы перехватываем --- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    prompt = e;
    if (!isPhone) return;
    показатьКружок();
    return;   /* дальше плашка — она больше не нужна, есть кружок */

    var el = box(
      '<img src="images/icon-192.png" alt="" width="48" height="48">' +
      '<div class="install-txt">' +
        '<b>Молли на экране «Домой»</b>' +
        '<span>Афиша и меню в одно нажатие, без браузера</span>' +
      '</div>' +
      '<button class="btn btn-gold btn-sm" data-go>Добавить</button>' +
      '<button class="install-x" data-no aria-label="Не надо">×</button>'
    );

    el.querySelector('[data-go]').addEventListener('click', function () {
      close(el, 'done');
      prompt.prompt();
      prompt.userChoice.then(function (r) {
        remember(r && r.outcome === 'accepted' ? 'done' : 'no');
      });
    });
    el.querySelector('[data-no]').addEventListener('click', function () { close(el, 'no'); });
  });

  /* --- айфон: команды нет, показываем как сделать руками --- */
  if (isIOS && isPhone) {
    показатьКружок();
    return;   /* дальше плашка — она больше не нужна, есть кружок */
    setTimeout(function () {
      var el = box(
        '<img src="images/icon-192.png" alt="" width="48" height="48">' +
        '<div class="install-txt">' +
          '<b>Молли на экране «Домой»</b>' +
          '<span>Нажмите <b>Поделиться</b> внизу, затем «На экран «Домой»»</span>' +
        '</div>' +
        '<button class="install-x" data-no aria-label="Понятно">×</button>'
      );
      el.querySelector('[data-no]').addEventListener('click', function () { close(el, 'no'); });
    }, 9000);
  }


  /* --- кружок «поставить приложение» ---
     Плашку внизу гость видит один раз и она уходит навсегда. Кружок
     остаётся на месте: человек ставит приложение, когда сам созреет.
     Показываем только на телефоне и только если установка вообще
     возможна — иначе кнопка обманывала бы. */
  var кружок = null;

  function показатьКружок() {
    if (кружок || !isPhone) return;
    кружок = document.createElement('button');
    кружок.type = 'button';
    кружок.className = 'install-dot';
    кружок.setAttribute('aria-label', 'Поставить Молли на экран «Домой»');
    кружок.title = 'Поставить на экран «Домой»';
    кружок.innerHTML = '<img src="images/icon-192.png" alt="" width="30" height="30">';
    document.body.appendChild(кружок);
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
      } else if (isIOS) {
        подсказкаАйфон();
      }
    });
  }

  function подсказкаАйфон() {
    if (document.querySelector('.install')) return;
    var el = box(
      '<img src="images/icon-192.png" alt="" width="48" height="48">' +
      '<div class="install-txt">' +
        '<b>Молли на экране «Домой»</b>' +
        '<span>Нажмите <b>Поделиться</b> внизу, затем «На экран «Домой»»</span>' +
      '</div>' +
      '<button class="install-x" data-no aria-label="Понятно">×</button>'
    );
    el.querySelector('[data-no]').addEventListener('click', function () {
      el.classList.remove('on');
      setTimeout(function () { el.remove(); }, 300);
    });
  }

  /* регистрируем обслуживающий скрипт — без него установка недоступна */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
