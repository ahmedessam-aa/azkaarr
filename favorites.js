'use strict';

/* =========================================================
   Helpers for surah names (the API returns "سُورَةُ ٱلْفَاتِحَةِ", other places want just the bare name)
   ========================================================= */
function _stripDia(s){ return String(s || '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, ''); }
// "سُورَةُ ٱلْفَاتِحَةِ" -> "ٱلْفَاتِحَةِ"   |   "الفاتحة" -> "الفاتحة"
function surahBare(name){
  const n = String(name || '').trim();
  if(_stripDia(n).startsWith('سورة')) return n.replace(/^\S+\s+/, '');
  return n;
}
// always starts with the word سورة (keeps the tashkeel when the API gave it)
function surahFull(name){
  const n = String(name || '').trim();
  if(!n) return '—';
  return _stripDia(n).startsWith('سورة') ? n : `سُورَةُ ${n}`;
}
// plain label used in lists / toasts:  "سورة الفاتحة"
function surahLabel(name){
  const b = surahBare(name);
  return b ? `سورة ${_stripDia(b)}` : 'سورة';
}
window.surahBare = surahBare;
window.surahFull = surahFull;
window.surahLabel = surahLabel;

/* =========================================================
   المفضلة — Favorites
   ========================================================= */
const Favorites = (()=>{
  const KEY = 'azkar_favorites';
  const registry = new Map();      // id -> item, filled every time a heart button is rendered
  const listeners = [];
  let items = load();
  let filter = 'all';

  const ICON = {
    heart:   '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    surah:   '<path d="M12 6.5c-1.6-1.3-4-2-6.5-1.7v13c2.5-.3 4.9.4 6.5 1.7 1.6-1.3 4-2 6.5-1.7v-13c-2.5-.3-4.9.4-6.5 1.7z"/><line x1="12" y1="6.5" x2="12" y2="19.5"/>',
    ayah:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>',
    dhikr:   '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
    dua:     '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
    hadith:  '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
    prophet: '<path d="M12 3l1.9 4.6L19 9l-4 3.3L16.2 17 12 14.3 7.8 17 9 12.3 5 9l5.1-1.4z"/>',
    seerah:  '<path d="M12 3v18"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M14 7h6M4 17h6"/>',
    fatwa:   '<circle cx="12" cy="12" r="9"/><path d="M12 17v.01M12 14c0-2.5 2.5-2 2.5-4.5A2.5 2.5 0 0012 7a2.5 2.5 0 00-2.5 2.5"/>',
    mosque:  '<path d="M12 3v2"/><path d="M6 21v-7a6 6 0 0112 0v7"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 014 0v4"/>',
  };
  const TYPES = {
    surah:   { label:'السور',          one:'سورة' },
    ayah:    { label:'الآيات',         one:'آية' },
    dhikr:   { label:'الأذكار',        one:'ذكر' },
    dua:     { label:'الأدعية',        one:'دعاء' },
    hadith:  { label:'الأحاديث',       one:'حديث' },
    prophet: { label:'قصص الأنبياء',   one:'قصة نبي' },
    seerah:  { label:'السيرة النبوية', one:'سيرة' },
    fatwa:   { label:'مصادر الفتوى',   one:'مصدر فتوى' },
    mosque:  { label:'المساجد',        one:'مسجد' },
  };

  function svg(name, cls){
    return `<svg class="${cls||''}" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------------- storage ---------------- */
  function load(){
    try{
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(i => i && i.id && i.type) : [];
    }catch(e){ return []; }
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(items)); }catch(e){}
  }
  function has(id){ return items.some(i => i.id === id); }
  function count(){ return items.length; }

  function changed(id){
    syncButtons(id);
    updateBadge();
    if(document.getElementById('page-favorites')?.classList.contains('active')) render();
    listeners.forEach(fn => { try{ fn(id); }catch(e){} });
  }
  function add(item){
    if(has(item.id)) return;
    items.unshift({ id:item.id, type:item.type, title:item.title||'', text:item.text||'', sub:item.sub||'', data:item.data||{}, at:Date.now() });
    save();
    changed(item.id);
  }
  function remove(id){
    if(!has(id)) return;
    items = items.filter(i => i.id !== id);
    save();
    changed(id);
  }
  function toast(msg){ if(typeof showToast === 'function') showToast(msg); }
  function toggle(item){
    if(has(item.id)){ remove(item.id); toast('أُزيل من المفضلة'); return false; }
    add(item); toast('أُضيف إلى المفضلة ♥'); return true;
  }
  function onChange(fn){ listeners.push(fn); }

  /* ---------------- heart button ---------------- */
  function btn(item, cls){
    registry.set(item.id, item);
    const on = has(item.id);
    return `<button type="button" class="fav-btn ${cls||''} ${on?'on':''}" data-fav="${esc(item.id)}" aria-pressed="${on}" aria-label="${on?'إزالة من المفضلة':'إضافة إلى المفضلة'}" title="${on?'إزالة من المفضلة':'إضافة إلى المفضلة'}">${svg('heart')}</button>`;
  }
  function syncButtons(id){
    const on = has(id);
    document.querySelectorAll('.fav-btn').forEach(b=>{
      if(b.dataset.fav !== id) return;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      const label = on ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    });
  }
  function updateBadge(){
    document.querySelectorAll('[data-fav-count]').forEach(el=>{
      el.textContent = count();
      el.style.display = count() ? '' : 'none';
    });
  }

  // capture phase: the heart must never trigger the card / accordion / counter underneath it
  document.addEventListener('click', (e)=>{
    const b = e.target.closest('.fav-btn');
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    const item = registry.get(b.dataset.fav);
    if(item) toggle(item);
  }, true);

  /* ---------------- item builders ---------------- */
  function surahItem(s){
    const mk = s.revelationType === 'Meccan' ? 'مكية' : (s.revelationType === 'Medinan' ? 'مدنية' : '');
    return {
      id: `surah:${s.number}`, type:'surah',
      title: surahLabel(s.name),
      sub: [s.numberOfAyahs ? `${s.numberOfAyahs} آية` : '', mk].filter(Boolean).join(' · '),
      data: { n: s.number },
    };
  }

  /* ---------------- opening an item ---------------- */
  function scrollToEl(sel, open){
    setTimeout(()=>{
      const el = document.querySelector(sel);
      if(!el) return;
      if(open) el.classList.add('open');
      el.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 320);
  }
  function openItem(it, act){
    const d = it.data || {};
    switch(it.type){
      case 'surah':
        if(act === 'listen'){
          navigateTo('listen');
          if(window.ListenModule) ListenModule.playSurah(d.n);
        } else {
          navigateTo('quran');
          if(window.QuranModule) QuranModule.openSurah(d.n);
        }
        break;
      case 'ayah':
        navigateTo('quran');
        if(window.QuranModule) QuranModule.openPage(d.page || 1);
        break;
      case 'dhikr':
        navigateTo('azkar');
        if(window.AzkarModule) AzkarModule.selectCategory(d.cat);
        scrollToEl(`.zikr-card[data-i="${d.i}"]`);
        break;
      case 'dua':
        navigateTo('duas');
        scrollToEl(`#duasList .prophet-card[data-cat="${d.ci}"][data-i="${d.ii}"]`, true);
        break;
      case 'hadith':
        navigateTo('hadith');
        if(window.HadithPage) HadithPage.show(d.idx);
        break;
      case 'prophet':
        navigateTo('prophets');
        scrollToEl(`#prophetsList .prophet-card[data-i="${d.i}"]`, true);
        break;
      case 'seerah':
        navigateTo('seerah');
        if(window.SeerahModule) SeerahModule.show(d.era, d.i);
        break;
      case 'fatwa':
      case 'mosque':
        if(d.url) window.open(d.url, '_blank', 'noopener');
        break;
    }
  }

  /* ---------------- favorites page ---------------- */
  function cardHTML(it){
    const T = TYPES[it.type] || TYPES.hadith;
    const isQuran = it.type === 'ayah';
    let actions = '';
    if(it.type === 'surah'){
      actions = `<button class="fav-act" data-act="read" data-id="${esc(it.id)}">${svg('surah')} قراءة</button>
                 <button class="fav-act" data-act="listen" data-id="${esc(it.id)}"><svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg> استماع</button>`;
    } else if(it.type === 'fatwa'){
      actions = `<button class="fav-act" data-act="open" data-id="${esc(it.id)}">فتح الرابط</button>`;
    } else if(it.type === 'mosque'){
      actions = `<button class="fav-act" data-act="open" data-id="${esc(it.id)}">الطريق</button>`;
    } else {
      actions = `<button class="fav-act" data-act="open" data-id="${esc(it.id)}">فتح</button>`;
    }
    return `
      <article class="fav-card" data-type="${esc(it.type)}">
        <div class="fav-card-top">
          <span class="fav-type">${svg(it.type)} ${T.one}</span>
          ${btn(it)}
        </div>
        <b class="fav-title">${esc(it.title)}</b>
        ${it.text ? `<p class="fav-text ${isQuran ? 'is-quran' : ''}">${esc(it.text)}</p>` : ''}
        ${it.sub ? `<span class="fav-sub">${esc(it.sub)}</span>` : ''}
        <div class="fav-actions">${actions}</div>
      </article>`;
  }

  function render(){
    const listEl = document.getElementById('favoritesList');
    const filtersEl = document.getElementById('favoritesFilters');
    const countEl = document.getElementById('favoritesCount');
    if(!listEl) return;

    countEl.textContent = items.length ? `${items.length} عنصر محفوظ` : 'ما أضفته من سور وأذكار وأدعية يظهر هنا';

    const present = Object.keys(TYPES).filter(t => items.some(i => i.type === t));
    if(filter !== 'all' && !present.includes(filter)) filter = 'all';

    filtersEl.style.display = present.length > 1 ? '' : 'none';
    filtersEl.innerHTML = ['all', ...present].map(t => {
      const n = t === 'all' ? items.length : items.filter(i => i.type === t).length;
      return `<button class="reciter-chip ${t === filter ? 'active' : ''}" data-t="${t}">${t === 'all' ? 'الكل' : TYPES[t].label} · ${n}</button>`;
    }).join('');

    if(!items.length){
      listEl.innerHTML = `
        <div class="fav-empty">
          <div class="fav-empty-ic">${svg('heart')}</div>
          <b>مفيش حاجة في المفضلة لسه</b>
          <p>اضغط على القلب ♡ في أي سورة أو ذكر أو دعاء أو حديث عشان يتحفظ هنا وترجعله في أي وقت.</p>
        </div>`;
      return;
    }
    const shown = items.filter(i => filter === 'all' || i.type === filter);
    listEl.innerHTML = shown.map(cardHTML).join('');
  }

  function init(){
    updateBadge();
    const filtersEl = document.getElementById('favoritesFilters');
    const listEl = document.getElementById('favoritesList');
    if(filtersEl){
      filtersEl.addEventListener('click', (e)=>{
        const chip = e.target.closest('.reciter-chip');
        if(!chip) return;
        filter = chip.dataset.t;
        render();
      });
    }
    if(listEl){
      listEl.addEventListener('click', (e)=>{
        const act = e.target.closest('.fav-act');
        if(!act) return;
        const it = items.find(i => i.id === act.dataset.id);
        if(it) openItem(it, act.dataset.act);
      });
    }
  }
  function onEnter(){ render(); }

  return { btn, toggle, add, remove, has, count, onChange, surahItem, init, onEnter, esc };
})();
window.Favorites = Favorites;
