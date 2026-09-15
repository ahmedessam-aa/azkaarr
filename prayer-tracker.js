'use strict';

const PrayerTrackerModule = (()=>{
  const PRAYERS = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const LABELS = { Fajr:'الفجر', Dhuhr:'الظهر', Asr:'العصر', Maghrib:'المغرب', Isha:'العشاء' };
  const START_KEY = 'azkar_prayer_track_start';

  function dateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function todayKey(){ return dateKey(new Date()); }

  function getLog(key){
    const raw = localStorage.getItem('azkar_prayer_log_' + key);
    return raw ? JSON.parse(raw) : {};
  }
  function saveLog(key, log){
    localStorage.setItem('azkar_prayer_log_' + key, JSON.stringify(log));
  }

  function ensureTrackStart(){
    if(!localStorage.getItem(START_KEY)){
      localStorage.setItem(START_KEY, todayKey());
    }
  }
  function daysSinceTrackStart(){
    const start = localStorage.getItem(START_KEY);
    if(!start) return 1;
    const a = new Date(start + 'T00:00:00');
    const b = new Date(todayKey() + 'T00:00:00');
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  function toggle(prayerKey){
    ensureTrackStart();
    const key = todayKey();
    const log = getLog(key);
    log[prayerKey] = !log[prayerKey];
    saveLog(key, log);
    renderChecklist();
    renderStats();
  }

  function computeStats(windowDays){
    const cappedDays = Math.min(windowDays, daysSinceTrackStart());
    let total = 0, done = 0;
    const now = new Date();
    for(let i=0;i<cappedDays;i++){
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const log = getLog(dateKey(d));
      PRAYERS.forEach(p=>{
        total++;
        if(log[p]) done++;
      });
    }
    return total ? Math.round((done/total)*100) : 0;
  }

  function renderChecklist(){
    const wrap = document.getElementById('prayerChecklist');
    if(!wrap) return;
    const log = getLog(todayKey());
    wrap.innerHTML = PRAYERS.map(p => `
      <button class="prayer-check-item ${log[p] ? 'done' : ''}" data-p="${p}">
        <span class="prayer-check-icon">${log[p] ? '✅' : '⭕'}</span>
        <span>${LABELS[p]}</span>
      </button>
    `).join('');
    wrap.querySelectorAll('.prayer-check-item').forEach(btn=>{
      btn.addEventListener('click', ()=> toggle(btn.dataset.p));
    });
  }

  function renderStats(){
    const dayPct = computeStats(1);
    const weekPct = computeStats(7);
    const monthPct = computeStats(30);
    const yearPct = computeStats(365);

    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = `${val}%`; };
    set('prayerStatDay', dayPct);
    set('prayerStatWeek', weekPct);
    set('prayerStatMonth', monthPct);
    set('prayerStatYear', yearPct);

    const headline = document.getElementById('prayerCommitmentHeadline');
    if(headline) headline.textContent = `التزامك هذا الأسبوع: ${weekPct}%`;
  }

  function init(){
    renderChecklist();
    renderStats();
  }

  return { init };
})();
window.PrayerTrackerModule = PrayerTrackerModule;
