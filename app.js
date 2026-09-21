'use strict';

/* =========================================================
   Navigation config
   ========================================================= */
const NAV_ITEMS = [
  { id: 'home',   label: 'الرئيسية', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>` },
  { id: 'quran',  label: 'القرآن',   icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5c-1.6-1.3-4-2-6.5-1.7v13c2.5-.3 4.9.4 6.5 1.7 1.6-1.3 4-2 6.5-1.7v-13c-2.5-.3-4.9.4-6.5 1.7z"/><line x1="12" y1="6.5" x2="12" y2="19.5"/></svg>` },
  { id: 'listen', label: 'الاستماع', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
  { id: 'prayer', label: 'الصلاة',   icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 3.2"/></svg>` },
  { id: 'tasbih', label: 'السبحة',   icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="8" r="1.7"/><circle cx="4.5" cy="16" r="1.7"/><circle cx="19.5" cy="8" r="1.7"/><circle cx="19.5" cy="16" r="1.7"/><circle cx="12" cy="3.2" r="1.7"/></svg>` },
  { id: 'azkar',  label: 'الأذكار',  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c-2-1-4-3.5-4-7 0-5 5-7 5-11 3 1 6 4 6 8 0 1.5-.5 2.5-1 3.5 1.6-.4 3-1.5 4-3 1 1.5 1.5 3 1.5 4.5 0 3.5-2.5 6-6 7"/></svg>` },
];

function renderNav(){
  const mk = (containerClass) => NAV_ITEMS.map(it => `
    <button class="nav-btn ${containerClass}" data-nav="${it.id}">
      <span class="ic-wrap">${it.icon}</span>
      <span>${it.label}</span>
    </button>`).join('');
  document.getElementById('bottomNav').innerHTML = mk('bottom');
  document.getElementById('desktopNav').innerHTML = mk('desktop');
  updateNavActive('home');
}

function updateNavActive(pageId){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.nav === pageId);
  });
  // highlight the current page inside the side menu too
  document.querySelectorAll('.more-item[data-nav]').forEach(item=>{
    item.classList.toggle('active', item.dataset.nav === pageId);
  });
}

/* =========================================================
   Router
   ========================================================= */
function navigateTo(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if(target) target.classList.add('active');
  updateNavActive(pageId);
  window.scrollTo({top:0, behavior:'smooth'});
  location.hash = pageId;

  if(pageId === 'quran' && window.QuranModule) QuranModule.onEnter();
  if(pageId === 'listen' && window.ListenModule) ListenModule.onEnter();
  if(pageId === 'hadith' && window.HadithPage) HadithPage.onEnter();
  if(pageId === 'prophets' && window.ProphetsModule) ProphetsModule.onEnter();
  if(pageId === 'seerah' && window.SeerahModule) SeerahModule.onEnter();
  if(pageId === 'fatwa' && window.FatwaModule) FatwaModule.onEnter();
  if(pageId === 'hifz' && window.HifzModule) HifzModule.onEnter();
  if(pageId === 'khatm' && window.KhatmModule) KhatmModule.onEnter();
  if(pageId === 'qibla' && window.QiblaModule) QiblaModule.onEnter();
  if(pageId === 'mosques' && window.MosquesModule) MosquesModule.onEnter();
  if(pageId === 'duas' && window.DuasModule) DuasModule.onEnter();
  if(pageId === 'favorites' && window.Favorites) Favorites.onEnter();
  if(pageId === 'prayer' && window.PrayerTrackerModule) PrayerTrackerModule.init();
}

