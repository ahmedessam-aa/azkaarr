'use strict';

const PrayerModule = (()=>{
  const PRAYER_ORDER = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  const PRAYER_LABELS = { Fajr:'الفجر', Sunrise:'الشروق', Dhuhr:'الظهر', Asr:'العصر', Maghrib:'المغرب', Isha:'العشاء' };
  const PRAYER_ICONS = {
    Fajr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M4.9 8.9l-2.8-2.8M2 16h2M20 16h2M19.1 8.9l2.8-2.8M12 20a6 6 0 100-12 6 6 0 000 12z"/></svg>`,
    Sunrise: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M3 22h18M8 18a4 4 0 118 0"/></svg>`,
    Dhuhr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`,
    Asr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="4.5"/><path d="M12 2v2M4.9 6.9l1.4 1.4M19.1 6.9l-1.4 1.4M2 14h2M20 14h2"/></svg>`,
    Maghrib: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 00-10 0M3 22h18M3 15h18M8 11l4-6 4 6"/></svg>`,
    Isha: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12.5A8.5 8.5 0 1111.5 4a7 7 0 008.5 8.5z"/></svg>`,
  };

  let timings = null;   // {Fajr:'HH:mm', ...}
  let hijri = null;
  let coords = null;
  let countdownTimer = null;

  function toMinutes(hhmm){
    const [h,m] = hhmm.split(':').map(Number);
    return h*60+m;
  }

  function fmtCoordLabel(lat, lon){
    return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
  }

  async function reverseGeocodeLabel(lat, lon){
    try{
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=ar`);
      if(!res.ok) throw new Error('geocode failed');
      const data = await res.json();
      const a = data.address || {};
      const city = a.city || a.town || a.village || a.county || a.state;
      return city ? `${city}` : fmtCoordLabel(lat, lon);
    }catch(e){
      return fmtCoordLabel(lat, lon);
    }
  }

  async function fetchTimings(lat, lon){
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=5`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('prayer api failed');
    const json = await res.json();
    return json.data;
  }

  function cleanTime(t){
    return t.split(' ')[0]; // strip timezone suffix if present
  }

  function render(){
    if(!timings) return;

    // mini times + full list
    const mini = document.getElementById('miniTimes');
    const list = document.getElementById('prayerList');
    let listHtml = '';
    PRAYER_ORDER.forEach(key=>{
      const t = cleanTime(timings[key]);
      const miniEl = mini.querySelector(`[data-p="${key}"] b`);
      if(miniEl) miniEl.textContent = t;
      listHtml += `
        <div class="prayer-row" data-p="${key}">
          <div class="p-name">
            <span class="ic">${PRAYER_ICONS[key]}</span>
            <b>${PRAYER_LABELS[key]}</b>
          </div>
          <div class="p-time">${t}</div>
        </div>`;
    });
    list.innerHTML = listHtml;

    updateNextPrayer();
  }

  function getNextPrayer(){
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
    const order = ['Fajr','Dhuhr','Asr','Maghrib','Isha']; // Sunrise excluded from "next prayer" countdown
    for(const key of order){
      if(toMinutes(cleanTime(timings[key])) > nowMin){
        return { key, mins: toMinutes(cleanTime(timings[key])) };
      }
    }
    // after Isha -> tomorrow's Fajr
    return { key:'Fajr', mins: toMinutes(cleanTime(timings.Fajr)) + 1440, tomorrow:true };
  }

  function updateNextPrayer(){
    if(!timings) return;
    const next = getNextPrayer();
    document.getElementById('nextPrayerName').textContent = PRAYER_LABELS[next.key];
    document.getElementById('nextPrayerTime').textContent = cleanTime(timings[next.key]);

    document.querySelectorAll('.mt').forEach(el=>{
      el.classList.toggle('active', el.dataset.p === next.key && !next.tomorrow);
    });
    document.querySelectorAll('.prayer-row').forEach(el=>{
      el.classList.toggle('active-row', el.dataset.p === next.key && !next.tomorrow);
    });

    tickCountdown();
  }

  function tickCountdown(){
    clearInterval(countdownTimer);
    countdownTimer = setInterval(()=>{
      if(!timings) return;
      const next = getNextPrayer();
      const now = new Date();
      const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
      let targetSec = next.mins*60;
      let diff = targetSec - nowSec;
      if(diff <= 0){
        // moved into next prayer window — refresh
        updateNextPrayer();
        return;
      }
      const h = Math.floor(diff/3600);
      const m = Math.floor((diff%3600)/60);
      const s = diff%60;
      document.getElementById('cdH').textContent = String(h).padStart(2,'0');
      document.getElementById('cdM').textContent = String(m).padStart(2,'0');
      document.getElementById('cdS').textContent = String(s).padStart(2,'0');
    }, 1000);
  }

  async function loadForCoords(lat, lon, label){
    coords = {lat, lon};
    localStorage.setItem('azkar_coords', JSON.stringify({lat,lon}));
    try{
      const data = await fetchTimings(lat, lon);
      timings = data.timings;
      hijri = data.date.hijri;
      setHijriDate(hijri);
      render();
      NotificationsModule.refreshSchedules();
    }catch(e){
      showToast('تعذّر تحميل مواقيت الصلاة، تحقق من الاتصال بالإنترنت');
      document.getElementById('prayerList').innerHTML = `<div class="state-msg">تعذّر تحميل المواقيت. حاول مرة أخرى لاحقًا.</div>`;
    }

    if(label){
      document.getElementById('locLabel').textContent = label;
      document.getElementById('prayerLocLabel').textContent = label;
    } else {
      const guess = fmtCoordLabel(lat, lon);
      document.getElementById('locLabel').textContent = guess;
      document.getElementById('prayerLocLabel').textContent = guess;
      const resolved = await reverseGeocodeLabel(lat, lon);
      document.getElementById('locLabel').textContent = resolved;
      document.getElementById('prayerLocLabel').textContent = resolved;
      localStorage.setItem('azkar_loc_label', resolved);
    }
  }

  function detectLocation(){
    if(!('geolocation' in navigator)){
      showToast('المتصفح لا يدعم تحديد الموقع');
      useFallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos)=> loadForCoords(pos.coords.latitude, pos.coords.longitude),
      (err)=>{
        showToast('لم يتم السماح بالوصول للموقع — سيتم استخدام آخر موقع محفوظ إن وجد');
        useFallback();
      },
      { enableHighAccuracy:false, timeout:8000, maximumAge:600000 }
    );
  }

  function useFallback(){
    const saved = localStorage.getItem('azkar_coords');
    const savedLabel = localStorage.getItem('azkar_loc_label');
    if(saved){
      const {lat,lon} = JSON.parse(saved);
      loadForCoords(lat, lon, savedLabel);
    } else {
      // default: Cairo, Egypt
      loadForCoords(30.0444, 31.2357, 'القاهرة، مصر (افتراضي)');
    }
  }

  function init(){
    document.getElementById('refreshLocBtn').addEventListener('click', detectLocation);
    detectLocation();
  }

  function getTimings(){ return timings; }
  function getCoords(){ return coords; }

  return { init, getTimings, getCoords, PRAYER_ORDER, PRAYER_LABELS };
})();
window.PrayerModule = PrayerModule;
