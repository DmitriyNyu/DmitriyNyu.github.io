// Client script: language link, "My details" (citizenship / tax residence), compare selection, copy buttons, lot filters,
// compare table, tabs, /lots projects + map. No cookies; network: same-origin /lots.json and /vendor,
// plus map tiles/style/fonts from tiles.openfreemap.org (MapLibre, only when the map is shown).
(function () {
  'use strict';
  var d = document.documentElement;
  var C = window.THR || { profiles: {}, keys: [] };
  var KEY_LANG = 'thr.lang', KEY_CMP = 'thr.compare';

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function lang() { return d.getAttribute('data-lang') || 'ru'; }
  function profile() { return d.getAttribute('data-profile'); }

  // ---------- language + "My details" (D-055): two independent fields, stored in localStorage
  var PV = ['ru', 'uk', 'other'];
  function param(a) { return d.getAttribute('data-' + a) || ''; }
  // currency set: tax residence, else citizenship, else language
  function pickProfile() {
    var k = C.keys || [], t = param('tax'), c = param('cit');
    var P = k.indexOf(t) >= 0 ? t : k.indexOf(c) >= 0 ? c : (lang() === 'ru' && k.indexOf('ru') >= 0 ? 'ru' : (k.indexOf('uk') >= 0 ? 'uk' : k[0]));
    if (P) d.setAttribute('data-profile', P);
  }
  function setParam(a, v) {
    if (PV.indexOf(v) < 0) v = '';
    if (v) d.setAttribute('data-' + a, v); else d.removeAttribute('data-' + a);
    store('thr.' + a, v); // '' = explicitly not set (no guess next time)
    pickProfile(); apply();
  }
  function apply() {
    var L = lang();
    d.lang = L;
    d.setAttribute('data-qlang', L);
    $$('select[data-pref]').forEach(function (s) { s.value = param(s.getAttribute('data-pref')); });
    var sum = document.querySelector('[data-testid="prefs-summary"]');
    if (sum) { var lab = { ru: L === 'ru' ? 'РФ' : 'RU', uk: 'UK', other: L === 'ru' ? 'др.' : 'oth.' }; var c = param('cit'), t = param('tax'); sum.textContent = c || t ? (lab[c] || '–') + '/' + (lab[t] || '–') : ''; }
    $$('option[data-ru][data-en]').forEach(function (o) { o.textContent = o.getAttribute('data-' + L) || o.textContent; });
    $$('[data-ph-ru]').forEach(function (i) { i.placeholder = i.getAttribute('data-ph-' + L) || i.placeholder; });
    syncCur();
    document.dispatchEvent(new CustomEvent('thr:prefs'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-set-lang],[data-open-prefs],#prefs-btn,[data-copy-target],[data-compare-id],[data-demand-id],[data-units-more]');
    var panel = document.getElementById('prefs');
    if (panel && !panel.hidden && !(e.target.closest && e.target.closest('.prefs-wrap')) && !(b && b.hasAttribute('data-open-prefs'))) togglePrefs(false);
    if (!b) return;
    if (b.hasAttribute('data-set-lang')) { d.setAttribute('data-lang', b.getAttribute('data-set-lang')); store(KEY_LANG, lang()); pickProfile(); apply(); }
    else if (b.id === 'prefs-btn') togglePrefs();
    else if (b.hasAttribute('data-open-prefs')) { togglePrefs(true); var f = document.getElementById('pref-cit'); if (f) f.focus(); window.scrollTo(0, 0); }
    else if (b.hasAttribute('data-copy-target')) copyQuestions(b);
    else if (b.hasAttribute('data-compare-id')) toggleCompare(b.getAttribute('data-compare-id'));
    else if (b.hasAttribute('data-demand-id')) demand(b);
    // E3-13 UX-146 (D-245): «N more units» — the rest of the project's list; the focus goes to the first unit that opened
    else if (b.hasAttribute('data-units-more')) { var w = b.previousElementSibling; w.classList.remove('units-cut'); b.remove(); var f = w.querySelector('tr.u-more [data-testid="unit-link"]'); if (f) f.focus(); }
  });
  // E3-13 UX-29: on desktop a click anywhere on a unit row opens the lot (phones: the stretched link of UX-9); links, buttons,
  // source pop-ups and selected text keep their own behaviour; Ctrl/⌘/Shift or the middle button open a new tab
  function rowLink(e) {
    var tr = e.target.closest && e.target.closest('table.units tbody tr[data-id]');
    if (!tr || e.target.closest('a, button, summary, input, select, label')) return null;
    var dd = e.target.closest('details'); if (dd && tr.contains(dd)) return null; // UX-48: a pop-up in the row, not the card's «Units» list
    var sel = window.getSelection && window.getSelection(); if (sel && String(sel).trim()) return null;
    return tr.querySelector('[data-testid="unit-link"]');
  }
  document.addEventListener('click', function (e) { var a = rowLink(e); if (!a) return; if (e.ctrlKey || e.metaKey || e.shiftKey) window.open(a.href, '_blank'); else location.href = a.href; });
  document.addEventListener('auxclick', function (e) { if (e.button !== 1) return; var a = rowLink(e); if (a) window.open(a.href, '_blank'); });

  // E5-4 (D-094): demand test — one same-site request /demand/<lot-id> per page view; the server answers 204 and
  // counts it in its own log (no cookies, no data about the visitor); the page only shows a short explanation.
  // The header lets the request through the free ngrok tunnel's browser warning (otherwise it never reaches Caddy).
  // D-274: the mirror build (THR.beacon) has no server — one plain GET to the counter key demand-lot instead, without headers.
  function demand(b) {
    if (b.disabled) return;
    b.disabled = true;
    var box = b.closest('[data-testid="demand"]'), th = box && box.querySelector('[data-testid="demand-thanks"]');
    if (th) th.hidden = false;
    var B = window.THR && window.THR.beacon;
    try { (B ? fetch(B + 'demand-lot', { cache: 'no-store', keepalive: true }) : fetch('/demand/' + encodeURIComponent(b.getAttribute('data-demand-id')), { cache: 'no-store', keepalive: true, headers: { 'ngrok-skip-browser-warning': '1' } })).catch(function () { /* offline: nothing to count */ }); } catch (e) { /* no fetch */ }
  }

  // ar-0462 (D-278): the mirror build ships a price in the listing currency only; .pc[data-cur=orig] carries the build's exact
  // numbers as data-x="USD:n;EUR:a/b;RUB:=;GBP:~n" ("=" same text, "a/b" numbers in order, "~n" listing price + «≈ n CUR, derived»)
  // and the USD/EUR/RUB/GBP spans are rebuilt here before anything reads them (tools/mirror-layer.mjs writes data-x)
  function expandPrices() {
    var NUM = { ru: /\d{1,3}(?:\u00a0\d{3})*/g, en: /\d{1,3}(?:,\d{3})*/g }, DER = { ru: [' (≈ ', ', посчитано нами)'], en: [' (≈ ', ', derived)'] };
    function fmt(n, l) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, l === 'ru' ? '\u00a0' : ','); }
    function build(o, cur, spec) {
      var c = o.cloneNode(true); c.setAttribute('data-cur', cur); c.removeAttribute('data-x');
      if (spec === '=') return c;
      var der = spec.charAt(0) === '~', nums = (der ? spec.slice(1) : spec).split('/');
      $$('.t[lang]', c).forEach(function (t) {
        var l = t.getAttribute('lang') === 'ru' ? 'ru' : 'en', tx = t.textContent;
        if (der) { t.textContent = tx + DER[l][0] + fmt(nums[0], l) + ' ' + cur + DER[l][1]; return; }
        var code = (tx.match(/\b[A-Z]{3}\b/) || [])[0], i = 0;
        tx = tx.replace(NUM[l], function () { return fmt(nums[i++], l); });
        if (code) tx = tx.replace(new RegExp('\\b' + code + '\\b', 'g'), cur);
        t.textContent = tx;
      });
      return c;
    }
    $$('.pc[data-x]').forEach(function (o) {
      var p = o.parentNode, x = o.getAttribute('data-x'); o.removeAttribute('data-x');
      x.split(';').forEach(function (kv) { var i = kv.indexOf(':'); if (i > 0) p.insertBefore(build(o, kv.slice(0, i), kv.slice(i + 1)), o); });
    });
  }

  // ar-0462 (D-278): the mirror only (THR.beacon / THR.metrika) — a pageview key home / rating / sample (ar-0466) / page, and a click on a [data-cta]
  // button counts its key and the Metrika goal cta_dossier / cta_alerts with place and project; ar-0467 (D-281): the mailto button
  // cta-dossier-contact — the goal dossier_contact with data-place / data-p, the mail client opens as usual (no preventDefault)
  function mirrorCount() {
    var B = window.THR && window.THR.beacon, Y = window.THR && window.THR.metrika;
    if (!B) return;
    function hit(k) { try { fetch(B + k, { cache: 'no-store', keepalive: true }).catch(function () { /* offline */ }); } catch (e) { /* no fetch */ } }
    var p = location.pathname || '/';
    hit(p === '/' ? 'home' : p.indexOf('/rating') === 0 ? 'rating' : p.indexOf('/dossier-sample') === 0 ? 'sample' : 'page');
    document.addEventListener('click', function (e) {
      // ar-0466 (D-280): a link to the free sample dossier — the key sample-open and the goal sample_open with its place
      var s = e.target && e.target.closest && e.target.closest('[data-sample-open]');
      if (s) { hit('sample-open'); if (Y && typeof window.ym === 'function') try { window.ym(Y, 'reachGoal', 'sample_open', { place: s.getAttribute('data-sample-open') }); } catch (err) { /* blocked */ } return; }
      var a = e.target && e.target.closest && e.target.closest('[data-cta]');
      if (!a) return;
      var key = a.getAttribute('data-cta') || '';
      hit(key);
      if (key === 'cta-dossier-contact') { if (Y && typeof window.ym === 'function') try { window.ym(Y, 'reachGoal', 'dossier_contact', { place: a.getAttribute('data-place'), p: a.getAttribute('data-p') }); } catch (err) { /* blocked */ } return; }
      var goal = key.indexOf('cta-dossier') === 0 ? 'cta_dossier' : key.indexOf('cta-alerts') === 0 ? 'cta_alerts' : null;
      if (!goal || !Y || typeof window.ym !== 'function') return;
      var params = { place: key.indexOf('-home') >= 0 ? 'home' : key.indexOf('-project') >= 0 ? 'project' : key.indexOf('-sample') >= 0 ? 'sample' : undefined };
      var m = (a.getAttribute('href') || '').match(/[?&]p=([^&]+)/);
      if (m) { try { params.p = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (err) { params.p = m[1]; } }
      try { window.ym(Y, 'reachGoal', goal, params); } catch (err) { /* blocked */ }
    }, true);
  }

  function togglePrefs(open) {
    var panel = document.getElementById('prefs'), btn = document.getElementById('prefs-btn');
    if (!panel || !btn) return;
    var on = open == null ? panel.hidden : !!open;
    panel.hidden = !on; btn.setAttribute('aria-expanded', String(on));
  }
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (s && s.matches && s.matches('select[data-pref]')) setParam(s.getAttribute('data-pref'), s.value);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var p = document.getElementById('prefs'); if (p && !p.hidden) { togglePrefs(false); var b = document.getElementById('prefs-btn'); if (b) b.focus(); } } });

  // ---------- copy questions (in the profile's language)
  function copyQuestions(btn) {
    var list = document.getElementById(btn.getAttribute('data-copy-target'));
    if (!list) return;
    var ql = d.getAttribute('data-qlang') || lang();
    // E3-13 UX-89: questions in topics — each topic's heading goes into the text too, the numbering runs through
    var lines = [], n = 0;
    $$('li, .q-h', list).forEach(function (x) {
      if (x.classList.contains('q-h')) { var h = x.querySelector('.t[lang="' + ql + '"]') || x; if (lines.length) lines.push(''); lines.push(h.textContent.trim() + ':'); return; }
      var s = x.querySelector('.qt[lang="' + ql + '"]') || x;
      lines.push(++n + '. ' + s.textContent.trim());
    });
    var head = btn.getAttribute('data-copy-title-' + ql) || '', lk = document.querySelector('[data-testid="open-listing"]');
    if (head && lk) head += ' — ' + lk.href; // a lot: the seller's listing link, taken from the «Open the listing» button
    var text = (head ? head + '\n\n' : '') + lines.join('\n'); // E3-13 UX-43: object + listing link first
    var status = btn.parentNode.querySelector('.copy-status');
    function done(ok) { if (status) status.textContent = ok ? (lang() === 'ru' ? 'Скопировано' : 'Copied') : (lang() === 'ru' ? 'Не удалось скопировать — выделите текст вручную' : 'Copy failed — select the text manually'); }
    function fallback() {
      try {
        var r = document.createRange(); r.selectNodeContents(list);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        var ok = document.execCommand('copy'); s.removeAllRanges(); done(ok);
      } catch (e) { done(false); }
    }
    btn.setAttribute('data-copied', text);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  // ---------- compare selection
  function cmpList() { try { var v = JSON.parse(load(KEY_CMP) || '[]'); return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }).slice(0, 4) : []; } catch (e) { return []; } }
  function cmpSave(v) { store(KEY_CMP, JSON.stringify(v)); }
  var cmpDiff = load('thr.cmpdiff') === '1'; // E3-13 UX-7: «Differences only» on /compare
  function toggleCompare(id) {
    var v = cmpList(), i = v.indexOf(id);
    if (i >= 0) v.splice(i, 1);
    else if (v.length >= 4) { alertFull(); return; }
    else v.push(id);
    cmpSave(v); syncCompare();
    if (document.getElementById('compare-app')) renderCompare();
  }
  function alertFull() {
    var msg = lang() === 'ru' ? 'Можно сравнить не больше 4 лотов' : 'You can compare up to 4 lots';
    var live = document.getElementById('thr-live');
    if (!live) { live = document.createElement('div'); live.id = 'thr-live'; live.className = 'note'; live.setAttribute('role', 'status'); live.style.position = 'fixed'; live.style.bottom = '12px'; live.style.left = '12px'; live.style.right = '12px'; live.style.zIndex = '20'; document.body.appendChild(live); }
    live.textContent = msg; live.hidden = false;
    setTimeout(function () { live.hidden = true; }, 3000);
  }
  function syncCompare() {
    var v = cmpList();
    // E3-13 UX-21 (D-117): «Remove» buttons are actions, not toggles — no aria-pressed, no dark «pressed» fill
    $$('[data-compare-id]:not(.btn-remove)').forEach(function (b) { b.setAttribute('aria-pressed', String(v.indexOf(b.getAttribute('data-compare-id')) >= 0)); });
    $$('[data-compare-count]').forEach(function (s) { s.textContent = v.length ? String(v.length) : ''; });
    $$('.cmp-tray').forEach(function (a) { a.hidden = !v.length; }); // E3-13 UX-45
  }

  // E3-13 UX-39: project page — a small map with the project's pin, loaded only when its card scrolls into view;
  // two-finger pan on phones so the page still scrolls with one finger
  (function () {
    var el = document.getElementById('pmap'); if (!el) return;
    var started = false;
    function start() {
      if (started) return; started = true;
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = el.getAttribute('data-vendor-css'); document.head.appendChild(css);
      var sc = document.createElement('script'); sc.src = el.getAttribute('data-vendor-js'); sc.async = true;
      sc.onload = function () {
        var ML = window.maplibregl; if (!ML) return;
        var c = [Number(el.getAttribute('data-lon')), Number(el.getAttribute('data-lat'))], ru = lang() === 'ru', approx = el.hasAttribute('data-approx');
        try {
          var m = new ML.Map({ container: el, style: el.getAttribute('data-map-style'), center: c, zoom: Number(el.getAttribute('data-r')) && Number(el.getAttribute('data-r')) <= 300 ? 14 : 12, attributionControl: false, dragRotate: false, pitchWithRotate: false, cooperativeGestures: true,
            locale: { 'CooperativeGesturesHandler.WindowsHelpText': ru ? 'Ctrl + колесо — масштаб карты' : 'Use Ctrl + scroll to zoom the map', 'CooperativeGesturesHandler.MacHelpText': ru ? '⌘ + колесо — масштаб карты' : 'Use ⌘ + scroll to zoom the map', 'CooperativeGesturesHandler.MobileHelpText': ru ? 'Двумя пальцами — перемещение карты' : 'Use two fingers to move the map' } });
          m.addControl(new ML.NavigationControl({ showCompass: false }), 'top-right');
          if (!approx) new ML.Marker({ color: '#1f5fb4' }).setLngLat(c).addTo(m);
          m.on('load', function () {
            // E3-13 UX-133 (D-227): an approximate place is an area, not a point — a dashed circle of ≈ 1 km instead of a pin
            if (approx) {
              var pts = [], R = Number(el.getAttribute('data-r')) || 1000, k = Math.cos(c[1] * Math.PI / 180); // D-230: a building — a smaller circle
              for (var i = 0; i <= 64; i++) { var an = i / 64 * 2 * Math.PI; pts.push([c[0] + R * Math.cos(an) / (111320 * k), c[1] + R * Math.sin(an) / 110540]); }
              m.addSource('approx', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } } });
              m.addLayer({ id: 'approx-fill', type: 'fill', source: 'approx', paint: { 'fill-color': '#1f5fb4', 'fill-opacity': 0.14 } });
              m.addLayer({ id: 'approx-line', type: 'line', source: 'approx', paint: { 'line-color': '#1f5fb4', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
            }
            el.setAttribute('data-map', 'ready');
          });
        } catch (e) { /* no WebGL: the card keeps its caption */ }
      };
      document.head.appendChild(sc);
    }
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); } }, { rootMargin: '200px' }); io.observe(el); } else start();
  })();

  // ---------- lots.json
  var lotsData = null;
  function getLots(cb) {
    if (lotsData) return cb(lotsData);
    fetch('/lots.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) { lotsData = j; cb(j); }, function () { cb(null); });
  }
  // E3-13 UX-37: compare cells live in /compare.json, fetched only by the compare page; without it the cells stay empty
  var cmpLoaded = false;
  function getLotsCmp(cb) {
    getLots(function (data) {
      if (!data || cmpLoaded) return cb(data);
      var put = function (c) { data.lots.forEach(function (l) { l.cmp = (c && c[l.id]) || l.cmp || {}; }); cb(data); };
      fetch('/compare.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (c) { cmpLoaded = true; put(c); }, function () { put(null); });
    });
  }

  // ---------- display currency (E3-8): :root[data-cur], options of the profile
  var KEY_CUR = 'thr.cur';
  function profileCurs() { var p = C.profiles[profile()]; var c = (p && p.cur && p.cur.length) ? p.cur : (C.curs || []); return c.slice(); }
  function syncCur() {
    var cs = profileCurs(), cur = d.getAttribute('data-cur');
    if (cs.indexOf(cur) < 0) { cur = cs[0] || null; if (cur) d.setAttribute('data-cur', cur); else d.removeAttribute('data-cur'); }
    return cur;
  }
  function plural(n, ru3, en2) {
    if (lang() === 'en') return n === 1 ? en2[0] : en2[1];
    var a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? ru3[2] : b === 1 ? ru3[0] : b >= 2 && b <= 4 ? ru3[1] : ru3[2];
  }
  var SYM = { EUR: '€', USD: '$', GBP: '£', RUB: '₽', TRY: '₺' };
  function fmtNum(n) { return new Intl.NumberFormat(lang() === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 0 }).format(Math.round(n)); }
  function fmtShort(n, cur) {
    var s = SYM[cur] || '', ru = lang() === 'ru', v;
    if (n >= 1e6) v = (Math.round(n / 1e5) / 10) + (ru ? ' млн' : 'm');
    else if (n >= 1e3) v = Math.round(n / 1e3) + (ru ? ' тыс.' : 'k');
    else v = String(Math.round(n));
    if (ru) v = v.replace('.', ',').replace(' тыс,', ' тыс.');
    return s ? (ru ? v + ' ' + s : s + v) : v + ' ' + cur;
  }

  // E3-13 UX-51: an in-tab contents link scrolls to its section (opening it if collapsed) without changing location.hash —
  // the hash drives the tabs, and an unknown one would switch to the first tab
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-toc] a[href^="#"]'); if (!a) return;
    var tgt = document.getElementById(a.getAttribute('href').slice(1)); if (!tgt) return;
    e.preventDefault();
    if (tgt.tagName === 'DETAILS') tgt.open = true;
    tgt.scrollIntoView({ block: 'start' });
    var f = tgt.tagName === 'DETAILS' ? tgt.querySelector('summary') : tgt; if (f && f.focus) f.focus({ preventScroll: true });
  });

  // ---------- tabs on lot/project pages (panels all visible without JS)
  function initTabs() {
    $$('[data-tabs]').forEach(function (box) {
      var links = $$('[data-tab]', box), panels = $$('[data-panel]', box);
      if (!links.length) return;
      box.classList.add('tabs-on');
      function show(id, push) {
        if (!links.some(function (a) { return a.getAttribute('data-tab') === id; })) id = links[0].getAttribute('data-tab');
        links.forEach(function (a) { var on = a.getAttribute('data-tab') === id; a.setAttribute('aria-selected', String(on)); a.tabIndex = on ? 0 : -1; if (on && a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) { try { a.parentNode.scrollLeft = a.offsetLeft - 16; } catch (e) { /* */ } } });
        panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== id; });
        if (push) { try { history.replaceState(null, '', '#tab-' + id); } catch (e) { /* */ } }
      }
      links.forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); show(a.getAttribute('data-tab'), true); });
        a.addEventListener('keydown', function (e) {
          var i = links.indexOf(a), j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -2;
          if (j === -2) return; j = (j + links.length) % links.length; links[j].focus(); show(links[j].getAttribute('data-tab'), true); e.preventDefault();
        });
      });
      box.addEventListener('click', function (e) {
        var g = e.target.closest && e.target.closest('[data-tab-go]'); if (!g) return;
        e.preventDefault(); var id = g.getAttribute('data-tab-go'); show(id, true);
        var bar = box.querySelector('.tabbar'); if (bar && bar.scrollIntoView) bar.scrollIntoView({ block: 'start' });
        var cur = links.filter(function (x) { return x.getAttribute('data-tab') === id; })[0]; if (cur && cur.focus) cur.focus({ preventScroll: true });
      });
      var h = (location.hash || '').replace(/^#tab-/, '');
      show(h, false);
      window.addEventListener('hashchange', function () { var x = (location.hash || '').replace(/^#tab-/, ''); if (x) show(x, false); });
    });
  }

  // ---------- /lots: projects, units, filters, map
  function initLots() {
    var app = document.getElementById('lots-app');
    if (!app) return;
    var el = {};
    ['filter-search', 'filter-currency', 'filter-price-min', 'filter-price-max', 'filter-area-min', 'filter-area-max', 'price-lo', 'price-hi', 'area-lo', 'area-hi',
      'filter-rental', 'filter-tapu', 'filter-nored', 'filter-priced', 'filter-status', 'filter-month', 'filter-yield', 'filter-ycur', 'filter-guar', 'sort', 'project-list', 'units-view', 'units-table', 'lots-empty', 'fcount', 'fwrap', 'price-vals', 'area-vals'].forEach(function (id) { el[id] = document.getElementById(id); });
    getLots(function (data) {
      if (!data || !data.projects) { updateCount(0, 0, 0); return; }
      var lotsById = {}, projById = {};
      data.lots.forEach(function (l) { lotsById[l.id] = l; });
      data.projects.forEach(function (p) { projById[p.id] = p; p.lotObjs = p.lots.map(function (id) { return lotsById[id]; }).filter(Boolean); p.lotObjs.forEach(function (l) { l.proj = p; }); });
      var cards = {}; $$('[data-testid="project-card"]', el['project-list']).forEach(function (c) { cards[c.getAttribute('data-project-id')] = c; });
      var chips = $$('[data-chip]', app);
      var chipSel = [];
      var state = { view: 'projects', pane: 'list' };
      var map = null, markers = [], clusters = [], meas = null, mapState = 'none', popup = null, fitDone = false, touched = false;

      // narrow screens: filters collapsed, list first — E3-13 UX-107: tablets too (760–1099 px: the panel was open across the full
      // width, ~890 px of filters before the first project; on an 820×1180 iPad the list began below the fold)
      if (window.matchMedia && window.matchMedia('(max-width: 1099px)').matches && el.fwrap) el.fwrap.open = false;

      // E3-13 UX-33: put nodes in the wanted order moving only those out of place. Re-appending every card and row on each
      // filter run swallowed a click pressed while a text field lost focus (mousedown → blur → change → run → node re-inserted).
      function reorder(parent, nodes) {
        var at = parent.firstElementChild;
        for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (n === at) { at = at.nextElementSibling; continue; } parent.insertBefore(n, at); }
      }
      function cur() { return el['filter-currency'].value; }
      function amt(l) { return l.amt && l.amt[cur()] != null ? l.amt[cur()] : null; }
      function numVal(id) { var e = el[id]; if (!e) return null; var v = String(e.value).trim(); if (v === '') return null; var n = Number(v.replace(',', '.')); return isFinite(n) ? n : null; }
      // amounts of one lot in two currencies give the rate (conversion goes through TRY, so it is the same for every lot);
      // the largest amount keeps the rounding of lots.json negligible
      function convFactor(a, b) {
        if (!a || !b) return null; if (a === b) return 1;
        var best = null; data.lots.forEach(function (l) { if (l.amt && l.amt[a] && l.amt[b] && (!best || l.amt[a] > best.amt[a])) best = l; });
        return best ? best.amt[b] / best.amt[a] : null;
      }
      function round3(v, up) { if (!(v > 0)) return 0; var p = Math.pow(10, Math.max(0, Math.floor(Math.log(v) / Math.LN10) - 2)); return (up ? Math.ceil(v / p) : Math.floor(v / p)) * p; }
      function fillCurrencies() {
        var sel = el['filter-currency'], cs = profileCurs(), want = syncCur();
        sel.innerHTML = cs.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
        if (cs.indexOf(want) >= 0) sel.value = want;
        setupSlider('price');
      }
      function edges(kind) { var h = kind === 'price' ? (data.hist.price || {})[cur()] : data.hist.area; return h ? h.edges : null; }
      function setupSlider(kind) {
        var E = edges(kind), lo = el[kind + '-lo'], hi = el[kind + '-hi'];
        if (!lo || !hi) return;
        var B = E ? E.length - 1 : 0;
        lo.max = hi.max = String(B); lo.disabled = hi.disabled = !E;
        syncSliderFromInputs(kind);
      }
      function syncSliderFromInputs(kind) {
        var E = edges(kind), lo = el[kind + '-lo'], hi = el[kind + '-hi']; if (!E || !lo) return;
        var B = E.length - 1, mn = numVal('filter-' + kind + '-min'), mx = numVal('filter-' + kind + '-max');
        var i = 0, j = B, k;
        if (mn != null) for (k = 0; k <= B; k++) if (E[k] <= mn) i = k;
        if (mx != null) for (k = B; k >= 0; k--) if (E[k] >= mx) j = k;
        if (j < i) j = i;
        lo.value = String(i); hi.value = String(j);
      }
      function onSlider(kind, which) {
        var E = edges(kind), lo = el[kind + '-lo'], hi = el[kind + '-hi']; if (!E) return;
        var B = E.length - 1, i = Number(lo.value), j = Number(hi.value);
        if (i > j) { if (which === 'lo') { j = i; hi.value = String(j); } else { i = j; lo.value = String(i); } }
        el['filter-' + kind + '-min'].value = i > 0 ? String(E[i]) : '';
        el['filter-' + kind + '-max'].value = j < B ? String(E[j]) : '';
        run();
      }
      // E3-13 UX-66 (D-166): a pointer drag (mouse, finger, pen) moves the thumb nearest to where it started, not whichever input
      // is on top: on a phone the 44 px thumb zones of neighbouring bins overlap, so «from» could not be taken next to «to», and two
      // thumbs on the same bin moved only together. Thumbs on one bin: the first move decides (left — «from», right — «to»).
      // The thumb keeps its offset from the pointer (no jump on press); keyboard input is the native one. Tap zones are the old ones
      // (a press on the bare track does nothing). A cancelled drag (pointercancel) keeps the value reached so far, like the native one.
      function nearestThumbDrag(kind) {
        var lo = el[kind + '-lo'], hi = el[kind + '-hi'], dual = lo && lo.parentNode, drag = null;
        if (!dual || !window.PointerEvent) return;
        function geom() { var r = lo.getBoundingClientRect(); return { r: r, T: matchMedia('(max-width: 759px)').matches ? 44 : 18, B: Number(lo.max) || 0 }; }
        function cx(g, v) { return g.r.left + g.T / 2 + (g.r.width - g.T) * (g.B ? v / g.B : 0); }
        function valAt(g, x) { var f = (x - g.r.left - g.T / 2) / (g.r.width - g.T); return Math.max(0, Math.min(g.B, Math.round(f * g.B))); }
        dual.addEventListener('pointerdown', function (e) {
          if (lo.disabled || (e.target !== lo && e.target !== hi) || (e.pointerType === 'mouse' && e.button !== 0)) return; // only a press on a thumb zone (the track has no pointer events, as before)
          var g = geom(), a = cx(g, Number(lo.value)), b = cx(g, Number(hi.value)), da = Math.abs(e.clientX - a), db = Math.abs(e.clientX - b);
          var which = lo.value === hi.value ? null : (da <= db ? 'lo' : 'hi');
          e.preventDefault();
          drag = { id: e.pointerId, g: g, x0: e.clientX, off: e.clientX - (which === 'hi' ? b : a), which: which };
          try { dual.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        });
        dual.addEventListener('pointermove', function (e) {
          if (!drag || e.pointerId !== drag.id) return;
          var dx = e.clientX - drag.x0;
          if (!drag.which) { if (Math.abs(dx) < 3) return; drag.which = dx < 0 ? 'lo' : 'hi'; }
          var inp = drag.which === 'lo' ? lo : hi, v = valAt(drag.g, e.clientX - drag.off);
          if (Number(inp.value) !== v) { inp.value = String(v); onSlider(kind, drag.which); }
        });
        function end(e) {
          if (!drag || e.pointerId !== drag.id) return;
          var inp = drag.which === 'lo' ? lo : drag.which === 'hi' ? hi : lo; drag = null;
          try { inp.focus({ preventScroll: true }); } catch (x) { /* */ }
        }
        dual.addEventListener('pointerup', end); dual.addEventListener('pointercancel', end);
        // a finger on a thumb: the native range drag starts from the touch events, so they are cancelled (the pointer events above move the thumb)
        // (only on a thumb zone: elsewhere on the row a finger still scrolls the page; a swipe that starts on a thumb does not scroll — it drags)
        dual.addEventListener('touchstart', function (e) { if (!lo.disabled && (e.target === lo || e.target === hi)) e.preventDefault(); }, { passive: false });
      }
      function rangeText(kind) {
        var mn = numVal('filter-' + kind + '-min'), mx = numVal('filter-' + kind + '-max'), ru = lang() === 'ru';
        var f = kind === 'price' ? function (x) { return fmtShort(x, cur()); } : function (x) { return fmtNum(x) + (ru ? ' м²' : ' m²'); };
        if (mn == null && mx == null) return ru ? 'любая' : 'any';
        return (mn != null ? (ru ? 'от ' : 'from ') + f(mn) : '') + (mn != null && mx != null ? ' ' : '') + (mx != null ? (ru ? 'до ' : 'to ') + f(mx) : '');
      }
      // E3-11: value scale under the slider — hide inner labels that would overlap (min / max always stay)
      function fitScales() {
        $$('.scale', app).forEach(function (sc) {
          var tks = $$('.tk', sc);
          tks.forEach(function (x) { x.classList.remove('off'); });
          if (!sc.offsetWidth) return;
          // levels: 0 = min/max, 1 = middle, 2 = quarters; a level is shown only if none of its labels overlaps
          var keep = [], stop = false;
          [0, 1, 2].forEach(function (lv) {
            var g = tks.filter(function (x) { return Number(x.getAttribute('data-pri')) === lv; });
            var rs = g.map(function (x) { return x.getBoundingClientRect(); });
            var all = keep.concat(rs);
            var hit = lv > 0 && (stop || rs.some(function (r) { return all.some(function (k) { return k !== r && r.left < k.right + 6 && r.right + 6 > k.left; }); }));
            if (hit) { stop = true; g.forEach(function (x) { x.classList.add('off'); }); } else keep = all;
          });
        });
      }
      function highlightBars(kind) {
        var E = edges(kind); if (!E) return;
        var i = Number(el[kind + '-lo'].value), j = Number(el[kind + '-hi'].value);
        var sel = kind === 'price' ? '[data-hist="price"][data-cur="' + cur() + '"] .hb' : '[data-hist="area"] .hb';
        $$(sel, app).forEach(function (r) { var b = Number(r.getAttribute('data-bin')); r.classList.toggle('in', b >= i && b < j); });
      }

      function filters() {
        var q = String(el['filter-search'].value || '').trim().toLowerCase();
        return {
          q: q, chips: chipSel.slice(), pmin: numVal('filter-price-min'), pmax: numVal('filter-price-max'), amin: numVal('filter-area-min'), amax: numVal('filter-area-max'),
          rental: el['filter-rental'].checked, tapu: el['filter-tapu'].checked, nored: el['filter-nored'].checked, priced: el['filter-priced'].checked,
          status: el['filter-status'].value, month: el['filter-month'].value,
          ymin: el['filter-yield'].value ? Number(el['filter-yield'].value) : null, ycur: el['filter-ycur'].value, guar: el['filter-guar'].checked,
        };
      }
      // E3-13 UX-35: the search box also finds units by room type («1+1», «студия», «suite») in every project — the project name /
      // brand / city match shows the whole project, a room-type match shows just those units — and names typed in Cyrillic
      // («кемпински», «хилтон», «риксос») through a simple transliteration
      var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
      function qVariants(q) {
        if (!q) return [];
        var v = [q];
        if (/[а-яё]/.test(q)) { var lat = q.replace(/[а-яё]/g, function (c) { return TR[c]; }); v.push(lat); if (lat.indexOf('ks') >= 0) v.push(lat.replace(/ks/g, 'x')); }
        return v;
      }
      function qHit(text, qs) { for (var i = 0; i < qs.length; i++) if (text.indexOf(qs[i]) >= 0) return true; return false; }
      function unitText(l) { if (l._ut == null) l._ut = l.unit ? (String(l.unit.ru || '') + ' | ' + String(l.unit.en || '')).toLowerCase() : ''; return l._ut; }
      function projOk(p, f) {
        if (f.chips.length && f.chips.indexOf(p.city) < 0) return false;
        // E4-25b: city groups without a named project — rental / tapu are checked per lot (lotOk)
        if (f.rental && !p.unnamed && p.rental_program !== true) return false;
        if (f.tapu && !p.unnamed && p.title_type !== 'tapu') return false;
        if (f.nored && !(p.red_checked && p.red_count === 0)) return false;
        if (f.status && p.status !== f.status) return false;
        if (f.month && !(p.open_months && p.open_months.indexOf(Number(f.month)) >= 0)) return false;
        return true;
      }
      function lotOk(l, f) {
        var a = amt(l);
        if ((f.pmin != null || f.pmax != null) && (a == null || (f.pmin != null && a < f.pmin) || (f.pmax != null && a > f.pmax))) return false;
        if ((f.amin != null || f.amax != null) && (l.area == null || (f.amin != null && l.area < f.amin) || (f.amax != null && l.area > f.amax))) return false;
        if (f.priced && l.price == null) return false;
        // ar-0392 (D-268): the seller's normalized yield claim (lots.json yld): a range or «up to» passes by its top rate
        var y = l.yld;
        if (f.ymin != null && !(y && y.hi != null && y.hi >= f.ymin)) return false;
        if (f.guar && !(y && y.kind === 'guaranteed')) return false;
        if (f.ycur && !(y && (f.ycur === 'none' ? y.cur == null : y.cur === f.ycur))) return false;
        if (l.proj && l.proj.unnamed) {
          if (f.rental && l.rental_program !== true) return false;
          if (f.tapu && l.title_type !== 'tapu') return false;
        }
        return true;
      }
      // E3-13 UX-65: nothing fits a budget — say how far it is (the cheapest unit under the other conditions) and offer to show it,
      // instead of a bare «Nothing matches the filters» (scenario «Budget»)
      function budgetHint(f, qs) {
        var box = el['lots-empty']; if (!box) return;
        var hint = box.querySelector('[data-testid="budget-hint"]'), btn = box.querySelector('[data-testid="budget-raise"]'), msg = box.querySelector('.empty-msg');
        if (!hint || !btn) return;
        var min = null;
        if (!box.hidden && f.pmax != null) {
          var f2 = {}; for (var k in f) f2[k] = f[k]; f2.pmax = null;
          data.projects.forEach(function (p) {
            if (!projOk(p, f2)) return;
            var qProj = !qs.length || qHit(p.search, qs);
            p.lotObjs.forEach(function (l) { if (!lotOk(l, f2) || !(qProj || qHit(unitText(l), qs))) return; var v = amt(l); if (v != null && (min == null || v < min)) min = v; });
          });
        }
        var on = min != null && min > f.pmax;
        hint.hidden = btn.hidden = !on; if (msg) msg.hidden = on;
        if (!on) return;
        var ru = lang() === 'ru', c = cur(), up = Math.ceil(min / 1000) * 1000;
        hint.textContent = ru ? 'Под бюджет до ' + fmtShort(f.pmax, c) + ' юнитов нет. Самый дешёвый при остальных условиях — ' + fmtShort(min, c) + '.' : 'No units within ' + fmtShort(f.pmax, c) + '. The cheapest under the other conditions is ' + fmtShort(min, c) + '.';
        btn.textContent = ru ? 'Показать до ' + fmtShort(up, c) : 'Show up to ' + fmtShort(up, c);
        btn.setAttribute('data-budget-raise', String(up));
      }
      // E3-13 UX-98: nothing found for a search — say what was searched and offer to clear just the search, or to search without the
      // other filters when that finds something.
      // «Reset filters» (everything, the query too) is hidden here: it did not say why the list was empty
      function searchHint(f, qs) {
        var box = el['lots-empty']; if (!box) return;
        var hint = box.querySelector('[data-testid="search-hint"]'), clr = box.querySelector('[data-testid="search-clear"]'), wide = box.querySelector('[data-testid="search-wide"]'), rst = box.querySelector('[data-testid="empty-reset"]'), msg = box.querySelector('.empty-msg'), bh = box.querySelector('[data-testid="budget-hint"]');
        if (!hint || !clr || !wide) return;
        var on = !box.hidden && qs.length > 0 && !(bh && !bh.hidden);
        hint.hidden = clr.hidden = !on; wide.hidden = true; if (rst) rst.hidden = on;
        if (!on) return;
        if (msg) msg.hidden = true;
        var ru = lang() === 'ru', q = el['filter-search'].value.trim();
        var n = data.projects.filter(function (p) { return !p.unnamed && (qHit(p.search, qs) || p.lotObjs.some(function (l) { return qHit(unitText(l), qs); })); }).length;
        var html = esc(ru ? 'По запросу «' + q + '»' : 'Nothing found for «' + q + '»');
        if (n) {
          html += esc(ru ? ' с выбранными фильтрами ничего нет.' : ' with the chosen filters.');
          wide.hidden = false; wide.textContent = (ru ? 'Искать без фильтров' : 'Search without filters') + ' (' + n + ' ' + plural(n, ['проект', 'проекта', 'проектов'], ['project', 'projects']) + ')';
        } else {
          html += esc(ru ? ' ничего не найдено.' : '.');
          html += ' ' + esc(ru ? 'Поиск — по названию проекта, бренду, городу и району.' : 'The search looks at the project name, brand, city and district.');
        }
        hint.innerHTML = html;
      }
      function saveList() {
        try {
          var open = $$('details.units-d', el['project-list']).filter(function (d) { return d.open; }).map(function (d) { return d.closest('[data-testid="project-card"]').getAttribute('data-project-id'); });
          var anchor = null, off = 0, cs = $$('[data-testid="project-card"]:not([hidden])', el['project-list']);
          for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (r.bottom > 0) { anchor = cs[i].getAttribute('data-project-id'); off = Math.round(r.top); break; } }
          var st = history.state && typeof history.state === 'object' ? history.state : {};
          st.thrList = { y: Math.round(window.pageYOffset), open: open, anchor: state.view === 'projects' ? anchor : null, off: off, ulim: uLim };
          history.replaceState(st, '');
        } catch (e) { /* */ }
      }
      function restoreList() {
        var s = history.state && history.state.thrList; if (!s) return;
        if (s.ulim > uLim && el['units-table']) { uLim = s.ulim; cutUnits(); } // UX-152: «Back» to the 60th unit finds it open
        (s.open || []).forEach(function (id) { var d = cards[id] && cards[id].querySelector('details.units-d'); if (d) d.open = true; });
        var c = s.anchor && cards[s.anchor];
        window.scrollTo(0, c && !c.hidden ? Math.max(0, c.getBoundingClientRect().top + window.pageYOffset - s.off) : (s.y || 0));
      }
      function hiddenNotes(f) {
        var c = { price: 0, area: 0, priced: 0, rental: 0, tapu: 0, red: 0, status: 0, month: 0, yield: 0 };
        data.lots.forEach(function (l) {
          var p = l.proj || {};
          if (amt(l) == null) c.price++;
          if (l.area == null) c.area++;
          if (l.price == null) c.priced++;
          var own = p.unnamed; // E4-25b: lots without a named project carry their own rental / title facts
          if ((own ? l.rental_program : p.rental_program) == null) c.rental++;
          if ((own ? l.title_type : p.title_type) == null) c.tapu++;
          if (!p.red_checked) c.red++;
          if (p.status == null) c.status++;
          if (!p.open_months) c.month++;
          if (!l.yld || (f.ymin != null && l.yld.hi == null)) c.yield++;
        });
        var on = { price: f.pmin != null || f.pmax != null, area: f.amin != null || f.amax != null, priced: f.priced, rental: f.rental, tapu: f.tapu, red: f.nored, status: !!f.status, month: !!f.month, yield: f.ymin != null || f.guar, ycur: !!f.ycur };
        $$('[data-hidden-for]', app).forEach(function (n) {
          var k = n.getAttribute('data-hidden-for'), v = c[k] || 0;
          if (!on[k] || !v) { n.hidden = true; n.textContent = ''; n.removeAttribute('data-count'); return; }
          n.hidden = false; n.setAttribute('data-count', String(v));
          if (k === 'yield') { n.textContent = yieldNs(v); return; }
          n.textContent = lang() === 'ru' ? 'скрыто ' + v + ' ' + plural(v, ['лот', 'лота', 'лотов'], []) + ' без данных об этом' : v + ' ' + (v === 1 ? 'lot' : 'lots') + ' hidden: no data on this';
        });
        var n = 0; for (var k in on) if (on[k]) n++; n += f.chips.length ? 1 : 0; n += f.q ? 1 : 0;
        if (el.fcount) el.fcount.textContent = n ? String(n) : '';
        return c;
      }
      function yieldNs(n) { var m = data.lots.length; return lang() === 'ru' ? 'доходность не заявлена у ' + n + ' из ' + m : 'yield not stated for ' + n + ' of ' + m; }
      function nullLast(a, b, dir) { if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return dir * (a - b); }
      function lotKey(l, s) {
        var a = amt(l);
        switch (s) {
          case 'price-asc': case 'price-desc': return a;
          case 'area-asc': case 'area-desc': return l.area;
          case 'complete': return l.completeness;
          case 'newest': return l.first_seen ? Date.parse(l.first_seen) : null;
          default: return a != null && l.area ? a / l.area : null;
        }
      }
      function dir(s) { return /desc$|complete|newest/.test(s) ? -1 : 1; }
      function projKey(p, vis, s) {
        var ks = vis.map(function (l) { return lotKey(l, s); }).filter(function (x) { return x != null; });
        if (s === 'complete') return p.completeness;
        if (!ks.length) return null;
        return dir(s) > 0 ? Math.min.apply(null, ks) : Math.max.apply(null, ks);
      }

      // E3-13 UX-152 (D-251): the «Units» view shows the first 20 rows in the chosen sort, the rest 20 at a time behind «Show 20
      // more of N» — all 766 rows made the page 89 311 px on a phone. A new set or order of rows (filter, search, sort) starts from
      // 20 again; a language change keeps what is open. Not below N + 2 rows — no «1 more» (UX-146). The CSS is UX-146's.
      // ponytail: the key is all visible ids joined — O(n) per run(), a hash if the list grows to tens of thousands
      var UCUT = 20, uLim = UCUT, uKey = '', uBtn = null, uVis = [];
      function cutUnits() {
        var wrap = el['units-table'].parentNode, vis = uVis = $$('tr[data-id]', el['units-table'].tBodies[0]).filter(function (r) { return !r.hidden; });
        var key = vis.map(function (r) { return r.getAttribute('data-id'); }).join();
        if (key !== uKey) { uKey = key; uLim = UCUT; }
        var lim = vis.length >= uLim + 2 ? uLim : vis.length, nl = vis.length >= uLim + UCUT + 2 ? uLim + UCUT : vis.length, s = nl - lim, k = vis.length - lim;
        $$('tr.u-more', wrap).forEach(function (r) { r.classList.remove('u-more'); });
        vis.slice(lim).forEach(function (r) { r.classList.add('u-more'); });
        wrap.classList.toggle('units-cut', k > 0);
        if (!uBtn) {
          uBtn = document.createElement('button'); uBtn.type = 'button'; uBtn.className = 'btn units-more'; uBtn.setAttribute('data-testid', 'units-next');
          wrap.parentNode.insertBefore(uBtn, wrap.nextSibling);
          uBtn.addEventListener('click', function () { var old = uLim; uLim += UCUT; cutUnits(); var a = uVis[old] && uVis[old].querySelector('[data-testid="unit-link"]'); if (a) a.focus(); });
        }
        uBtn.hidden = !k;
        var ru = lang() === 'ru';
        uBtn.textContent = s < k ? (ru ? 'Показать ещё ' + s + ' из ' + k : 'Show ' + s + ' more of ' + k) : (ru ? 'Показать ещё ' + s : 'Show ' + s + ' more');
      }
      var visProj = [];
      function run() {
        hidePreview();
        var f = filters(), s = el.sort.value, shownUnits = 0;
        visProj = [];
        var visLotSet = {}, qs = qVariants(f.q);
        data.projects.forEach(function (p) {
          var po = projOk(p, f), qProj = !qs.length || qHit(p.search, qs);
          var vis = po ? p.lotObjs.filter(function (l) { return lotOk(l, f) && (qProj || qHit(unitText(l), qs)); }) : [];
          vis.forEach(function (l) { visLotSet[l.id] = true; });
          var show = po && vis.length > 0;
          p.vis = vis; p.shown = show;
          var card = cards[p.id];
          if (card) {
            card.hidden = !show;
            $$('tr[data-id]', card).forEach(function (r) { r.hidden = !visLotSet[r.getAttribute('data-id')]; });
            var utb = card.querySelector('table.units tbody'); // E3-13 UX-57: a card's units follow the chosen sort — its first row is why the card stands where it does
            if (utb) reorder(utb, $$('tr[data-id]', utb).sort(function (A, B) { var x = lotsById[A.getAttribute('data-id')], y = lotsById[B.getAttribute('data-id')]; return nullLast(lotKey(x, s), lotKey(y, s), dir(s)) || x.id.localeCompare(y.id); }));
            // E3-13 UX-73: «Units (8)», and with filters «Units (7 of 8)» — the «(7/8)» fraction read either way
            var us = card.querySelector('.u-count'); if (us) { var tot = Number(us.getAttribute('data-total')); us.innerHTML = vis.length === tot ? '(' + tot + ')' : '(' + vis.length + ' <span class="t" lang="ru">из</span><span class="t" lang="en">of</span> ' + tot + ')'; }
          }
          if (show) { visProj.push(p); shownUnits += vis.length; }
        });
        // sort cards
        var d0 = dir(s);
        var order = data.projects.slice().sort(function (a, b) {
          return nullLast(projKey(a, a.vis, s), projKey(b, b.vis, s), d0) || a.name.localeCompare(b.name);
        });
        reorder(el['project-list'], order.map(function (p) { return cards[p.id]; }).filter(Boolean));
        // units table
        if (el['units-table']) {
          var tb = el['units-table'].tBodies[0], rows = $$('tr[data-id]', tb);
          rows.forEach(function (r) { r.hidden = !visLotSet[r.getAttribute('data-id')]; });
          reorder(tb, rows.sort(function (A, B) {
            var a = lotsById[A.getAttribute('data-id')], b = lotsById[B.getAttribute('data-id')];
            return nullLast(lotKey(a, s), lotKey(b, s), d0) || a.id.localeCompare(b.id);
          }));
          cutUnits();
        }
        // city groups "Project not named by the seller" (E4-25b) are not counted as projects
        updateCount(visProj.filter(function (p) { return !p.unnamed; }).length, shownUnits, data.lots.length);
        writeUrl();
        if (el['lots-empty']) el['lots-empty'].hidden = visProj.length > 0;
        budgetHint(f, qs);
        searchHint(f, qs);
        var hc = hiddenNotes(f);
        ['price', 'area'].forEach(function (k) { if (el[k + '-vals']) el[k + '-vals'].textContent = rangeText(k); highlightBars(k); });
        renderActive(f, hc);
        app.setAttribute('data-ready', '1');
        updatePins();
      }
      // E3-13 UX-8: active filters as removable chips above the list (selected cities are visible in the chips row already);
      // «Reset all» when there are two or more; the empty result offers «Reset filters».
      function renderActive(f, hc) {
        var box = document.getElementById('afilters'); if (!box) return;
        var ru = lang() === 'ru', items = [];
        var tx = function (node) { if (!node) return ''; var s = node.querySelector('.t[lang="' + lang() + '"]'); return (s ? s.textContent : node.textContent).trim(); };
        if (f.q) items.push({ k: 'q', t: '«' + el['filter-search'].value.trim() + '»' });
        if (f.pmin != null || f.pmax != null) items.push({ k: 'price', t: (ru ? 'Цена ' : 'Price ') + rangeText('price'), l: ru ? 'цена' : 'price' });
        if (f.amin != null || f.amax != null) items.push({ k: 'area', t: (ru ? 'Площадь ' : 'Area ') + rangeText('area'), l: ru ? 'площадь' : 'area' });
        ['filter-rental', 'filter-tapu', 'filter-nored', 'filter-priced', 'filter-guar'].forEach(function (id) { if (el[id].checked) { var s = tx(el[id].closest('label')); items.push({ k: id, t: s.charAt(0).toUpperCase() + s.slice(1), l: s }); } });
        ['filter-status', 'filter-month', 'filter-yield', 'filter-ycur'].forEach(function (id) {
          var s = el[id]; if (!s.value) return;
          var o = s.options[s.selectedIndex];
          var lb = tx(document.querySelector('label[for="' + id + '"]'));
          items.push({ k: id, t: lb + ': ' + (o.getAttribute('data-' + lang()) || o.textContent), l: lb.charAt(0).toLowerCase() + lb.slice(1) });
        });
        box.hidden = !items.length;
        box.innerHTML = items.map(function (it) {
          return '<button type="button" class="achip" data-clear="' + esc(it.k) + '" data-testid="active-filter" aria-label="' + esc((ru ? 'Убрать фильтр: ' : 'Remove filter: ') + it.t) + '">' + esc(it.t) + ' <span aria-hidden="true">×</span></button>';
        }).join('') + (items.length > 1 ? '<button type="button" class="linkbtn" data-reset-filters data-testid="active-reset">' + (ru ? 'Сбросить всё' : 'Reset all') + '</button>' : '') + hiddenLine(items, hc);
      }
      // E3-13 UX-50: lots a filter hides only because their data is missing are counted next to the results, not only in the
      // filter panel (month: 221 of 230 lots have no opening months, so «3 projects» read as «only 3 hotels open in October»)
      var HKEY = { price: 'price', area: 'area', 'filter-rental': 'rental', 'filter-tapu': 'tapu', 'filter-nored': 'red', 'filter-status': 'status', 'filter-month': 'month' };
      function hiddenLine(items, hc) {
        var parts = items.filter(function (it) { return hc && HKEY[it.k] && hc[HKEY[it.k]] > 0; }).map(function (it) {
          var n = hc[HKEY[it.k]]; return it.l + ' — ' + n + ' ' + plural(n, ['лот', 'лота', 'лотов'], ['lot', 'lots']);
        });
        var ru = lang() === 'ru', yOn = el['filter-yield'].value || el['filter-guar'].checked || el['filter-ycur'].value;
        // ar-0392: units without a stated yield do not vanish silently — how many, and a way back to them
        var yl = yOn && hc && hc.yield ? '<p class="ahid" data-testid="yield-hidden">' + esc(yieldNs(hc.yield)) + ' <button type="button" class="linkbtn" data-yield-all data-testid="yield-show-all">' + (ru ? 'показать без фильтра доходности' : 'show without the yield filter') + '</button></p>' : '';
        return (parts.length ? '<p class="ahid" data-testid="active-hidden">' + esc((ru ? 'Без данных скрыто: ' : 'Hidden for lack of data: ') + parts.join(', ')) + '</p>' : '') + yl;
      }
      function clearFilter(k) {
        if (k === 'q') el['filter-search'].value = '';
        else if (k === 'price' || k === 'area') { el['filter-' + k + '-min'].value = ''; el['filter-' + k + '-max'].value = ''; syncSliderFromInputs(k); }
        else if (el[k] && el[k].type === 'checkbox') el[k].checked = false;
        else if (el[k]) el[k].value = '';
        run();
      }
      // E3-13 UX-17: on a phone the open filter panel ends with a sticky «Show N projects» button (live count, as in
      // marketplace filter sheets); it closes the panel and takes the user to the list.
      var lastNP, lastNU;
      function applyLabel() {
        var b = document.getElementById('filter-apply'); if (!b || lastNP == null) return;
        var ru = lang() === 'ru', units = state.view === 'units', n = units ? lastNU : lastNP;
        b.textContent = n ? (ru ? 'Показать ' : 'Show ') + n + ' ' + (units ? plural(n, ['юнит', 'юнита', 'юнитов'], ['unit', 'units']) : plural(n, ['проект', 'проекта', 'проектов'], ['project', 'projects'])) : (ru ? 'Ничего не найдено' : 'Nothing found');
      }
      function updateCount(np, nu, total) {
        lastNP = np; lastNU = nu; applyLabel();
        var e = document.getElementById('lots-count'); if (!e) return;
        var ru = lang() === 'ru';
        e.textContent = (ru ? 'Показано: ' : 'Shown: ') + np + ' ' + plural(np, ['проект', 'проекта', 'проектов'], ['project', 'projects']) + ' · ' + nu + ' ' + (ru ? 'из' : 'of') + ' ' + total + ' ' + plural(total, ['юнита', 'юнитов', 'юнитов'], ['unit', 'units']);
        e.setAttribute('data-shown', String(nu)); e.setAttribute('data-projects', String(np));
      }

      // ----- view / pane
      function setView(v) {
        state.view = v; app.setAttribute('data-view', v);
        $$('[data-view]', app).forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)); });
        el['units-view'].hidden = v !== 'units'; el['project-list'].hidden = v !== 'projects';
        applyLabel(); writeUrl();
      }
      function setPane(v) {
        state.pane = v; app.setAttribute('data-pane', v);
        if (v !== 'map') hidePreview();
        $$('[data-pane]', app).forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute('data-pane') === v)); });
        if (v === 'map') { ensureMap(); if (map) setTimeout(function () { try { map.resize(); } catch (e) { /* */ } }, 30); }
      }

      // ----- map (MapLibre GL JS, vendored; tiles: OpenFreeMap)
      var mapEl = document.getElementById('map'), mpane = app.querySelector('.mpane');
      function mapVisible() { return mpane && mpane.offsetParent !== null && mapEl && mapEl.clientWidth > 0; }
      function mapFail() {
        mapState = 'failed'; app.setAttribute('data-map', 'failed');
        var st = document.getElementById('map-status'); if (st) st.hidden = false;
      }
      function ensureMap() {
        if (mapState !== 'none' || !mapEl || !mapVisible()) return;
        mapState = 'loading'; app.setAttribute('data-map', 'loading');
        var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = mapEl.getAttribute('data-vendor-css'); document.head.appendChild(css);
        var sc = document.createElement('script'); sc.src = mapEl.getAttribute('data-vendor-js'); sc.async = true;
        sc.onload = createMap; sc.onerror = mapFail; document.head.appendChild(sc);
      }
      function createMap() {
        var ML = window.maplibregl;
        if (!ML) return mapFail();
        try {
          map = new ML.Map({ container: mapEl, style: mapEl.getAttribute('data-map-style'), center: [32.5, 38.6], zoom: 4.6, attributionControl: false, cooperativeGestures: false, dragRotate: false, pitchWithRotate: false });
          map.addControl(new ML.AttributionControl({ compact: false, customAttribution: '© OpenStreetMap contributors · OpenFreeMap' }), 'bottom-right');
          map.addControl(new ML.NavigationControl({ showCompass: false }), 'top-right');
        } catch (e) { map = null; return mapFail(); }
        map.on('error', function () { if (!map.loaded() && mapState === 'loading') { var st = document.getElementById('map-status'); if (st) st.hidden = false; } });
        // E3-13 UX-147 (D-246): fitted again once the style is in — its attribution (taller) and the MapLibre CSS are measured then
        // (not if the user has already moved the map — a slow network loads it seconds later)
        map.on('load', function () { app.setAttribute('data-map', 'ready'); app.setAttribute('data-map-loaded', '1'); if (!touched) refit(); });
        map.on('movestart', function (e) { if (e.originalEvent) touched = true; });
        map.on('zoomend', clusterPins); map.on('resize', clusterPins);
        map.on('click', hidePreview);
        mapState = 'ready'; app.setAttribute('data-map', 'ready');
        buildMarkers(ML);
        $$('[data-map-focus]', app).forEach(function (b) { var p = projById[b.getAttribute('data-map-focus')]; b.hidden = !(p && p.lat != null); });
        updatePins();
      }
      function buildMarkers(ML) {
        var groups = {};
        data.projects.forEach(function (p) {
          if (p.lat == null || p.lon == null) return;
          var k = p.lat.toFixed(4) + ',' + p.lon.toFixed(4);
          (groups[k] = groups[k] || { lat: p.lat, lon: p.lon, exact: p.exact, place: p.place, ps: [] }).ps.push(p);
        });
        Object.keys(groups).forEach(function (k) {
          var g = groups[k];
          var b = document.createElement('button'); b.type = 'button'; b.className = 'pin' + (g.exact ? '' : ' approx');
          b.setAttribute('data-testid', 'map-pin'); b.setAttribute('data-projects', g.ps.map(function (p) { return p.id; }).join(' '));
          b.addEventListener('click', function (e) { e.stopPropagation(); pinClick(g); });
          g.el = b;
          // exact pins sit above their point, resort-centre pins below it: they do not hide each other
          g.marker = new ML.Marker({ element: b, anchor: g.exact ? 'bottom' : 'top' }).setLngLat([g.lon, g.lat]).addTo(map);
          markers.push(g);
        });
      }
      function pinLabel(ps) {
        var c = cur(), mins = [];
        ps.forEach(function (p) { p.vis.forEach(function (l) { var a = amt(l); if (a != null) mins.push(a); }); });
        var ru = lang() === 'ru', n = ps.length;
        var price = mins.length ? (ru ? 'от ' : 'from ') + fmtShort(Math.min.apply(null, mins), c) : (ru ? 'цена не указана' : 'price not stated');
        return (n > 1 ? n + ' · ' : '') + price;
      }
      function pName(p) { return p.unnamed && lang() === 'ru' && p.name_ru ? p.name_ru + ' (' + p.city_name.ru + ')' : p.unnamed ? p.name + ' (' + p.city_name.en + ')' : p.name; }
      function updatePins() {
        if (!map) return;
        var bounds = null;
        markers.forEach(function (g) {
          var vis = g.ps.filter(function (p) { return p.shown; });
          g.vis = vis;
          g.el.hidden = !vis.length;
          g.el.setAttribute('data-visible-projects', vis.map(function (p) { return p.id; }).join(' '));
          if (vis.length) {
            g.el.textContent = pinLabel(vis);
            // D-223: an approximate pin names its place (district or object from OpenStreetMap), else it is the city centre
            g.el.title = vis.map(pName).join(', ') + (g.exact ? '' : g.place ? (lang() === 'ru' ? ' — приблизительно: ' : ' — approximately: ') + g.place[lang()] : (lang() === 'ru' ? ' — центр города' : ' — city centre'));
            if (!bounds) bounds = [[g.lon, g.lat], [g.lon, g.lat]];
            else { bounds[0][0] = Math.min(bounds[0][0], g.lon); bounds[0][1] = Math.min(bounds[0][1], g.lat); bounds[1][0] = Math.max(bounds[1][0], g.lon); bounds[1][1] = Math.max(bounds[1][1], g.lat); }
          }
        });
        if (popup) { popup.remove(); popup = null; }
        // D-223: the margins follow the map size — fixed 100 px left a 400-px map (desktop column, phone) 200 px for the pins,
        // and a city zoomed out until all its pins merged into one cluster
        if (bounds && !fitDone) {
          fitDone = true;
          // E3-13 UX-147 (D-246): the points are fitted with their labels — left of «+ / −» and above the attribution. The 30-px
          // bottom margin put Finike and the south-coast cluster under «© OpenStreetMap», Moscow (north-east corner) under «+ / −».
          // Beside «+ / −» rather than below it, and only a label's height on top: the map stays as close as before (labels kept).
          // The labels are those on screen; once clustered for the new view they are measured again, wider ones fit once more.
          var lab = labelSize();
          fitPins(bounds, lab);
          clusterPins();
          var lab2 = labelSize();
          if (lab2[0] > lab[0] || lab2[1] > lab[1]) fitPins(bounds, lab2);
        }
        app.setAttribute('data-pins', String(markers.filter(function (g) { return !g.el.hidden; }).length));
        clusterPins();
      }
      function labelSize() {
        var w = 0, h = 24;
        markers.concat(clusters).forEach(function (g) { if (!g.el.hidden && g.el.offsetWidth) { w = Math.max(w, g.el.offsetWidth); h = Math.max(h, g.el.offsetHeight); } });
        return [w, h];
      }
      function fitPins(bounds, lab) {
        var cw = mapEl.clientWidth || 400, ph = Math.round(Math.min(100, Math.max(56, cw * 0.14))), half = Math.ceil(lab[0] / 2) + 4, lh = lab[1];
        var mr = mapEl.getBoundingClientRect(), nav = mapEl.querySelector('.maplibregl-ctrl-top-right'), att = mapEl.querySelector('.maplibregl-ctrl-bottom-right');
        var navW = nav && nav.offsetWidth ? mr.right - nav.getBoundingClientRect().left : 0, attH = att && att.offsetHeight ? mr.bottom - att.getBoundingClientRect().top : 0;
        try { map.fitBounds(bounds, { padding: { top: lh + 4, bottom: Math.max(30, attH + lh + 4), left: Math.max(ph, half), right: Math.max(ph, half + navW) }, maxZoom: 10, duration: 0 }); } catch (e) { /* */ }
      }
      // E3-13 (UX-1): pins whose labels would overlap on screen merge into one cluster pin («N проектов · от …»);
      // a click zooms to its members, at street level it lists them. The pins stay in the DOM (filters, e2e) and hide.
      function pinRect(g) {
        var p = map.project([g.lon, g.lat]), w = g.el.offsetWidth || 96, h = g.el.offsetHeight || 24;
        return g.exact ? [p.x - w / 2, p.y - h, p.x + w / 2, p.y] : [p.x - w / 2, p.y, p.x + w / 2, p.y + h];
      }
      function hit(r, s) { return r[0] < s[2] + 4 && s[0] < r[2] + 4 && r[1] < s[3] + 2 && s[1] < r[3] + 2; }
      function clusterLabel(ps) {
        // D-223: «N · от …» like a pin with several projects at one point — the wide «N проектов · от …» label overlapped its
        // neighbours and swallowed them one by one (a whole city in one cluster)
        var n = ps.length, price = pinLabel(ps).replace(/^\d+ · /, '');
        return n + ' · ' + price;
      }
      function measure(label) {
        if (!meas) { meas = document.createElement('span'); meas.className = 'pin cluster'; meas.setAttribute('aria-hidden', 'true'); meas.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0'; mapEl.appendChild(meas); }
        meas.textContent = label; return [meas.offsetWidth || label.length * 7 + 20, meas.offsetHeight || 24];
      }
      function clusterPins() {
        if (!map) return;
        var items = markers.filter(function (g) { return !g.el.hidden; }).map(function (g) { return { members: [g], rect: pinRect(g) }; });
        var merged = true;
        while (merged) {
          merged = false;
          for (var i = 0; i < items.length && !merged; i++) for (var j = i + 1; j < items.length; j++) {
            if (!hit(items[i].rect, items[j].rect)) continue;
            var it = items[i]; it.members = it.members.concat(items[j].members); items.splice(j, 1);
            var x = 0, y = 0, ps = [];
            it.members.forEach(function (g) { var p = map.project([g.lon, g.lat]); x += p.x; y += p.y; ps = ps.concat(g.vis); });
            it.cx = x / it.members.length; it.cy = y / it.members.length; it.ps = ps; it.label = clusterLabel(ps);
            var wh = measure(it.label); it.rect = [it.cx - wh[0] / 2, it.cy - wh[1] / 2, it.cx + wh[0] / 2, it.cy + wh[1] / 2];
            merged = true; break;
          }
        }
        markers.forEach(function (g) { g.el.classList.remove('in-cluster'); });
        var used = 0;
        items.forEach(function (it) {
          if (it.members.length < 2) return;
          it.members.forEach(function (g) { g.el.classList.add('in-cluster'); });
          var c = clusters[used] || (clusters[used] = makeCluster()); used++;
          c.members = it.members; c.ps = it.ps; c.el.textContent = it.label; c.el.hidden = false;
          c.el.title = it.ps.map(pName).join(', ');
          c.el.setAttribute('data-cluster-projects', it.ps.map(function (p) { return p.id; }).join(' '));
          c.el.classList.toggle('active', it.members.some(function (g) { return g.el.classList.contains('active'); }));
          c.marker.setLngLat(map.unproject([it.cx, it.cy]));
          if (!c.added) { c.marker.addTo(map); c.added = true; }
        });
        for (var k = used; k < clusters.length; k++) clusters[k].el.hidden = true;
        app.setAttribute('data-clusters', String(used));
      }
      function makeCluster() {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pin cluster'; b.setAttribute('data-testid', 'map-cluster');
        var c = { el: b, members: [], ps: [], added: false };
        b.addEventListener('click', function (e) { e.stopPropagation(); clusterClick(c); });
        c.marker = new window.maplibregl.Marker({ element: b, anchor: 'center' });
        return c;
      }
      function clusterClick(c) {
        var w = 180, s = 90, e = -180, n = -90;
        c.members.forEach(function (g) { w = Math.min(w, g.lon); e = Math.max(e, g.lon); s = Math.min(s, g.lat); n = Math.max(n, g.lat); });
        // members at (almost) one spot, or already at street level: list them instead of zooming further
        if (map.getZoom() >= 14 || (e - w < 0.002 && n - s < 0.002)) { pinClick({ vis: c.ps, lon: (w + e) / 2, lat: (s + n) / 2 }); return; }
        touched = true; // E3-13 UX-147 (D-246): the zoom the user asked for is not undone by the map's «load»
        try { map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 15, duration: 300 }); } catch (err) { /* */ }
      }
      function refit() { fitDone = false; updatePins(); }
      function pinClick(g) {
        var vis = g.vis || [];
        markers.forEach(function (x) { x.el.classList.toggle('active', x === g); });
        if (vis.length === 1) { pickProject(vis[0].id); return; }
        var box = document.createElement('div'); box.className = 'pop-list'; box.setAttribute('data-testid', 'map-popup');
        vis.forEach(function (p) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'linkish'; b.textContent = pName(p) + ' — ' + pinLabel([p]);
          b.setAttribute('data-focus-project', p.id);
          b.addEventListener('click', function () { pickProject(p.id); });
          box.appendChild(b);
        });
        if (popup) popup.remove();
        popup = new window.maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 28 }).setLngLat([g.lon, g.lat]).setDOMContent(box).addTo(map);
      }
      // E3-13 UX-20: on a phone a pin opens a preview of the project card at the bottom of the map (as in map views of
      // property and travel apps); the user stays on the map, the preview opens the project, × or a tap on the map closes it.
      function isPhone() { return !!(window.matchMedia && window.matchMedia('(max-width: 759px)').matches); }
      function pickProject(pid) {
        if (isPhone() && state.pane === 'map') { if (popup) { popup.remove(); popup = null; } showPreview(pid); } else focusCard(pid);
      }
      function hidePreview() { var w = document.getElementById('map-preview'); if (w) w.hidden = true; }
      function showPreview(pid) {
        var src = cards[pid], box = mapEl && mapEl.parentNode; if (!src || !box) { focusCard(pid); return; }
        var w = document.getElementById('map-preview');
        if (!w) {
          w = document.createElement('div'); w.id = 'map-preview'; w.className = 'map-preview'; w.setAttribute('data-testid', 'map-preview');
          var x = document.createElement('button'); x.type = 'button'; x.className = 'mp-close'; x.setAttribute('data-testid', 'map-preview-close');
          x.setAttribute('aria-label', lang() === 'ru' ? 'Закрыть' : 'Close'); x.textContent = '×';
          x.addEventListener('click', function (e) { e.stopPropagation(); hidePreview(); });
          w.appendChild(x); box.appendChild(w);
        }
        var old = w.querySelector('.pcard'); if (old) old.remove();
        var c = src.cloneNode(true);
        c.removeAttribute('id'); c.classList.remove('hl'); c.hidden = false; c.setAttribute('data-testid', 'map-preview-card');
        $$('.units-d, [data-map-focus]', c).forEach(function (n) { n.remove(); });
        w.insertBefore(c, w.firstChild); w.hidden = false;
        Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('hl', k === pid); });
        app.setAttribute('data-active-project', pid);
      }
      function focusCard(pid) {
        if (state.view !== 'projects') setView('projects');
        if (state.pane === 'map' && window.matchMedia && window.matchMedia('(max-width: 759px)').matches) setPane('list');
        Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('hl', k === pid); });
        app.setAttribute('data-active-project', pid);
        var c = cards[pid]; if (!c) return;
        try { c.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { c.scrollIntoView(); }
        var a = c.querySelector('h3 a'); if (a) try { a.focus({ preventScroll: true }); } catch (e) { /* */ }
      }
      function focusPin(pid) {
        var p = projById[pid]; if (!p || p.lat == null) return;
        if (window.matchMedia && window.matchMedia('(max-width: 759px)').matches) setPane('map');
        ensureMap();
        Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('hl', k === pid); });
        app.setAttribute('data-active-project', pid);
        if (!map) return;
        markers.forEach(function (g) { g.el.classList.toggle('active', g.ps.indexOf(p) >= 0); });
        try { map.jumpTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), p.exact ? 12 : 9) }); } catch (e) { /* */ }
        clusterPins();
      }

      // E3-13 UX-33: the selection lives in the address (?city=antalya&pmax=300000&cur=USD&rental=1…), so «Back», a reload or a
      // shared link bring back the same list; only set filters are written, without them the address stays /lots/
      var CHECKS = [['filter-rental', 'rental'], ['filter-tapu', 'tapu'], ['filter-nored', 'nored'], ['filter-priced', 'priced'], ['filter-guar', 'guar']];
      var urlReady = false;
      function writeUrl() {
        if (!urlReady || !window.history || !history.replaceState || !window.URLSearchParams) return;
        var p = new URLSearchParams(), q = String(el['filter-search'].value || '').trim();
        if (q) p.set('q', q);
        if (chipSel.length) p.set('city', chipSel.map(function (c) { return c.split('/').pop(); }).join(','));
        ['price', 'area'].forEach(function (k) { ['min', 'max'].forEach(function (x) { var v = String(el['filter-' + k + '-' + x].value || '').trim(); if (v) p.set(k.charAt(0) + x, v); }); });
        if (p.has('pmin') || p.has('pmax')) p.set('cur', cur());
        CHECKS.forEach(function (c) { if (el[c[0]].checked) p.set(c[1], '1'); });
        if (el['filter-status'].value) p.set('status', el['filter-status'].value);
        if (el['filter-month'].value) p.set('month', el['filter-month'].value);
        if (el['filter-yield'].value) p.set('yield', el['filter-yield'].value);
        if (el['filter-ycur'].value) p.set('ycur', el['filter-ycur'].value);
        if (el.sort.value && el.sort.value !== 'ppm-asc') p.set('sort', el.sort.value);
        if (state.view === 'units') p.set('view', 'units');
        var qs = p.toString(), url = location.pathname + (qs ? '?' + qs : '') + location.hash;
        if (url !== location.pathname + location.search + location.hash) { try { history.replaceState(history.state, '', url); } catch (e) { /* */ } }
      }
      function readUrl() {
        if (!window.URLSearchParams || !location.search) return;
        var p = new URLSearchParams(location.search), has = function (sel, v) { return !!$$('option', sel).filter(function (o) { return o.value === v; }).length; };
        if (p.get('q')) el['filter-search'].value = p.get('q');
        if (p.get('city')) {
          var want = p.get('city').split(',');
          chipSel = chips.map(function (x) { return x.getAttribute('data-chip'); }).filter(function (cv) { return cv && want.some(function (w) { return cv === w || cv.split('/').pop() === w; }); });
          chips.forEach(function (x) { var cv = x.getAttribute('data-chip'); x.setAttribute('aria-pressed', String(cv ? chipSel.indexOf(cv) >= 0 : chipSel.length === 0)); });
          // E3-13 UX-82: a city opened by link (?city=) — its chip may sit past the edge of the scrolling strip; bring it into view
          var on = chips.filter(function (x) { return x.getAttribute('data-chip') && x.getAttribute('aria-pressed') === 'true'; })[0], row = on && on.parentNode;
          if (row && row.scrollWidth > row.clientWidth) { try { row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - 16; } catch (e) { /* */ } }
        }
        if (p.get('cur') && has(el['filter-currency'], p.get('cur'))) { el['filter-currency'].value = p.get('cur'); d.setAttribute('data-cur', cur()); setupSlider('price'); }
        ['price', 'area'].forEach(function (k) { ['min', 'max'].forEach(function (x) { var v = p.get(k.charAt(0) + x); if (v != null && isFinite(Number(v))) el['filter-' + k + '-' + x].value = v; }); syncSliderFromInputs(k); });
        CHECKS.forEach(function (c) { if (p.get(c[1]) === '1') el[c[0]].checked = true; });
        ['status', 'month', 'yield', 'ycur', 'sort'].forEach(function (k) { var s = k === 'sort' ? el.sort : el['filter-' + k]; if (p.get(k) && has(s, p.get(k))) s.value = p.get(k); });
        if (p.get('view') === 'units') setView('units');
      }

      // ----- events
      fillCurrencies(); setupSlider('area');
      el['filter-search'].addEventListener('input', run);
      chips.forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-chip');
          if (!v) chipSel = [];
          else { var i = chipSel.indexOf(v); if (i >= 0) chipSel.splice(i, 1); else chipSel.push(v); }
          chips.forEach(function (x) { var cv = x.getAttribute('data-chip'); x.setAttribute('aria-pressed', String(cv ? chipSel.indexOf(cv) >= 0 : chipSel.length === 0)); });
          run(); refit();
        });
      });
      ['price', 'area'].forEach(function (k) {
        el[k + '-lo'].addEventListener('input', function () { onSlider(k, 'lo'); });
        el[k + '-hi'].addEventListener('input', function () { onSlider(k, 'hi'); });
        nearestThumbDrag(k);
        ['min', 'max'].forEach(function (x) { var e = el['filter-' + k + '-' + x]; e.addEventListener('input', function () { syncSliderFromInputs(k); run(); }); e.addEventListener('change', function () { syncSliderFromInputs(k); run(); }); });
      });
      el['filter-currency'].addEventListener('change', function () {
        // E3-13 UX-71: the budget follows the currency (at the site's rate) instead of being cleared — «up to $150k» → RUB
        // used to drop the price filter and show all 230 units as if they fitted
        var from = d.getAttribute('data-cur'), k = convFactor(from, cur()), mn = numVal('filter-price-min'), mx = numVal('filter-price-max');
        d.setAttribute('data-cur', cur()); store(KEY_CUR, cur());
        el['filter-price-min'].value = mn != null && k ? String(round3(mn * k, false)) : '';
        el['filter-price-max'].value = mx != null && k ? String(round3(mx * k, true)) : '';
        setupSlider('price'); run(); fitScales();
      });
      ['filter-rental', 'filter-tapu', 'filter-nored', 'filter-priced', 'filter-status', 'filter-month', 'filter-yield', 'filter-ycur', 'filter-guar', 'sort'].forEach(function (id) { el[id].addEventListener('change', run); });
      document.getElementById('filter-reset').addEventListener('click', function () {
        el['filter-search'].value = ''; chipSel = [];
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(!x.getAttribute('data-chip'))); });
        ['filter-price-min', 'filter-price-max', 'filter-area-min', 'filter-area-max'].forEach(function (id) { el[id].value = ''; });
        ['filter-rental', 'filter-tapu', 'filter-nored', 'filter-priced', 'filter-guar'].forEach(function (id) { el[id].checked = false; });
        el['filter-status'].value = ''; el['filter-month'].value = ''; el['filter-yield'].value = ''; el['filter-ycur'].value = ''; el.sort.value = 'ppm-asc';
        syncSliderFromInputs('price'); syncSliderFromInputs('area'); run(); refit();
      });
      $$('button[data-view]', app).forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
      $$('button[data-pane]', app).forEach(function (b) { b.addEventListener('click', function () { setPane(b.getAttribute('data-pane')); }); });
      app.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-map-focus]'); if (b) focusPin(b.getAttribute('data-map-focus')); });
      app.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('[data-clear]'); if (c) { clearFilter(c.getAttribute('data-clear')); return; }
        var br = e.target.closest && e.target.closest('[data-budget-raise]'); if (br) { el['filter-price-max'].value = br.getAttribute('data-budget-raise'); syncSliderFromInputs('price'); run(); return; }
        if (e.target.closest && e.target.closest('[data-reset-filters]')) document.getElementById('filter-reset').click();
        if (e.target.closest && e.target.closest('[data-yield-all]')) { el['filter-yield'].value = ''; el['filter-ycur'].value = ''; el['filter-guar'].checked = false; run(); return; }
        if (e.target.closest && e.target.closest('[data-search-wide]')) { var q = el['filter-search'].value; document.getElementById('filter-reset').click(); el['filter-search'].value = q; run(); } // UX-98: keep the query
      });
      app.addEventListener('mouseover', function (e) {
        var c = e.target.closest && e.target.closest('[data-testid="project-card"]'); if (!c || !map) return;
        var pid = c.getAttribute('data-project-id');
        markers.forEach(function (g) { g.el.classList.toggle('hover', g.ps.some(function (p) { return p.id === pid; })); });
        clusters.forEach(function (c) { c.el.classList.toggle('hover', !c.el.hidden && c.ps.some(function (p) { return p.id === pid; })); });
      });
      document.addEventListener('thr:prefs', function () { fillCurrencies(); run(); fitScales(); });
      window.addEventListener('resize', function () { if (mapState === 'none') ensureMap(); fitScales(); });
      if (el.fwrap) el.fwrap.addEventListener('toggle', fitScales);
      var fapply = document.getElementById('filter-apply');
      if (fapply) fapply.addEventListener('click', function () {
        if (el.fwrap) el.fwrap.open = false;
        var to = document.getElementById('lots-count') || app;
        window.scrollTo(0, Math.max(0, to.getBoundingClientRect().top + window.pageYOffset - 8));
      });
      readUrl(); urlReady = true;
      run();
      fitScales();
      ensureMap();
      // E3-13 UX-67: «Back» from a lot returns to the same card with its «Units» still open. Without the page cache the browser's
      // own scroll restoration landed thousands of px away (the list is re-sorted by JS) with every card closed.
      if ('scrollRestoration' in history) { try { history.scrollRestoration = 'manual'; } catch (e) { /* */ } }
      restoreList();
      window.addEventListener('pagehide', saveList);
      app.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href]')) saveList(); }, true);
    });
  }
  // ---------- /compare
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function bi(o) { return '<span class="t" lang="ru">' + esc(o.ru) + '</span><span class="t" lang="en">' + esc(o.en) + '</span>'; }
  // E3-13 UX-15 (D-111): lot picker on /compare — city chooser, lots of the chosen lot's project/city first, «+ compare» in place
  var cmpCity = null, cmpLimit = 8, cmpMoreOpen = false;
  function cmpPrice(l) {
    var c = syncCur(), a = l.amt && c && l.amt[c] != null ? l.amt[c] : null;
    if (a != null) return fmtShort(a, c);
    return l.price != null ? fmtShort(l.price, l.currency) : '';
  }
  function cmpMeta(l) {
    // E3-13 UX-150 (D-249): floor tells apart same-titled units of one project (AIST studios read «Moscow · £115k» twice)
    var parts = [l.city_name ? (lang() === 'ru' ? l.city_name.ru : l.city_name.en) : '', cmpPrice(l), l.floor != null ? (lang() === 'ru' ? l.floor + ' этаж' : 'floor ' + l.floor) : '']; // area is already in the title
    return esc(parts.filter(Boolean).join(' · '));
  }
  function cmpCandidates(data, chosen) {
    var ids = chosen.map(function (l) { return l.id; }), first = chosen[0];
    var city = cmpCity === null ? (first ? first.city : '') : cmpCity;
    var c = syncCur();
    var list = data.lots.filter(function (l) { return ids.indexOf(l.id) < 0 && !l.archived && (!city || l.city === city); });
    var pr = function (l) { return l.amt && c && l.amt[c] != null ? l.amt[c] : Infinity; };
    list.sort(function (a, b) {
      var sa = first && a.project === first.project && !a.project_unnamed ? 0 : 1, sb = first && b.project === first.project && !b.project_unnamed ? 0 : 1;
      return sa - sb || pr(a) - pr(b) || (a.id < b.id ? -1 : 1);
    });
    return { city: city, list: list };
  }
  function cmpPicker(data, chosen, open) {
    var cc = cmpCandidates(data, chosen), counts = {}, names = {};
    data.lots.forEach(function (l) { if (l.archived) return; counts[l.city] = (counts[l.city] || 0) + 1; names[l.city] = l.city_name; });
    var cities = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var opts = '<option value=""' + (cc.city ? '' : ' selected') + '>' + esc(lang() === 'ru' ? 'Все города' : 'All cities') + '</option>' + cities.map(function (k) {
      var n = names[k] || { ru: k, en: k };
      return '<option value="' + esc(k) + '"' + (k === cc.city ? ' selected' : '') + '>' + esc(lang() === 'ru' ? n.ru : n.en) + ' (' + counts[k] + ')</option>';
    }).join('');
    var shown = cc.list.slice(0, cmpLimit);
    // E3-13 UX-42 (D-138): on phones the picker's «+ compare» is a 44×44 «+» (the word stays for screen readers: CSS .add-t),
    // so the lot title next to it gets ~60 px more width and wraps into fewer lines
    var rows = shown.map(function (l) {
      return '<li class="cmp-row" data-testid="picker-row"><div class="cmp-t"><a href="' + esc(l.url) + '">' + bi(l.title) + '</a><span class="muted small">' + cmpMeta(l) + '</span></div>' +
        '<button type="button" class="btn btn-compare" data-compare-id="' + esc(l.id) + '" aria-pressed="false" data-testid="picker-add"><span class="when-off"><span class="add-p">+</span> <span class="add-t">' + bi({ ru: 'сравнить', en: 'compare' }) + '</span></span><span class="when-on">✓</span></button></li>';
    }).join('');
    // E3-13 UX-32 (D-128): with fewer than 2 lots the picker heading is also the status line (no separate note above the chosen lot)
    var h = open === 'need' ? '<h2 id="compare-empty">' + bi(chosen.length ? { ru: 'Добавьте ещё хотя бы один лот', en: 'Add at least one more lot' } : { ru: 'Выберите два лота для сравнения', en: 'Pick two lots to compare' }) + '</h2>'
      : open ? '<h2>' + bi({ ru: 'Добавить лот к сравнению', en: 'Add a lot to compare' }) + '</h2>' : '';
    return '<section class="cmp-picker" data-testid="compare-picker">' + h +
      '<label class="cmp-city"><span>' + bi({ ru: 'Город', en: 'City' }) + '</span> <select data-testid="picker-city">' + opts + '</select></label>' +
      (chosen.length ? '<p class="muted small">' + bi({ ru: 'Сначала — тот же проект, потом по цене.', en: 'Same project first, then by price.' }) + '</p>' : '<p class="muted small">' + bi({ ru: 'По цене, от меньшей.', en: 'By price, lowest first.' }) + '</p>') +
      '<ul class="cmp-list">' + rows + '</ul>' +
      '<p class="cmp-foot">' + (cc.list.length > shown.length ? '<button type="button" class="btn" data-picker-more data-testid="picker-more">' + bi({ ru: 'Показать ещё (' + (cc.list.length - shown.length) + ')', en: 'Show more (' + (cc.list.length - shown.length) + ')' }) + '</button> ' : '') +
      '<a href="/lots/">' + bi({ ru: 'Все лоты с фильтрами', en: 'All lots with filters' }) + '</a></p></section>';
  }
  function bindPicker(app, data, chosen) {
    var sel = app.querySelector('[data-testid="picker-city"]');
    if (sel) sel.addEventListener('change', function () { cmpCity = sel.value; cmpLimit = 8; renderCompare(); });
    var more = app.querySelector('[data-picker-more]');
    if (more) more.addEventListener('click', function () { cmpLimit += 8; renderCompare(); });
  }
  // E3-13 UX-26 (D-122): table head — room type · area as the link (what tells the chosen lots apart), the project name a small
  // line under it; an unnamed project loses its «(City)» there — the City row right below names the city (UX-58, D-157: only the city, the project stays in the head).
  // E3-13 UX-52 (D-150): Chromium does not hyphenate capitalised English words (control pairs Apartments/apartments,
  // Residences/residences, Departments/departments at 320 px), so «Apartment,» moved below the «×» and left an empty strip;
  // soft hyphens in the capitalised room-type words of the data. They break only on phones: on wider screens .cmp-u has hyphens: none.
  var SHY_EN = { Apartment: 5, Apartments: 5, Residence: 4, Residences: 4, Penthouse: 4, Standard: 4, Bedrooms: 3, Panoramic: 4 };
  function shyEn(s) { return String(s || '').replace(/\b[A-Z][a-z]{7,}\b/g, function (w) { var k = SHY_EN[w]; return k ? w.slice(0, k) + '\u00AD' + w.slice(k) : w; }); }
  function cmpHead(l) {
    var part = function (lg) {
      var t = l.title[lg], u = l.unit && l.unit[lg];
      var p = l.project_unnamed ? (lg === 'ru' ? l.project_name_ru : l.project_name) : (u && t.slice(-(u.length + 3)) === ' · ' + u ? t.slice(0, t.length - u.length - 3) : t);
      return { u: u || p, p: u ? p : '' };
    };
    var r = part('ru'), e = part('en');
    return '<a class="cmp-lt" href="' + esc(l.url) + '"><span class="cmp-u">' + bi({ ru: r.u, en: shyEn(e.u) }) + '</span>' +
      (r.p || e.p ? ' <span class="cmp-p">' + bi({ ru: r.p, en: e.p }) + '</span>' : '') + '</a>';
  }
  function renderCompare() {
    var app = document.getElementById('compare-app'); if (!app) return;
    var sel = cmpList();
    getLotsCmp(function (data) {
      var lots = data ? sel.map(function (id) { return data.lots.filter(function (l) { return l.id === id; })[0]; }).filter(Boolean) : [];
      if (lots.length < 2) {
        // E3-13 UX-15 (D-111): not a dead end — the chosen lot stays visible and lots can be added right here
        // UX-32 (D-128): the status is the picker heading; the note stays only when lots.json did not load
        // E3-13 UX-34 (D-130): on phones the chosen lot's «Remove» is a 44×44 «×» (the word stays for screen readers: CSS .rm-t)
        app.innerHTML = (data ? '' : '<p class="note" id="compare-empty">' + bi({ ru: 'Выбрано меньше двух лотов.', en: 'Fewer than two lots selected.' }) + '</p>') +
          (lots.length ? '<div class="cmp-chosen" data-testid="compare-chosen">' + lots.map(function (l) { return '<div class="cmp-row"><div class="cmp-t"><a href="' + esc(l.url) + '">' + bi(l.title) + '</a><span class="muted small">' + cmpMeta(l) + '</span></div><button type="button" class="btn btn-remove" data-compare-id="' + esc(l.id) + '" data-testid="compare-remove"><span aria-hidden="true">×</span> <span class="rm-t">' + bi({ ru: 'Убрать', en: 'Remove' }) + '</span></button></div>'; }).join('') + '</div>' : '') +
          (data ? cmpPicker(data, lots, 'need') : '<p><a href="/lots/">' + bi({ ru: 'Лоты', en: 'Lots' }) + '</a></p>');
        bindPicker(app, data, lots);
        return;
      }
      // E3-13 UX-23 (D-119): explicit ARIA table roles — on a phone the table is laid out as a grid (field name as a full-width line
      // above the values, lots side by side), and CSS display changes must not drop the table semantics for screen readers.
      var head = '<tr role="row"><th scope="col" role="columnheader" class="cmp-fh">' + bi({ ru: 'Поле', en: 'Field' }) + '</th>' + lots.map(function (l) {
        // E3-13 UX-44 (D-140): on phones «Remove» is a 44×44 «×» in the head's top-right corner (the word stays for screen readers: CSS .rm-t)
        return '<th scope="col" role="columnheader" class="cmp-lh">' + cmpHead(l) + '<button type="button" class="btn btn-remove" data-compare-id="' + esc(l.id) + '" data-testid="compare-remove"><span aria-hidden="true">×</span> <span class="rm-t">' + bi({ ru: 'Убрать', en: 'Remove' }) + '</span></button></th>';
      }).join('') + '</tr>';
      // E3-13 UX-7: a row with no data for every lot is hidden (nothing to compare); «Differences only» also hides rows where
      // every lot has the same value. Values are compared by their text, without labels, source tags and quotes.
      var keyOf = function (html) {
        var d = document.createElement('div'); d.innerHTML = html || '';
        var v = d.querySelectorAll('.v');
        if (v.length) return [].map.call(v, function (x) { return x.textContent.replace(/\s+/g, ' ').trim(); }).join('|');
        var txt = d.textContent.replace(/\s+/g, ' ').trim();
        return d.querySelector('.unknown, .nodata') || !txt || txt === '—' ? '' : txt;
      };
      // E3-13 UX-85: a cell identical for every lot — the same value with the same sources (the HTML without its pop-up ids) — is
      // shown once across the lot columns, and the field name says «same for all»: three units of one project repeated its status,
      // operator, rental programme… three times (2.9k px on a phone); what differs stays side by side. Same text from different
      // sources is not merged — every lot keeps its own source.
      var norm = function (html) { return String(html || '').replace(/ (?:id|aria-controls)="c-[^"]*"/g, ''); };
      var empties = 0;
      var rows = data.fields.map(function (f) {
        var keys = lots.map(function (l) { return keyOf(l.cmp[f.key]); });
        var empty = keys.every(function (k) { return !k; }), same = !empty && keys.every(function (k) { return k === keys[0]; });
        var all = same && lots.every(function (l) { return norm(l.cmp[f.key]) === norm(lots[0].cmp[f.key]); });
        if (empty) empties++;
        return '<tr role="row" data-field="' + esc(f.key) + '"' + (empty ? ' data-empty="1"' : '') + (same ? ' data-same="1"' : '') + (all ? ' data-all="1"' : '') + '><th scope="row" role="rowheader">' + bi(f.label) + (all ? '<span class="cmp-same-l" data-testid="compare-same">' + bi({ ru: 'одинаково у всех', en: 'same for all' }) + '</span>' : '') + '</th>' +
          (all ? '<td role="cell" class="cmp-all" colspan="' + lots.length + '" aria-colspan="' + lots.length + '">' + lots[0].cmp[f.key] + '</td>' : lots.map(function (l) { return '<td role="cell">' + (l.cmp[f.key] || '—') + '</td>'; }).join('')) + '</tr>';
      }).join('');
      var bar = '<div class="cmp-bar"><label class="cmp-diff-l"><input type="checkbox" id="cmp-diff" data-testid="compare-diff"' + (cmpDiff ? ' checked' : '') + '> ' + bi({ ru: 'Только различия', en: 'Differences only' }) + '</label>' +
        (empties ? '<span class="muted small" data-testid="compare-hidden">' + bi({ ru: 'Скрыто пустых: ' + empties, en: 'Empty rows hidden: ' + empties }) + '</span>' : '') + '</div>';
      app.innerHTML = bar + '<div class="scroll' + (cmpDiff ? ' cmp-only-diff' : '') + '"><table class="compare-table" role="table" style="--n:' + lots.length + '" data-n="' + lots.length + '" data-testid="compare-table"><thead role="rowgroup">' + head + '</thead><tbody role="rowgroup">' + rows + '</tbody></table></div>' +
        (lots.length < 4 ? '<details class="cmp-more" data-testid="compare-more"' + (cmpMoreOpen ? ' open' : '') + '><summary>' + bi({ ru: 'Добавить лот (можно ещё ' + (4 - lots.length) + ')', en: 'Add a lot (' + (4 - lots.length) + ' more allowed)' }) + '</summary>' + cmpPicker(data, lots, false) + '</details>' : '');
      bindPicker(app, data, lots);
      var more = app.querySelector('.cmp-more'); if (more) more.addEventListener('toggle', function () { cmpMoreOpen = more.open; });
      var cb = document.getElementById('cmp-diff');
      cb.addEventListener('change', function () { cmpDiff = cb.checked; store('thr.cmpdiff', cmpDiff ? '1' : ''); app.querySelector('.scroll').classList.toggle('cmp-only-diff', cmpDiff); });
    });
  }
  function initCompare() {
    if (!document.getElementById('compare-app')) return;
    renderCompare();
    document.addEventListener('thr:prefs', renderCompare); // language / currency change re-labels the picker (UX-15)
    var clr = document.getElementById('compare-clear');
    if (clr) clr.addEventListener('click', function () { cmpSave([]); syncCompare(); renderCompare(); });
  }

  // ---------- /sources: type chips (E3-13 UX-14, D-110) — one type at a time; «All» shows every domain
  // + domain search (E3-13 UX-99, D-198): the query matches the domain and the row's URLs, together with the chosen type
  function initSources() {
    var box = document.querySelector('[data-testid="source-types"]'); if (!box) return;
    var rows = [].slice.call(document.querySelectorAll('table.sources tbody tr')), none = document.getElementById('sources-none');
    var q = document.getElementById('source-search'), ty = '';
    var msg = none && none.querySelector('[data-testid="sources-none-msg"]'), clr = none && none.querySelector('[data-testid="source-search-clear"]'), wide = none && none.querySelector('[data-testid="source-search-wide"]');
    var msg0 = msg ? msg.innerHTML : '';
    function norm(x) { return String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, ''); }
    var hay = rows.map(function (r) { return [r.getAttribute('data-host')].concat([].map.call(r.querySelectorAll('a[href]'), function (a) { return norm(a.getAttribute('href')); })).join(' ').toLowerCase(); });
    function typeOk(r, t) { return !t || (' ' + r.getAttribute('data-types') + ' ').indexOf(' ' + t + ' ') >= 0; }
    function run() {
      var s = norm(q ? q.value : ''), shown = 0, any = 0;
      rows.forEach(function (r, i) { var hit = !s || hay[i].indexOf(s) >= 0, ok = hit && typeOk(r, ty); r.hidden = !ok; if (ok) shown++; if (hit) any++; });
      placeAll(); // UX-120: rows shown again get their list re-placed (a resize while hidden measured an empty row)
      if (!none) return;
      none.hidden = shown > 0;
      if (clr) clr.hidden = !s || shown > 0;
      if (wide) wide.hidden = true;
      if (!msg || shown > 0) return;
      if (!s) { msg.innerHTML = msg0; return; }
      var ru = lang() === 'ru', raw = q.value.trim();
      if (any && ty) {
        msg.textContent = ru ? 'По запросу «' + raw + '» среди источников этого типа ничего нет.' : 'No sources of this type match «' + raw + '».';
        wide.hidden = false; wide.textContent = (ru ? 'Искать во всех типах' : 'Search all types') + ' (' + any + ')';
      } else {
        msg.textContent = ru ? 'По запросу «' + raw + '» источников нет. Поиск — по домену и адресам страниц.' : 'No sources match «' + raw + '». The search looks at the domain and the page addresses.';
      }
    }
    function pick(b) {
      ty = b.getAttribute('data-type');
      [].forEach.call(box.querySelectorAll('button[data-type]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      run();
    }
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-type]'); if (b) pick(b); });
    if (q) q.addEventListener('input', run);
    if (clr) clr.addEventListener('click', function () { q.value = ''; run(); q.focus(); });
    if (wide) wide.addEventListener('click', function () { var all = box.querySelector('button[data-type=""]'); if (all) pick(all); });
    document.addEventListener('thr:prefs', run); // language change re-words the message
    // E3-13 UX-120 (D-215): from 800 px an open URL list spans the row (style.css); it starts below the lowest line of the row's
    // other cells (type, domain, note may wrap), so it never covers them — recomputed on open, resize and language change
    var wideMq = window.matchMedia ? window.matchMedia('(min-width: 800px)') : null;
    function placeUrls(d) {
      var ul = d.querySelector('ul'), sum = d.querySelector('summary'); if (!ul || !sum) return;
      ul.style.marginTop = '';
      var tr = d.closest('tr');
      if (!d.open || !wideMq || !wideMq.matches || !tr || tr.hidden || !tr.getClientRects().length) return; // a hidden row has no geometry
      // UX-124 (D-217): viewport coordinates are negative for a row scrolled above the window (a language switch from the footer, a resize
      // further down the page), so the lowest line starts at -Infinity, not 0 — from 0 the gap took the whole scroll offset (~2400 px)
      var low = -Infinity;
      [].forEach.call(tr.querySelectorAll('th, td:not(.s-urls)'), function (c) { var r = document.createRange(); r.selectNodeContents(c); [].forEach.call(r.getClientRects(), function (x) { if (x.width && x.bottom > low) low = x.bottom; }); });
      if (low === -Infinity) return;
      var top = ul.getBoundingClientRect().top, gap = Math.ceil(low + 4 - top);
      if (gap > 0) ul.style.marginTop = (parseFloat(getComputedStyle(ul).marginTop) || 0) + gap + 'px';
    }
    function placeAll() { [].forEach.call(document.querySelectorAll('table.sources td.s-urls details[open]'), placeUrls); }
    document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('table.sources td.s-urls details')) placeUrls(d); }, true);
    var placeRaf = 0; window.addEventListener('resize', function () { if (!placeRaf) placeRaf = requestAnimationFrame(function () { placeRaf = 0; placeAll(); }); });
    document.addEventListener('thr:prefs', placeAll);
    if (q && q.value) run(); // the browser restored the field (Back)
  }

  // ---------- /check/?lot=<id> (D-259): the lot or project the visitor came from, by its id in lots.json; unknown id — nothing shown
  function initCheck() {
    var box = document.querySelector('[data-testid="check-lot"]');
    if (!box || !window.URLSearchParams) return;
    var id = new URLSearchParams(location.search).get('lot');
    if (!id) return;
    getLots(function (j) {
      if (!j) return;
      var same = function (x) { return x.id === id; };
      var l = j.lots.filter(same)[0], p = l ? null : j.projects.filter(same)[0];
      if (!l && !p) return;
      var a = box.querySelector('a'), sp = a.querySelectorAll('span');
      a.href = (l || p).url;
      sp[0].textContent = l ? l.title.ru : (p.name_ru || p.name);
      sp[1].textContent = l ? l.title.en : p.name;
      box.hidden = false;
      var f = document.querySelector('[data-offer-form] [name="lot"]');
      if (f) f.value = id;
    });
  }

  function init() { expandPrices(); mirrorCount(); apply(); syncCompare(); initTabs(); initLots(); initCompare(); initSources(); initCheck(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('storage', function (e) { if (e.key === KEY_CMP) { syncCompare(); if (document.getElementById('compare-app')) renderCompare(); } });
})();
