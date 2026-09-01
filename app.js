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
  }
  function next(){ idx = (idx+1) % HADITH_DATA.length; render(); }
  function prev(){ idx = (idx-1+HADITH_DATA.length) % HADITH_DATA.length; render(); }
  function random(){ idx = Math.floor(Math.random()*HADITH_DATA.length); render(); }
  function onEnter(){ render(); }

  document.getElementById('hadithNextBtn').addEventListener('click', next);
  document.getElementById('hadithPrevBtn').addEventListener('click', prev);
  document.getElementById('hadithRandomBtn').addEventListener('click', random);

  return { onEnter };
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
   Settings sheet
   ========================================================= */
function initSettingsSheet(){
  const sheet = document.getElementById('settingsSheet');
  const overlay = document.getElementById('sheetOverlay');
  const open = ()=>{ sheet.classList.add('open'); overlay.classList.add('open'); };
  const close = ()=>{ sheet.classList.remove('open'); overlay.classList.remove('open'); };

  document.getElementById('settingsBtn').addEventListener('click', open);
  document.getElementById('notifBtn').addEventListener('click', open);
  overlay.addEventListener('click', close);

  // toggles persistence
  const toggles = {
    togglerPrayerNotif: 'notif_prayer',
    toggleAzkarNotif: 'notif_azkar',
    toggleHadithNotif: 'notif_hadith',
    toggleSalawatNotif: 'notif_salawat',
    toggleVibrate: 'tasbih_vibrate',
  };
  Object.entries(toggles).forEach(([elId, key])=>{
    const el = document.getElementById(elId);
    const saved = localStorage.getItem(key);
    el.checked = saved === null ? (key==='tasbih_vibrate') : saved === '1';
    el.addEventListener('change', async ()=>{
      if(el.checked && key !== 'tasbih_vibrate'){
        const granted = await NotificationsModule.requestPermission();
        if(!granted){
          showToast('لن تظهر إشعارات النظام، لكن التنبيه والصوت داخل التطبيق هيفضلوا شغالين طول ما التطبيق مفتوح');
        }
      }
      localStorage.setItem(key, el.checked ? '1' : '0');
      NotificationsModule.refreshSchedules();
      if(key === 'tasbih_vibrate' && window.TasbihModule) TasbihModule.setVibrate(el.checked);
    });
  });
}

/* =========================================================
   PWA install
   ========================================================= */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installHint').textContent = 'ثبّت التطبيق على شاشتك الرئيسية ليعمل مثل أي تطبيق آخر — بدون متجر تطبيقات';
});

document.getElementById('installBtn').addEventListener('click', async ()=>{
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if(choice.outcome === 'accepted') showToast('جارِ تثبيت التطبيق…');
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if(isIOS){
      showToast('لإضافة التطبيق: اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية"');
    } else {
      showToast('التطبيق مثبّت بالفعل، أو افتح قائمة المتصفح واختر "تثبيت التطبيق"');
    }
  }
});

window.addEventListener('appinstalled', ()=>{
  showToast('تم تثبيت تطبيق أذكار بنجاح 🎉');
});

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
    refEl.textContent = `سورة ${d.surah.name} — آية ${d.numberInSurah}`;
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
  initThemeToggle();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }

  PrayerModule.init();
  TasbihModule.init();
  AzkarModule.init();
  NotificationsModule.init();
  TafsirModule.init();

  const startPage = location.hash.replace('#','') || 'home';
  navigateTo(startPage);
});
