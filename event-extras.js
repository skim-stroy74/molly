/* Две кнопки на карточках афиши:
   «В календарь» — кладёт событие в телефон с напоминанием за день;
   «Поделиться»  — рисует картинку для сторис прямо в браузере.

   Обе работают без сервера: файл календаря и картинка собираются на месте. */
(function () {
  var PUB = 'Паб «Молли»';
  var ADDR = 'Магнитогорск, ул. Завенягина, 8а';
  var PHONE = '+7 (3519) 45-37-37';

  var items = document.querySelectorAll('.bill-item');
  if (!items.length) return;

  /* ---------- файл календаря ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function icsDate(iso, hour) {
    var p = iso.split('-');
    return p[0] + p[1] + p[2] + 'T' + pad(hour) + '0000';
  }

  function makeIcs(data) {
    var start = icsDate(data.from, 18);
    var end = icsDate(data.until, 23);
    var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Molly Pub//RU',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + data.from + '-' + Math.random().toString(36).slice(2) + '@molly',
      'DTSTAMP:' + stamp,
      'DTSTART:' + start,
      'DTEND:' + end,
      'SUMMARY:' + data.title + ' — ' + PUB,
      'DESCRIPTION:' + (data.desc || '').replace(/\n/g, ' ') + '\\nБронь: ' + PHONE,
      'LOCATION:' + ADDR,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Завтра в Молли: ' + data.title,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  /* ---------- картинка для сторис ---------- */
  function makeStory(data, done) {
    var W = 1080, H = 1920;
    var CUT = Math.round(H * 0.58);   /* граница: выше — афиша, ниже — только текст */
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');

    g.fillStyle = '#0d1a12';
    g.fillRect(0, 0, W, H);

    var poster = new Image();
    poster.crossOrigin = 'anonymous';
    poster.onload = function () {
      /* афишу вписываем по ширине и обрезаем по границе — текст на неё не лезет */
      g.save();
      g.beginPath();
      g.rect(0, 0, W, CUT);
      g.clip();
      var r = Math.max(W / poster.width, CUT / poster.height);
      var w = poster.width * r, h = poster.height * r;
      g.drawImage(poster, (W - w) / 2, 0, w, h);
      g.restore();

      /* афиша растворяется в фоне, чтобы стык не резал глаз */
      var grad = g.createLinearGradient(0, CUT - 230, 0, CUT);
      grad.addColorStop(0, 'rgba(13,26,18,0)');
      grad.addColorStop(0.6, 'rgba(13,26,18,0.75)');
      grad.addColorStop(1, 'rgba(13,26,18,1)');
      g.fillStyle = grad;
      g.fillRect(0, CUT - 230, W, 230);

      var logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.onload = function () { draw(logo); };
      logo.onerror = function () { draw(null); };
      logo.src = 'images/logo.png';

      function draw(logoImg) {
        var y = CUT + 96;

        g.textAlign = 'center';

        g.fillStyle = '#d98b2b';
        g.font = '600 38px Georgia, serif';
        g.letterSpacing = '10px';
        g.fillText('Я ИДУ', W / 2, y);
        g.letterSpacing = '0px';

        y += 116;
        g.fillStyle = '#f2ead8';
        var size = data.title.length > 18 ? 84 : 104;
        var lh = size * 1.14;
        g.font = '500 ' + size + 'px Bitter, Georgia, serif';
        var lines = wrap(g, data.title, W / 2, y, W - 160, lh);

        y += (lines - 1) * lh + 92;
        g.fillStyle = '#e0bc74';
        g.font = '600 50px Georgia, serif';
        g.fillText(data.date, W / 2, y);

        y += 66;
        g.fillStyle = '#a3b09f';
        g.font = '400 36px -apple-system, Arial, sans-serif';
        g.fillText(ADDR, W / 2, y);

        if (logoImg) {
          var lw = 200, lgh = logoImg.height * (lw / logoImg.width);
          g.drawImage(logoImg, (W - lw) / 2, H - 90 - lgh, lw, lgh);
        } else {
          g.fillStyle = '#c8a45a';
          g.font = '500 54px Bitter, Georgia, serif';
          g.fillText('Паб Молли', W / 2, H - 110);
        }

        c.toBlob(function (blob) { done(blob); }, 'image/jpeg', 0.92);
      }
    };
    poster.onerror = function () { done(null); };
    poster.src = data.poster;
  }

  function wrap(g, text, x, y, maxW, lh) {
    var words = text.split(' '), line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    lines.push(line);
    for (var j = 0; j < lines.length; j++) g.fillText(lines[j], x, y + j * lh);
    return lines.length;
  }

  /* ---------- собираем кнопки ---------- */
  [].forEach.call(items, function (item) {
    var from = item.getAttribute('data-from');
    var until = item.getAttribute('data-until') || from;
    if (!from) return;

    var titleEl = item.querySelector('h3');
    var dateEl = item.querySelector('.bill-date b');
    var descEl = item.querySelector('.bill-desc');
    var picEl = item.querySelector('.bill-pic img');
    if (!titleEl || !dateEl) return;

    var data = {
      from: from, until: until,
      title: titleEl.textContent.trim(),
      date: dateEl.textContent.trim(),
      desc: descEl ? descEl.textContent.trim() : '',
      poster: picEl ? picEl.getAttribute('src') : ''
    };

    var box = item.querySelector('.bill-cta');
    if (!box) {
      box = document.createElement('div');
      box.className = 'bill-cta';
      var btn = item.querySelector('.bill-body > .btn');
      if (btn) { btn.parentNode.insertBefore(box, btn); box.appendChild(btn); }
      else item.querySelector('.bill-body').appendChild(box);
    }

    var cal = document.createElement('button');
    cal.type = 'button';
    cal.className = 'btn btn-ghost btn-sm';
    cal.textContent = 'В календарь';
    cal.addEventListener('click', function () {
      save(new Blob([makeIcs(data)], { type: 'text/calendar;charset=utf-8' }),
           'molly-' + data.from + '.ics');
      cal.textContent = 'Добавлено';
      setTimeout(function () { cal.textContent = 'В календарь'; }, 2500);
    });
    box.appendChild(cal);

    if (data.poster) {
      var share = document.createElement('button');
      share.type = 'button';
      share.className = 'btn btn-ghost btn-sm';
      share.textContent = 'Поделиться';
      share.addEventListener('click', function () {
        share.disabled = true;
        share.textContent = 'Рисую…';
        makeStory(data, function (blob) {
          share.disabled = false;
          share.textContent = 'Поделиться';
          if (!blob) return;
          var file = new File([blob], 'molly-' + data.from + '.jpg', { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: data.title }).catch(function () {});
          } else {
            save(blob, 'molly-' + data.from + '.jpg');
          }
        });
      });
      box.appendChild(share);
    }
  });
})();
