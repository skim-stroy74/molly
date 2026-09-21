/* Появление блоков при прокрутке на новогодней странице.

   На остальных страницах этим занимается motion.js, но сюда он не
   подключён — там много лишнего для одной страницы. Набор заголовков
   по буквам живёт отдельно, в type.js, и работает на всём сайте.  */
(function () {
  var блоки = document.querySelectorAll('.rv');
  if (!блоки.length) return;

  var тише = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function показать(el) { el.classList.add('in'); }

  if (тише || !('IntersectionObserver' in window)) {
    [].forEach.call(блоки, показать);
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
})();