document.addEventListener('click', (e)=>{
  const navEl = e.target.closest('[data-nav]');
  if(navEl){
    e.preventDefault();
    navigateTo(navEl.dataset.nav);
    return;
  }
  const hifzEl = e.target.closest('[data-hifz-mode]');
  if(hifzEl && window.HifzModule){
    e.preventDefault();
    HifzModule.openWithMode(hifzEl.dataset.hifzMode);
    return;
  }
  const catEl = e.target.closest('[data-nav-cat]');
  if(catEl){
    e.preventDefault();
    navigateTo(catEl.dataset.navCat);
    if(catEl.dataset.navCat === 'azkar' && catEl.dataset.cat && window.AzkarModule){
      AzkarModule.selectCategory(catEl.dataset.cat);
    }
  }
});

window.addEventListener('hashchange', ()=>{
  const id = location.hash.replace('#','') || 'home';
  navigateTo(id);
});

/* =========================================================
   Dates (Gregorian + Hijri)
   ========================================================= */
const AR_WEEKDAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function renderGregorianDate(){
  const d = new Date();
  const str = `${AR_WEEKDAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  document.getElementById('gregDate').textContent = str;
}

function setHijriDate(hijriObj){
  if(!hijriObj) return;
  const txt = `${hijriObj.day} ${hijriObj.month.ar} ${hijriObj.year}هـ`;
  const el = document.getElementById('hijriDate');
  if(el) el.textContent = txt;
  const pd = document.getElementById('prayerDateLabel');
  if(pd) pd.textContent = `${txt} — الموافق ${new Date().toLocaleDateString('ar-EG')}`;
}

/* =========================================================
   Hadith of the day (Home) + Hadith browser page
   ========================================================= */
function dayOfYear(){
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / 86400000);
}

function renderHomeHadith(){
  const idx = dayOfYear() % HADITH_DATA.length;
  const h = HADITH_DATA[idx];
  document.getElementById('homeHadithText').textContent = h.text;
  document.getElementById('homeHadithSrc').textContent = `${h.source} — عن ${h.narrator}`;
}

const HadithPage = (()=>{
  let idx = parseInt(localStorage.getItem('azkar_hadith_idx') || '0', 10);

  function render(){
    const h = HADITH_DATA[idx];
    document.getElementById('hadithPageText').textContent = h.text;
    document.getElementById('hadithPageMeta').textContent = `${h.source} — عن ${h.narrator}`;
    document.getElementById('hadithCounter').textContent = `حديث ${idx+1} من ${HADITH_DATA.length}`;
    localStorage.setItem('azkar_hadith_idx', String(idx));
    const slot = document.getElementById('hadithFavSlot');
    if(slot){
      slot.innerHTML = Favorites.btn({
        id: `hadith:${idx}`, type: 'hadith', title: 'حديث شريف', text: h.text,
        sub: `${h.source} — عن ${h.narrator}`, data: { idx },
      });
    }
  }
  function next(){ idx = (idx+1) % HADITH_DATA.length; render(); }
  function prev(){ idx = (idx-1+HADITH_DATA.length) % HADITH_DATA.length; render(); }
  function random(){ idx = Math.floor(Math.random()*HADITH_DATA.length); render(); }
  function onEnter(){ render(); }
  function show(i){ if(typeof i === 'number' && HADITH_DATA[i]){ idx = i; } render(); }

  document.getElementById('hadithNextBtn').addEventListener('click', next);
  document.getElementById('hadithPrevBtn').addEventListener('click', prev);
  document.getElementById('hadithRandomBtn').addEventListener('click', random);

  return { onEnter, show };
})();
window.HadithPage = HadithPage;

/* =========================================================
   Home quick azkar chips
   ========================================================= */
function renderHomeAzkarChips(){
  const cats = [
    {key:'morning', label:'أذكار الصباح', emoji:'☀️'},
    {key:'evening', label:'أذكار المساء', emoji:'🌙'},
    {key:'sleep', label:'أذكار النوم', emoji:'⭐'},
    {key:'afterPrayer', label:'بعد الصلاة', emoji:'🤲'},
  ];
  const wrap = document.getElementById('homeAzkarChips');
  if(!wrap) return;
  wrap.innerHTML = cats.map(c => {
    const data = AZKAR_DATA[c.key];
    return `<button class="azkar-chip" data-cat="${c.key}">${c.emoji} ${data.title} <span class="count">${data.items.length}</span></button>`;
  }).join('');
  wrap.querySelectorAll('.azkar-chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      navigateTo('azkar');
      if(window.AzkarModule) AzkarModule.selectCategory(btn.dataset.cat);
    });
  });
}

/* =========================================================
   Toast
   ========================================================= */
let toastTimer = null;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2400);
}
window.showToast = showToast;

/* =========================================================
   Theme toggle (light / dark)
   ========================================================= */
const SUN_ICON = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON_ICON = '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';

function currentTheme(){
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyThemeIcon(){
  const icon = document.getElementById('themeIcon');
  if(!icon) return;
  // icon shown = the mode a tap will switch TO
  icon.innerHTML = currentTheme() === 'light' ? MOON_ICON : SUN_ICON;
}

function updateThemeColorMeta(){
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', currentTheme() === 'light' ? '#0b6e4f' : '#062a1f');
}

function toggleTheme(){
  const next = currentTheme() === 'light' ? 'dark' : 'light';
  if(next === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('azkar_theme', next);
  applyThemeIcon();
  updateThemeColorMeta();
}

function initThemeToggle(){
  applyThemeIcon();
  updateThemeColorMeta();
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
}

/* =========================================================
   More sheet (كل الأقسام)
   ========================================================= */
function initMoreSheet(){
  const sheet = document.getElementById('moreSheet');
  const overlay = document.getElementById('moreSheetOverlay');
  const toggles = Array.from(sheet.querySelectorAll('[data-toggle]'));

  // expand / collapse one group of the menu (only one group is open at a time)
  const setExpanded = (btn, expanded)=>{
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const sub = document.getElementById(btn.getAttribute('aria-controls'));
    if(sub) sub.classList.toggle('open', expanded);
  };
  toggles.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const willOpen = btn.getAttribute('aria-expanded') !== 'true';
      toggles.forEach(o => setExpanded(o, false));
      setExpanded(btn, willOpen);
    });
  });

  // when the menu opens, start collapsed — except the group that holds the page you're on
  const syncExpanded = ()=>{
    toggles.forEach(o => setExpanded(o, false));
    const active = sheet.querySelector('.more-sub .more-item.active');
    if(active){
      const parent = active.closest('.more-parent');
      const btn = parent && parent.querySelector('[data-toggle]');
      if(btn) setExpanded(btn, true);
    }
  };

  const open = ()=>{ syncExpanded(); sheet.classList.add('open'); overlay.classList.add('open'); };
  const close = ()=>{ sheet.classList.remove('open'); overlay.classList.remove('open'); };

  document.getElementById('moreMenuBtn').addEventListener('click', open);
  document.getElementById('moreDrawerCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', close);
  sheet.querySelectorAll('.more-item:not([data-toggle])').forEach(item=>{
    item.addEventListener('click', close);
  });
  // "الإعدادات" داخل القائمة تفتح شاشة الإعدادات (بنفس زر الترس في الشريط العلوي)
  const settingsItem = document.getElementById('moreSettingsItem');
  if(settingsItem){
    settingsItem.addEventListener('click', ()=>{
      setTimeout(()=> document.getElementById('settingsBtn').click(), 180);
    });
  }
  // "الإشعارات" داخل القائمة تفتح شاشة الإشعارات الخاصة بيها (مُعرّفة في initNotifSheet)
  const notifItem = document.getElementById('moreNotifItem');
  if(notifItem){
    notifItem.addEventListener('click', ()=>{
      setTimeout(()=> window.openNotifSheet && window.openNotifSheet(), 180);
    });
  }
}

/* =========================================================
   Header search (Quran surahs)
   ========================================================= */
function initHeaderSearch(){
  const overlay = document.getElementById('searchSheetOverlay');
  const sheet = document.getElementById('searchSheet');
  const input = document.getElementById('headerSearchInput');
  const results = document.getElementById('headerSearchResults');

  const open = async ()=>{
    sheet.classList.add('open');
    overlay.classList.add('open');
    input.value = '';
    results.innerHTML = '';
    setTimeout(()=> input.focus(), 200);
  };
  const close = ()=>{
    sheet.classList.remove('open');
    overlay.classList.remove('open');
  };

  document.getElementById('headerSearchBtn').addEventListener('click', open);
  overlay.addEventListener('click', close);

  input.addEventListener('input', async ()=>{
    const q = input.value.trim().toLowerCase();
    if(!q){ results.innerHTML = ''; return; }
    const surahs = await QuranModule.getSurahs();
    const matches = surahs.filter(s =>
      s.name.includes(input.value.trim()) ||
      s.englishName.toLowerCase().includes(q) ||
      String(s.number) === q
    ).slice(0, 12);

    results.innerHTML = matches.length ? matches.map(s => `
      <button class="surah-row" data-n="${s.number}" style="width:100%; margin-bottom:7px;">
        <div class="left">
          <div class="surah-num">${s.number}</div>
          <div class="surah-names"><b>${s.englishName}</b><span>${s.numberOfAyahs} آية</span></div>
        </div>
        <div class="ar-name">${s.name}</div>
      </button>
    `).join('') : `<div class="state-msg" style="padding:20px 0;">لا توجد نتائج</div>`;

    results.querySelectorAll('.surah-row').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        close();
        QuranModule.openSurah(parseInt(btn.dataset.n, 10));
        navigateTo('quran');
      });
    });
  });
}

/* =========================================================
   Settings sheet (عامة: اهتزاز السبحة + تثبيت التطبيق)
   ========================================================= */
function initSettingsSheet(){
  const sheet = document.getElementById('settingsSheet');
  const overlay = document.getElementById('sheetOverlay');
  const open = ()=>{ sheet.classList.add('open'); overlay.classList.add('open'); };
  const close = ()=>{ sheet.classList.remove('open'); overlay.classList.remove('open'); };

  document.getElementById('settingsBtn').addEventListener('click', open);

  initHeaderSearch();
  overlay.addEventListener('click', close);

  const el = document.getElementById('toggleVibrate');
  const key = 'tasbih_vibrate';
  const saved = localStorage.getItem(key);
  el.checked = saved === null ? true : saved === '1';
  el.addEventListener('change', ()=>{
    localStorage.setItem(key, el.checked ? '1' : '0');
    if(window.TasbihModule) TasbihModule.setVibrate(el.checked);
  });
}

/* =========================================================
   Notifications sheet (تنبيهات ثابتة + تذكيرات مخصّصة بالوقت)
   ========================================================= */
function initNotifSheet(){
  const sheet = document.getElementById('notifSheet');
  const overlay = document.getElementById('notifSheetOverlay');
  const open = ()=>{ renderCustomReminders(); sheet.classList.add('open'); overlay.classList.add('open'); };
  const close = ()=>{ sheet.classList.remove('open'); overlay.classList.remove('open'); };
  window.openNotifSheet = open;

  overlay.addEventListener('click', close);

  // toggles persistence
  const toggles = {
    togglerPrayerNotif: 'notif_prayer',
    toggleAzkarNotif: 'notif_azkar',
    toggleHadithNotif: 'notif_hadith',
    toggleSalawatNotif: 'notif_salawat',
  };
  Object.entries(toggles).forEach(([elId, key])=>{
    const el = document.getElementById(elId);
    const saved = localStorage.getItem(key);
    el.checked = saved === '1';
    el.addEventListener('change', async ()=>{
      if(el.checked){
        const granted = await NotificationsModule.requestPermission();
        if(!granted){
          showToast('لن تظهر إشعارات النظام، لكن التنبيه والصوت داخل التطبيق هيفضلوا شغالين طول ما التطبيق مفتوح');
        }
      }
      localStorage.setItem(key, el.checked ? '1' : '0');
      NotificationsModule.refreshSchedules();
    });
  });

  // custom time-based reminders
  const textInput = document.getElementById('customReminderText');
  const timeInput = document.getElementById('customReminderTime');
  document.getElementById('addCustomReminderBtn').addEventListener('click', async ()=>{
    const text = textInput.value.trim();
    if(!text){ showToast('اكتب نص التذكير الأول'); return; }
    if(!timeInput.value){ showToast('اختر الوقت'); return; }
    const granted = await NotificationsModule.requestPermission();
    if(!granted){
      showToast('لن تظهر إشعارات النظام، لكن التنبيه داخل التطبيق هيفضل شغال طول ما التطبيق مفتوح');
    }
    NotificationsModule.addCustomReminder(text, timeInput.value);
    textInput.value = '';
    renderCustomReminders();
  });
}

function renderCustomReminders(){
  const list = document.getElementById('customReminderList');
  if(!list) return;
  const reminders = NotificationsModule.getCustomReminders();
  if(!reminders.length){
    list.innerHTML = `<div class="custom-reminder-empty">لسه مفيش تذكيرات مضافة</div>`;
    return;
  }
  list.innerHTML = reminders.map(r => `
    <div class="custom-reminder-row" data-id="${r.id}">
      <div class="txt"><b>${r.text}</b><span>${r.time}</span></div>
      <div class="actions">
        <label class="switch">
          <input type="checkbox" class="custom-reminder-toggle" ${r.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <button class="del-btn" aria-label="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
        </button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.custom-reminder-row').forEach(row=>{
    const id = row.dataset.id;
    row.querySelector('.custom-reminder-toggle').addEventListener('change', ()=>{
      NotificationsModule.toggleCustomReminder(id);
    });
    row.querySelector('.del-btn').addEventListener('click', ()=>{
      NotificationsModule.removeCustomReminder(id);
      renderCustomReminders();
    });
  });
}

