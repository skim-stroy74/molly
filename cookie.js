/* Уведомление об использовании cookie.
   Показывается один раз, выбор запоминается в браузере.
   Аналитику подключаем только после согласия — до него счётчик не грузится. */
(function () {
  var KEY = 'molly_cookie';

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  /* Сюда позже встанет Яндекс.Метрика. Пока счётчика нет,
     функция ничего не делает — но согласие уже собирается правильно. */
  function startAnalytics() {
    if (window.mollyAnalytics) { try { window.mollyAnalytics(); } catch (e) {} }
  }

  if (saved() === 'yes') { startAnalytics(); return; }
  if (saved() === 'no') { return; }

  function build() {
    var box = document.createElement('div');
    box.className = 'cookie';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Уведомление о файлах cookie');

    var p = document.createElement('p');
    p.innerHTML = 'Мы используем файлы cookie, чтобы сайт работал корректно и чтобы понимать, ' +
      'какие разделы вам интересны. Подробнее — в <a href="politika.html">политике конфиденциальности</a>.';

    var yes = document.createElement('button');
    yes.className = 'btn btn-gold btn-sm';
    yes.type = 'button';
    yes.textContent = 'Принять';

    var no = document.createElement('button');
    no.className = 'btn btn-ghost btn-sm';
    no.type = 'button';
    no.textContent = 'Только необходимые';

    /* Пока баннер висит, он занимает низ экрана — а помощница живёт там же.
       Поднимаем её ровно на высоту баннера: считаем по факту, поэтому
       подходит любому экрану и любой длине текста. */
    function поднятьПомощницу(надо) {
      var узлы = document.querySelectorAll('.asst, .self-bar');
      if (!узлы.length) return;
      /* именно сдвиг, а не отступ: отступ на этом блоке молча не срабатывал */
      var сдвиг = надо ? 'translateY(-' + (box.offsetHeight + 16) + 'px)' : '';
      [].forEach.call(узлы, function (n) { n.style.transform = сдвиг; });
    }

    function close(){
      box.classList.remove('on');
      document.body.classList.remove('cookie-open');
      поднятьПомощницу(false);
    }

    yes.addEventListener('click', function () {
      save('yes'); close(); startAnalytics();
    });
    no.addEventListener('click', function () {
      save('no'); close();
    });

    box.appendChild(p);
    box.appendChild(no);
    box.appendChild(yes);
    document.body.appendChild(box);

    /* небольшая задержка, чтобы баннер не перекрывал первый экран сразу */
    setTimeout(function () {
      box.classList.add('on');
      document.body.classList.add('cookie-open');
      поднятьПомощницу(true);
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
