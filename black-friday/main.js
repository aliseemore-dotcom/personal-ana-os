(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var t = function (v) { return (v == null ? '' : String(v)).trim(); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var NB = ' ';
  var draft = C.previewMode !== false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---------- Типограф: неразрывные пробелы ----------
  var SHORT = 'в|во|с|со|к|ко|у|о|об|от|до|по|за|на|из|без|для|при|про|над|под|и|а|но|да|или|не|ни|что|как|же|ли|бы|то';
  var RE_SHORT = new RegExp('(^|[^\\p{L}\\p{N}])(' + SHORT + ')[ \\t\\n]+', 'giu');
  var RE_DASH = /[ \t\n]+—/g;
  var RE_NUM = /(\d)[ \t]+(?=[\p{L}₽%])/gu;
  function typo(s) {
    var prev;
    do { prev = s; s = s.replace(RE_SHORT, '$1$2' + NB); } while (s !== prev);
    return s.replace(RE_DASH, NB + '—').replace(RE_NUM, '$1' + NB);
  }
  function typografy(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return p === 'SCRIPT' || p === 'STYLE' || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (x) { var v = typo(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  }

  // ---------- Данные ----------
  var fmt = function (n) { return Number(n).toLocaleString('ru-RU').replace(/ | |\s/g, NB) + NB + '₽'; };
  var pctOf = function (n, o) { return o > n ? Math.round((1 - n / o) * 100) : 0; };
  var num = function (v, d) { return v != null && v !== '' ? Number(v) : d; };

  var cp = num(C.coursePrice, 3990), sp = num(C.sunmakeupPrice, 1990), bp = num(C.bundlePrice, 5690);
  var cOld = num(C.courseOldPrice, 7000), sOld = num(C.sunmakeupOldPrice, 5000), bOld = num(C.bundleOldPrice, 12000);
  var cPct = pctOf(cp, cOld), sPct = pctOf(sp, sOld), bPct = pctOf(bp, bOld);
  var bSave = bOld - bp;
  var disc = function (o, pc) { return pc > 0 ? { old: fmt(o), pct: '−' + pc + '%' } : { old: '', pct: '' }; };

  var endStr = t(C.saleEndsAt) || '2026-11-30T23:59:59+03:00';
  var end = Date.parse(endStr);
  var hasEnd = !isNaN(end);
  var dateStr = '';
  if (hasEnd) {
    try { dateStr = new Date(end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: t(C.timeZone) || 'Europe/Moscow' }); }
    catch (e) { dateStr = new Date(end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
  }
  var expired = function () { return hasEnd && Date.now() >= end; };

  var courseAccess = t(C.courseAccess) || '3 месяца';
  var sunAccess = t(C.sunmakeupAccess) || '3 месяца';
  var bunAccess = t(C.bundleAccess) || '5 месяцев';
  var delivery = t(C.accessDelivery);

  function btn(url, label) {
    var has = !!t(url);
    return { show: has || draft, label: label, href: has ? t(url) : '#', dead: !has };
  }
  var BTN = {
    course: btn(C.courseCheckoutUrl, 'Купить обучение'),
    sun: btn(C.sunmakeupCheckoutUrl, 'Купить мастер-класс'),
    bundle: btn(C.bundleCheckoutUrl, 'Купить комплект')
  };
  var D = { course: disc(cOld, cPct), sun: disc(sOld, sPct), bundle: disc(bOld, bPct) };

  var LESSONS = ['Повседневный макияж', 'Вечерний и праздничный макияж', 'Smoky eyes', 'Макияж-трансформер 5 в 1'];
  var SUN_ITEMS = ['База, которая решает всё', 'Невесомое покрытие', 'Макияж «без макияжа»', 'SOS-освежение и гайд в подарок'];

  var PRODUCTS = [
    { id: 'course', kicker: '', title: 'Обучение макияжу', sub: 'От дневного образа до вечернего: стрелки, smoky eyes и макияж-трансформер',
      meta: '4 урока · 11 разных макияжей · доступ на ' + courseAccess, img: 'bathroom', alt: 'Эльмира красит губы у зеркала', pos: '50% 20%',
      items: LESSONS, price: fmt(cp), d: D.course, btn: BTN.course },
    { id: 'sunmakeup', kicker: 'Мастер-класс', title: 'Стойкий макияж без эффекта маски', sub: 'Один образ с нуля и все мои секреты стойкости',
      meta: 'Доступ на ' + sunAccess, img: 'evening', alt: 'Эльмира с карандашом для губ', pos: '45% 30%',
      items: SUN_ITEMS, price: fmt(sp), d: D.sun, btn: BTN.sun }
  ];

  var OFFERS = {
    sun: { key: 'sun', name: 'Мастер-класс «Стойкий макияж»', price: fmt(sp), d: D.sun, btn: BTN.sun, save: sOld > sp ? 'Экономия ' + fmt(sOld - sp) : '' },
    course: { key: 'course', name: 'Обучение макияжу', price: fmt(cp), d: D.course, btn: BTN.course, save: cOld > cp ? 'Экономия ' + fmt(cOld - cp) : '' },
    bundle: { key: 'bundle', name: 'Обучение + мастер-класс', price: fmt(bp), d: D.bundle, btn: BTN.bundle, featured: true, save: bSave > 0 ? 'Экономия ' + fmt(bSave) : '' }
  };

  // ---------- Картинки (адреса можно переопределить в config.js → images) ----------
  document.querySelectorAll('img[data-img]').forEach(function (im) {
    var u = C.images && C.images[im.getAttribute('data-img')];
    if (u) im.src = u;
  });
  function imgSrc(name) { return (C.images && C.images[name]) || 'assets/' + name + '.jpg'; }

  // ---------- Кнопка покупки ----------
  function buyLink(cls, b) {
    var a = '<a class="btn ' + cls + '" data-buy href="' + esc(b.href) + '"' + (b.dead ? ' data-dead="1"' : '') + (b.show ? '' : ' hidden') + '>' + esc(b.label) + '</a>';
    return a;
  }

  // ---------- Блоки продуктов ----------
  var prodHtml = PRODUCTS.map(function (p) {
    return '<section id="' + p.id + '" class="prod"><div class="prod__in">' +
      '<div class="prod__head"><div class="prod__title">' + (p.kicker ? '<span class="kicker">' + esc(p.kicker) + '</span>' : '') +
      '<h2 class="h2">' + esc(p.title) + '</h2></div>' +
      '<div class="prod__side"><p class="prod__sub">' + esc(p.sub) + '</p><span class="prod__meta">' + esc(p.meta) + '</span></div></div>' +
      '<div class="prod__grid"><div class="prod__photo"><img src="' + esc(imgSrc(p.img)) + '" alt="' + esc(p.alt) + '" loading="lazy" style="object-position:' + p.pos + '"></div>' +
      '<div class="prod__items">' + p.items.map(function (it, i) {
        return '<div class="item"><span class="item__t">' + esc(it) + '</span><span class="item__n">' + pad(i + 1) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="strip"><div class="strip__prices"><span class="price strip__price">' + p.price + '</span>' +
      (p.d.old ? '<s class="strip__old">' + p.d.old + '</s><span class="pct">' + p.d.pct + '</span>' : '') + '</div>' +
      buyLink('btn--white strip__btn', p.btn) +
      '<span class="ended" data-ended hidden>Распродажа завершена</span></div>' +
      '</div></section>';
  }).join('');
  $('products').innerHTML = prodHtml;

  // ---------- Карточки тарифов ----------
  var mqWide = window.matchMedia('(min-width: 1000px)');
  function cardHtml(o) {
    var inner = '<article class="card' + (o.featured ? ' card--feat' : '') + '">' +
      '<div class="card__badges">' + (o.d.pct ? '<span class="card__pct">' + o.d.pct + '</span>' : '') +
      (o.featured ? '<span class="card__hot">Самый выгодный</span>' : '') + '</div>' +
      '<h3 class="card__name">' + esc(o.name) + '</h3>' +
      '<div class="card__foot"><div class="card__prices"><span class="card__price">' + o.price + '</span>' +
      (o.d.old ? '<s class="card__old">' + o.d.old + '</s>' : '') + '</div>' +
      buyLink('card__btn', o.btn) +
      (o.save ? '<span class="card__save">' + o.save + '</span>' : '') +
      '<span class="card__ended" data-ended hidden>Распродажа завершена</span></div></article>';
    if (o.featured) return '<div class="card-wrap" id="offer-bundle"><div class="card-wrap__shadow" aria-hidden="true"></div>' + inner + '</div>';
    return inner;
  }
  var lastWide = null;
  function renderCards() {
    var wide = mqWide.matches;
    if (wide === lastWide) return;
    lastWide = wide;
    var order = wide ? ['sun', 'course', 'bundle'] : ['bundle', 'course', 'sun']; // порядок в DOM = визуальный
    var box = $('cards');
    box.innerHTML = order.map(function (k) { return cardHtml(OFFERS[k]); }).join('');
    bindBuy(box);
    typografy(box);
    syncState();
  }
  function bindBuy(root) {
    root.querySelectorAll('[data-dead]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  }
  bindBuy($('products'));

  // ---------- Шаги ----------
  var STEPS = [
    ['Пришлю доступ на почту' + (delivery ? ' ' + delivery : ''), 'envelope', 'Письмо с доступом', 'contain'],
    ['Смотрите уроки в своём темпе', 'tablet', 'Урок на планшете', 'contain'],
    ['Повторяйте за мной у зеркала', 'elmira-mirror', 'Эльмира у зеркала', 'cover']
  ];
  $('steps').innerHTML = STEPS.map(function (s, i) {
    return '<div class="step"><div class="step__img"><img src="' + esc(imgSrc(s[1])) + '" alt="' + esc(s[2]) + '" loading="lazy" style="object-fit:' + s[3] + '"></div>' +
      '<div class="step__row"><span class="step__n">' + pad(i + 1) + '</span><span class="step__t">' + esc(s[0]) + '</span></div></div>';
  }).join('');

  // ---------- FAQ ----------
  var FAQ = [
    ['У меня нет навыков визажиста. У меня получится?', 'Получится. Я показываю каждый шаг, поэтому вы спокойно повторите за мной в своём темпе.'],
    ['Это прямой эфир? Вдруг я не успею?', 'Нет, уроки уже записаны. Смотрите, когда удобно, ставьте на паузу и возвращайтесь к нужному моменту.'],
    ['Чем выгоден комплект?', bPct > 0
      ? 'Комплект стоит ' + fmt(bp) + ' вместо ' + fmt(bOld) + ': скидка ' + bPct + '%, экономия ' + fmt(bSave) + '. Доступ на ' + bunAccess + '.'
      : 'Комплект стоит ' + fmt(bp) + '. Доступ на ' + bunAccess + '.'],
    ['Как долго доступны материалы?', 'Обучение и мастер-класс по отдельности — ' + courseAccess + ', комплект — ' + bunAccess + '.'],
    ['Как оплатить? Есть рассрочка?', t(C.faqPayment) || (draft ? '[Способы оплаты и условия рассрочки]' : '')],
    ['Можно ли вернуть деньги?', t(C.faqRefund) || (draft ? '[Условия возврата по договору оферты]' : '')]
  ].filter(function (f) { return f[1]; });
  var faqBox = $('faq'), faqSetters = [];
  FAQ.forEach(function (f, i) {
    var item = document.createElement('div'); item.className = 'faq__item';
    var q = document.createElement('button'); q.type = 'button'; q.className = 'faq__q'; q.id = 'faq-q' + i;
    q.setAttribute('aria-controls', 'faq-a' + i);
    var qs = document.createElement('span'); qs.textContent = f[0];
    var sign = document.createElement('span'); sign.className = 'faq__sign';
    q.appendChild(qs); q.appendChild(sign);
    var a = document.createElement('p'); a.className = 'faq__a'; a.id = 'faq-a' + i; a.textContent = f[1];
    a.setAttribute('role', 'region'); a.setAttribute('aria-labelledby', q.id);
    function set(open) { q.setAttribute('aria-expanded', open ? 'true' : 'false'); sign.textContent = open ? '−' : '+'; a.hidden = !open; }
    set(i === 0);
    q.addEventListener('click', function () {
      var willOpen = q.getAttribute('aria-expanded') !== 'true';
      faqSetters.forEach(function (s) { s(false); });
      set(willOpen);
    });
    faqSetters.push(set);
    item.appendChild(q); item.appendChild(a); faqBox.appendChild(item);
  });

  // ---------- Подвал ----------
  var seller = t(C.sellerDetails) || (draft ? '[ИП, ИНН продавца]' : '');
  if (seller) { $('footSeller').hidden = false; $('footSeller').textContent = seller; }
  var privHref = t(C.privacyPolicyUrl) || (draft ? '#' : '');
  var offerHref = t(C.offerUrl) || (draft ? '#' : '');
  if (privHref) { $('footPrivacy').hidden = false; $('footPrivacy').href = privHref; }
  if (offerHref) { $('footOffer').hidden = false; $('footOffer').href = offerHref; }
  var support = t(C.supportContact) || (draft ? '[контакт поддержки]' : '');
  if (support) { var fs = $('footSupport'); fs.hidden = false; fs.textContent = 'Помощь с оплатой: ' + support; fs.href = t(C.supportUrl) || '#'; }

  // ---------- Бегущая строка ----------
  var phrases = [['Black Friday', '#FFFFFF'], ['Обучение макияжу', '#FFFFFF'], [dateStr ? 'Только до ' + dateStr : 'Только сейчас', '#BDBDBD']];
  var mq = $('marquee');
  for (var r = 0; r < 4; r++) phrases.forEach(function (p) {
    var s1 = document.createElement('span'); s1.className = 'marquee__t'; s1.style.color = p[1]; s1.textContent = typo(p[0]);
    var s2 = document.createElement('span'); s2.className = 'marquee__sep';
    mq.appendChild(s1); mq.appendChild(s2);
  });

  // ---------- Состояние акции ----------
  var timer = $('barTimer'), timerEls = [];
  ['д', 'ч', 'м', 'с'].forEach(function (l) {
    var u = document.createElement('span'); u.className = 'bar__unit';
    var v = document.createElement('b'); v.textContent = '0';
    var s = document.createElement('i'); s.textContent = l;
    u.appendChild(v); u.appendChild(s); timer.appendChild(u); timerEls.push(v);
  });
  var mqNarrow = window.matchMedia('(max-width: 759px)');
  function syncState() {
    var ex = expired();
    document.documentElement.classList.toggle('is-ended', ex);
    document.querySelectorAll('[data-ended]').forEach(function (n) { n.hidden = !ex; });
    $('heroEnded').hidden = !ex;
    $('barEnded').hidden = !ex;
    $('barTimer').hidden = ex || !hasEnd;
    var badge = $('barBadge');
    badge.hidden = ex || !bPct;
    badge.textContent = bPct ? (mqNarrow.matches ? '−' + bPct + '%' : 'Комплект −' + bPct + '%') : '';
    $('barNote').textContent = !ex && dateStr ? typo('Цены снижены до ' + dateStr + ' включительно') : '';
    $('offersNote').textContent = typo(ex ? 'Распродажа завершена' : (dateStr ? 'Цены Black Friday действуют до ' + dateStr + ' включительно' : 'Цены Black Friday'));
    $('finalLine').textContent = typo(ex ? 'Распродажа завершена' : (bPct > 0 ? 'Комплект −' + bPct + '% и экономия ' + fmt(bSave) : 'Скидки на обучение') + (dateStr ? ' — до ' + dateStr : ''));
  }
  function tick() {
    if (!hasEnd) return;
    var diff = Math.max(0, end - Date.now());
    var s = Math.floor(diff / 1000);
    var vals = [String(Math.floor(s / 86400)), pad(Math.floor(s % 86400 / 3600)), pad(Math.floor(s % 3600 / 60)), pad(s % 60)];
    vals.forEach(function (v, i) { if (timerEls[i].textContent !== v) timerEls[i].textContent = v; });
    if (diff <= 0) syncState();
  }

  // ---------- Прокрутка ----------
  function scrollToId(id) {
    var node = $(id);
    if (!node) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var off = window.innerWidth < 760 ? 52 : 56;
    var sc = document.scrollingElement || document.documentElement;
    sc.scrollTo({ top: node.getBoundingClientRect().top + sc.scrollTop - off, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-go]');
    if (!g) return;
    e.preventDefault();
    scrollToId(g.getAttribute('data-go'));
  });

  // ---------- Запуск ----------
  syncState();
  typografy($('bf-root') || document.body);
  renderCards();
  syncState();
  tick();
  mqWide.addEventListener ? mqWide.addEventListener('change', renderCards) : mqWide.addListener(renderCards);
  mqNarrow.addEventListener ? mqNarrow.addEventListener('change', syncState) : mqNarrow.addListener(syncState);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
})();