/* =========================================================
   Launch splash — random ayah + salawat, shown first on every open
   ========================================================= */
async function initLaunchSplash(){
  const overlay = document.getElementById('launchOverlay');
  const textEl = document.getElementById('launchAyahText');
  const refEl = document.getElementById('launchAyahRef');

  const FALLBACK_AYAHS = [
    { text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', ref: 'سورة طه — آية ١١٤' },
    { text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', ref: 'سورة الشرح — آية ٦' },
    { text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', ref: 'سورة الطلاق — آية ٢' },
  ];

  try{
    const randomGlobalNum = Math.floor(Math.random()*6236) + 1;
    const res = await fetch(`https://api.alquran.cloud/v1/ayah/${randomGlobalNum}/quran-uthmani`);
    const json = await res.json();
    const d = json.data;
    textEl.textContent = d.text;
    refEl.textContent = `${surahLabel(d.surah.name)} — آية ${d.numberInSurah}`;
  }catch(e){
    const pick = FALLBACK_AYAHS[Math.floor(Math.random()*FALLBACK_AYAHS.length)];
    textEl.textContent = pick.text;
    refEl.textContent = pick.ref;
  }

  document.getElementById('launchContinueBtn').addEventListener('click', ()=>{
    overlay.classList.add('hidden');
    setTimeout(()=> overlay.remove(), 450);
  });
}

/* =========================================================
   Init
   ========================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  initLaunchSplash();

  renderNav();
  renderGregorianDate();
  renderHomeHadith();
  renderHomeAzkarChips();
  initSettingsSheet();
  initNotifSheet();
  initMoreSheet();
  initThemeToggle();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }

  Favorites.init();
  PrayerModule.init();
  TasbihModule.init();
  AzkarModule.init();
  NotificationsModule.init();
  TafsirModule.init();

  const startPage = location.hash.replace('#','') || 'home';
  navigateTo(startPage);
});
