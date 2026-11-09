(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var t = function (v) { return (v == null ? '' : String(v)).trim(); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var NB = ' ';
  var draft = C.previewMode !== false;

  // ---------- Типограф: неразрывные пробелы ----------
  var SHORT = 'в|во|с|со|к|ко|у|о|об|обо|от|до|по|за|на|из|изо|без|для|при|про|над|под|перед|через|между|и|а|но|да|или|не|ни|что|как|же|ли|бы|то|ещё|уже|мы|вы|я|он|она|они|это|вам|вас|нас|нам|так|тут|там|где|вот|все|всё|вместе|ваш|наш|мой|свой|своё|своя';
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

  var cp = C.coursePrice != null ? C.coursePrice : 3990;
  var sp = C.sunmakeupPrice != null ? C.sunmakeupPrice : 1990;
  var bp = C.bundlePrice != null ? C.bundlePrice : 5780;
  var cOld = C.courseOldPrice != null ? C.courseOldPrice : 5500;
  var sOld = C.sunmakeupOldPrice != null ? C.sunmakeupOldPrice : 3000;
  var separate = cp + sp, save = separate - bp;
  var cPct = pctOf(cp, cOld), sPct = pctOf(sp, sOld);
  var maxN = Math.max(cPct, sPct);
  var maxPct = maxN > 0 ? maxN + '%' : '';

  var endStr = t(C.saleEndsAt);
  var end = endStr ? Date.parse(endStr) : NaN;
  var hasEnd = !isNaN(end);
  var dateStr = '';
  if (hasEnd) {
    try {
      dateStr = new Date(end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: t(C.timeZone) || undefined });
    } catch (e) {
      dateStr = new Date(end).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }
  }
  var expired = function () { return hasEnd && Date.now() >= end; };

  var courseAccess = t(C.courseAccess) || '3 месяца';
  var sunAccess = t(C.sunmakeupAccess) || (draft ? '[срок мастер-класса]' : '');
  var delivery = t(C.accessDelivery);

  function btn(url, label) {
    var has = !!t(url);
    return { show: has || draft, label: label, href: has ? t(url) : '#', dead: !has };
  }
  var BTN = {
    course: btn(C.courseCheckoutUrl, 'Купить курс'),
    sun: btn(C.sunmakeupCheckoutUrl, 'Купить мастер-класс'),
    bundle: btn(C.bundleCheckoutUrl, 'Купить комплект')
  };
  function applyBtn(el, b) {
    el.setAttribute('href', b.href);
    el.dataset.buy = '1';
    if (b.dead) el.addEventListener('click', function (e) { e.preventDefault(); });
    else { el.target = '_self'; }
    el.dataset.show = b.show ? '1' : '';
  }

  var OFFERS = {
    sun: {
      key: 'sun', name: 'Мастер-класс «Стойкий макияж»',
      forWho: 'Для тех, кто хочет освоить один образ с нуля и понять, как сделать макияж стойким.',
      inside: 'Видеоурок и гайд по косметике',
      access: sunAccess ? 'Доступ на ' + sunAccess + ' сразу после оплаты' : 'Доступ сразу после оплаты',
      price: fmt(sp), old: sPct ? fmt(sOld) : '', pct: sPct ? '−' + sPct + '%' : '', btn: BTN.sun
    },
    course: {
      key: 'course', name: 'Курс «Обучение макияжу»',
      forWho: 'Для тех, кто хочет уверенно краситься на каждый день, делать стрелки и smoky eyes.',
      inside: 'Видеоуроки и гайд по косметике',
      access: 'Доступ на ' + courseAccess + ' сразу после оплаты',
      price: fmt(cp), old: cPct ? fmt(cOld) : '', pct: cPct ? '−' + cPct + '%' : '', btn: BTN.course
    },
    bundle: {
      key: 'bundle', name: 'Комплект «Курс + мастер-класс»', featured: true,
      forWho: 'Разные образы из курса и отдельный урок о том, как сохранить макияж свежим в течение дня.',
      inside: 'Курс, мастер-класс и оба гайда',
      access: 'Доступ сразу после оплаты: курс — ' + courseAccess + (sunAccess ? ', мастер-класс — ' + sunAccess : ''),
      price: fmt(bp), old: save > 0 ? fmt(separate) : '', oldNote: save > 0 ? 'По отдельности в дни акции' : '',
      badge: save > 0 ? 'Ещё −' + fmt(save) : '', btn: BTN.bundle
    }
  };

  // ---------- Хелперы DOM ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Карточки тарифов ----------
  var mqWide = window.matchMedia('(min-width: 1000px)');
  function card(o, full) {
    var a = el('article', 'card' + (o.featured ? ' card--feat' : ''));
    if (full && o.key === 'bundle') a.id = 'offer-bundle';
    if (o.featured) { if (o.badge) a.appendChild(el('span', 'card__badge', o.badge)); }
    else if (o.pct) a.appendChild(el('span', 'card__pct', o.pct));
    a.appendChild(el('h3', 'card__name', o.name));
    if (full) {
      a.appendChild(el('p', 'card__for', o.forWho));
      var ins = el('div', 'card__inside');
      ins.appendChild(el('span', null, o.inside));
      ins.appendChild(el('span', null, o.access));
      a.appendChild(ins);
    }
    var foot = el('div', 'card__foot');
    var prices = el('div', 'card__prices');
    var row = el('div', 'card__pricerow');
    row.appendChild(el('span', 'card__price', o.price));
    if (o.old) row.appendChild(el('s', 'card__old', o.old));
    prices.appendChild(row);
    if (o.oldNote) prices.appendChild(el('span', 'card__oldnote', o.oldNote));
    foot.appendChild(prices);
    var b = el('a', 'card__btn');
    if (o.featured) { b.appendChild(el('span', null, '✦')); b.appendChild(el('span', null, o.btn.label)); b.appendChild(el('span', null, '✦')); }
    else b.textContent = o.btn.label;
    applyBtn(b, o.btn);
    foot.appendChild(b);
    var ended = el('span', 'card__ended', 'Распродажа завершена');
    ended.setAttribute('data-ended', '');
    foot.appendChild(ended);
    a.appendChild(foot);
    return a;
  }
  var lastWide = null;
  function renderCards() {
    var wide = mqWide.matches;
    if (wide === lastWide) return;
    lastWide = wide;
    // Порядок в DOM = визуальный порядок
    var order = wide ? ['sun', 'course', 'bundle'] : ['bundle', 'course', 'sun'];
    [['offersFull', true], ['offersCompact', false]].forEach(function (p) {
      var box = $(p[0]);
      box.textContent = '';
      order.forEach(function (k) { box.appendChild(card(OFFERS[k], p[1])); });
      typografy(box);
    });
    syncState();
  }

  // ---------- Состояние акции ----------
  function syncState() {
    var ex = expired();
    document.documentElement.classList.toggle('is-ended', ex);
    document.querySelectorAll('[data-buy]').forEach(function (a) { a.hidden = ex || !a.dataset.show; });
    document.querySelectorAll('[data-ended]').forEach(function (n) { n.hidden = !ex; });
    $('heroEnded').hidden = !ex;
    $('sticker').hidden = ex || !maxPct;
    $('barEnded').hidden = !ex;
    $('barTimer').hidden = ex || !hasEnd;
    document.querySelector('.bar__btn').hidden = ex;
    var narrow = window.matchMedia('(max-width: 759px)').matches;
    var badge = $('barBadge');
    badge.hidden = ex || !maxPct;
    badge.textContent = maxPct ? (narrow ? 'до ' + maxPct : 'Скидки до ' + maxPct) : '';
    $('barNote').textContent = !ex && dateStr ? typo('Цены на обучение снижены до ' + dateStr + ' включительно') : '';
    var hd = $('heroDate');
    hd.hidden = ex || !dateStr;
    hd.textContent = dateStr ? typo('Цены Black Friday действуют до ' + dateStr + ' включительно') : '';
  }

  // ---------- Таймер ----------
  var timer = $('barTimer'), timerEls = [];
  ['д', 'ч', 'м', 'с'].forEach(function (l) {
    var u = el('span', 'bar__unit'), v = el('b', null, '0'), s = el('i', null, l);
    u.appendChild(v); u.appendChild(s); timer.appendChild(u); timerEls.push(v);
  });
  function tick() {
    if (!hasEnd) return;
    var diff = Math.max(0, end - Date.now());
    var s = Math.floor(diff / 1000);
    var vals = [String(Math.floor(s / 86400)), pad(Math.floor(s % 86400 / 3600)), pad(Math.floor(s % 3600 / 60)), pad(s % 60)];
    vals.forEach(function (v, i) { if (timerEls[i].textContent !== v) timerEls[i].textContent = v; });
    if (diff <= 0) { syncState(); }
  }

  // ---------- Статичные секции ----------
  document.querySelectorAll('.js-maxpct').forEach(function (n) { n.textContent = maxPct; });
  $('heroBlackPct').hidden = !maxPct;

  // Курс
  var lessons = ['Повседневный макияж', 'Вечерний и праздничный макияж', 'Smoky eyes', 'Макияж-трансформер 5 в 1'];
  lessons.forEach(function (title, i) {
    var li = el('li');
    li.appendChild(el('span', 'n', pad(i + 1)));
    li.appendChild(el('span', 't', title));
    $('lessons').appendChild(li);
  });
  $('courseSummary').textContent = 'Доступ на ' + courseAccess + ' после покупки';
  $('coursePrice').textContent = fmt(cp);
  $('courseBundlePrice').textContent = fmt(bp);
  if (cPct) {
    var cd = $('courseDisc');
    cd.hidden = false;
    cd.querySelector('s').textContent = fmt(cOld);
    cd.querySelector('.pct').textContent = '−' + cPct + '%';
  }
  applyBtn($('courseBtn'), BTN.course);

  // Мастер-класс
  ['Как подготовить кожу и нанести уход', 'Как использовать SPF под макияжем', 'Как нанести тон, чтобы он не скатывался', 'Как сделать макияж стойким', 'Как адаптировать праздничный образ для будней'].forEach(function (text, i) {
    var li = el('li');
    li.appendChild(el('span', 'n', pad(i + 1)));
    li.appendChild(el('span', null, text));
    $('topics').appendChild(li);
  });
  if (sunAccess) { $('sunSummary').hidden = false; $('sunSummary').textContent = 'Доступ на ' + sunAccess + ' после покупки'; }
  $('sunPrice').textContent = fmt(sp);
  if (sPct) {
    var sd = $('sunDisc');
    sd.hidden = false;
    sd.querySelector('s').textContent = fmt(sOld);
    sd.querySelector('.pct').textContent = '−' + sPct + '%';
  }
  applyBtn($('sunBtn'), BTN.sun);

  // Гайд
  if (t(C.guideImage)) { var g = $('guideImg'); g.src = t(C.guideImage); g.hidden = false; }

  // Как проходит
  $('howText').textContent = 'После оплаты вы получите доступ к выбранным материалам' + (delivery ? ' ' + delivery : '') +
    '. Уроки в записи, поэтому можно смотреть в своём темпе, ставить видео на паузу и повторять приёмы перед зеркалом.';

  // FAQ
  var FAQ = [
    ['Я почти не крашусь. С чего начать?', 'Если хотите научиться делать один макияж и разобраться в последовательности шагов, начните с мастер-класса. Курс подойдёт, если хотите попробовать разные техники и образы.'],
    ['Как сэкономить, если я хочу оба обучения?', save > 0
      ? 'Вместе курс и мастер-класс стоят ' + fmt(bp) + '. Это на ' + fmt(save) + ' дешевле, чем купить их по отдельности в дни акции.'
      : 'Вместе курс и мастер-класс стоят ' + fmt(bp) + '.'],
    ['Как долго доступны материалы?', 'Курс доступен ' + courseAccess + '.' + (sunAccess ? ' Мастер-класс — ' + sunAccess + '.' : '')]
  ];
  var faqBox = $('faq');
  FAQ.forEach(function (f, i) {
    var item = el('div', 'faq__item');
    var q = el('button', 'faq__q');
    q.type = 'button';
    q.id = 'faq-q' + i;
    q.setAttribute('aria-controls', 'faq-a' + i);
    q.appendChild(el('span', null, f[0]));
    var sign = el('span', 'faq__sign');
    q.appendChild(sign);
    var a = el('p', 'faq__a', f[1]);
    a.id = 'faq-a' + i;
    a.setAttribute('role', 'region');
    a.setAttribute('aria-labelledby', q.id);
    function set(open) {
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
      sign.textContent = open ? '−' : '+';
      a.hidden = !open;
    }
    set(i === 0);
    q.addEventListener('click', function () { set(q.getAttribute('aria-expanded') !== 'true'); });
    item.appendChild(q); item.appendChild(a);
    faqBox.appendChild(item);
  });

  // Подвал
  var seller = t(C.sellerDetails) || (draft ? '[Реквизиты продавца: ФИО / ИП, ИНН, ОГРНИП]' : '');
  if (seller) { $('footSeller').hidden = false; $('footSellerText').textContent = seller; }
  var offerHref = t(C.offerUrl) || (draft ? '#' : '');
  var privHref = t(C.privacyPolicyUrl) || (draft ? '#' : '');
  if (offerHref) { $('footOffer').hidden = false; $('footOffer').href = offerHref; }
  if (privHref) { $('footPrivacy').hidden = false; $('footPrivacy').href = privHref; }
  var support = t(C.supportContact) || (draft ? '[контакт поддержки]' : '');
  if (support) { $('footSupport').hidden = false; $('footSupportLink').textContent = support; $('footSupportLink').href = t(C.supportUrl) || '#'; }

  // Бегущая строка
  var phrases = [
    ['Black Friday', '#FFFFFF'],
    [maxPct ? 'Скидки до ' + maxPct : 'Скидки на обучение', '#FFFFFF'],
    [dateStr ? 'Только до ' + dateStr : 'Только сейчас', '#BDBDBD']
  ];
  if (save > 0) phrases.push(['Курс + мастер-класс за ' + fmt(bp), '#FFFFFF']);
  var mq = $('marquee');
  for (var r = 0; r < 4; r++) phrases.forEach(function (p) {
    var s1 = el('span', 'marquee__t', typo(p[0])); s1.style.color = p[1];
    mq.appendChild(s1);
    mq.appendChild(el('span', 'marquee__sep', '✦'));
  });

  // ---------- Прокрутка ----------
  function scrollToId(id) {
    var node = $(id);
    if (!node) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var off = window.innerWidth < 760 ? 60 : 64;
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
  typografy(document.body);
  renderCards();
  syncState();
  tick();
  mqWide.addEventListener ? mqWide.addEventListener('change', renderCards) : mqWide.addListener(renderCards);
  var mqNarrow = window.matchMedia('(max-width: 759px)');
  mqNarrow.addEventListener ? mqNarrow.addEventListener('change', syncState) : mqNarrow.addListener(syncState);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', tick);
})();
