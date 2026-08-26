'use strict';

/*
  ملاحظة هامة:
  الإشعارات والتنبيهات الصوتية هنا مجدولة محليًا داخل المتصفح بينما التطبيق
  مفتوح أو يعمل في الخلفية (بعد تثبيته كـ PWA على المتصفحات الداعمة).
  تشغيل صوت الأذان أو أي صوت تلقائيًا والتطبيق مغلق تمامًا يحتاج خادم Push
  خلفي (Push Server)، وهو خارج نطاق موقع HTML/CSS/JS ثابت بدون Backend.
  هذا الحل هو أفضل بديل ممكن: بانر أعلى الشاشة + صوت أذان فعلي + إشعار نظام،
  يعمل طالما التطبيق مفتوح أو في الخلفية القريبة.
*/

const ADHAN_AUDIO_URL = 'https://cdn.aladhan.com/audio/adhans/a9.mp3'; // مشاري العفاسي

const NotificationsModule = (()=>{
  let checkInterval = null;
  const firedToday = new Set();
  let firedDate = '';
  let adhanAudioEl = null;

  /* ---------------- permission ---------------- */
  async function requestPermission(){
    if(!('Notification' in window)){
      showToast('المتصفح لا يدعم الإشعارات');
      return false;
    }
    if(Notification.permission === 'granted') return true;
    if(Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  /* ---------------- OS-level notification ---------------- */
  async function fireNotification(title, body, tag){
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    try{
      if('serviceWorker' in navigator){
        const reg = await navigator.serviceWorker.getRegistration();
        if(reg){
          reg.showNotification(title, { body, icon:'icons/icon-192.png', badge:'icons/icon-192.png', tag, dir:'rtl', lang:'ar' });
          return;
        }
      }
      new Notification(title, { body, icon:'icons/icon-192.png', dir:'rtl', lang:'ar' });
    }catch(e){ /* silent */ }
  }

  /* ---------------- in-app adhan banner ---------------- */
  function showAdhanBanner(title, sub){
    const banner = document.getElementById('adhanBanner');
    document.getElementById('adhanBannerTitle').textContent = title;
    document.getElementById('adhanBannerSub').textContent = sub;
    banner.classList.add('show');
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(()=> hideAdhanBanner(), 45000);
  }
  function hideAdhanBanner(){
    document.getElementById('adhanBanner').classList.remove('show');
    stopAdhanAudio();
  }
  function playAdhanAudio(){
    try{
      if(!adhanAudioEl) adhanAudioEl = new Audio(ADHAN_AUDIO_URL);
      adhanAudioEl.currentTime = 0;
      adhanAudioEl.play().catch(()=>{ /* autoplay might be blocked until user interacts once */ });
    }catch(e){ /* silent */ }
  }
  function stopAdhanAudio(){
    if(adhanAudioEl){ adhanAudioEl.pause(); adhanAudioEl.currentTime = 0; }
  }

  function initBannerButtons(){
    document.getElementById('adhanCloseBtn').addEventListener('click', hideAdhanBanner);
    document.getElementById('adhanStopBtn').addEventListener('click', stopAdhanAudio);
  }

  /* ---------------- salawat (blessings on the Prophet) reminder ---------------- */
  function playChime(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [660, 880, 990];
      notes.forEach((freq, i)=>{
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1);
      });
    }catch(e){ /* silent */ }
  }

  function trySpeakSalawat(){
    if(!('speechSynthesis' in window)) return false;
    try{
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ar'));
      if(!arVoice) return false;
      const utter = new SpeechSynthesisUtterance('اللهم صل وسلم على نبينا محمد');
      utter.voice = arVoice;
      utter.lang = arVoice.lang;
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
      return true;
    }catch(e){ return false; }
  }

  function triggerSalawatReminder(){
    playChime();
    const spoke = trySpeakSalawat();
    showToast('🌿 اللهم صلِّ وسلِّم على نبينا محمد ﷺ');
    fireNotification('تذكير', 'اللهم صلِّ وسلِّم على نبينا محمد ﷺ', 'salawat');
    if(!spoke){ /* chime + banner text is the fallback, already shown */ }
  }

  /* ---------------- prayer / azkar / hadith schedule ---------------- */
  function todayStr(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }
  function nowHHMM(){
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function buildSchedule(){
    const schedule = [];
    const prayerOn = localStorage.getItem('notif_prayer') === '1';
    const azkarOn = localStorage.getItem('notif_azkar') === '1';
    const hadithOn = localStorage.getItem('notif_hadith') === '1';

    if(prayerOn && window.PrayerModule && PrayerModule.getTimings()){
      const t = PrayerModule.getTimings();
      const labels = PrayerModule.PRAYER_LABELS;
      ['Fajr','Dhuhr','Asr','Maghrib','Isha'].forEach(key=>{
        const time = t[key].split(' ')[0];
        schedule.push({ time, type:'prayer', prayerKey:key, title:`حان الآن وقت صلاة ${labels[key]}`, body:'حي على الصلاة، حي على الفلاح', tag:'prayer-'+key });
      });
    }

    if(azkarOn){
      schedule.push({ time:'06:30', type:'basic', title:'أذكار الصباح', body:'لا تنسَ أذكار الصباح اليوم 🌅', tag:'azkar-morning' });
      schedule.push({ time:'17:30', type:'basic', title:'أذكار المساء', body:'حان وقت أذكار المساء 🌙', tag:'azkar-evening' });
    }

    if(hadithOn){
      const idx = (()=>{
        const now = new Date();
        const start = new Date(now.getFullYear(),0,0);
        return Math.floor((now-start)/86400000) % HADITH_DATA.length;
      })();
      const h = HADITH_DATA[idx];
      schedule.push({ time:'09:00', type:'basic', title:'حديث اليوم', body: h.text.slice(0,80) + '…', tag:'daily-hadith' });
    }

    return schedule;
  }

  function checkTick(){
    if(todayStr() !== firedDate){
      firedDate = todayStr();
      firedToday.clear();
    }
    const now = nowHHMM();

    // scheduled items (prayer / azkar / hadith)
    buildSchedule().forEach(item=>{
      const key = item.tag + '-' + item.time;
      if(item.time === now && !firedToday.has(key)){
        firedToday.add(key);
        fireNotification(item.title, item.body, item.tag);
        if(item.type === 'prayer'){
          showAdhanBanner(item.title, item.body);
          playAdhanAudio();
        } else {
          showToast(item.title);
        }
      }
    });

    // salawat every 30 minutes (:00 and :30)
    const salawatOn = localStorage.getItem('notif_salawat') === '1';
    if(salawatOn){
      const mm = now.slice(3,5);
      if(mm === '00' || mm === '30'){
        const key = 'salawat-' + now;
        if(!firedToday.has(key)){
          firedToday.add(key);
          triggerSalawatReminder();
        }
      }
    }
  }

  function refreshSchedules(){
    clearInterval(checkInterval);
    const anyOn = ['notif_prayer','notif_azkar','notif_hadith','notif_salawat'].some(k => localStorage.getItem(k) === '1');
    if(!anyOn) return;
    checkInterval = setInterval(checkTick, 15000);
    checkTick();
  }

  function init(){
    initBannerButtons();
    if('speechSynthesis' in window){
      // warm up voice list (some browsers populate this asynchronously)
      window.speechSynthesis.getVoices();
    }
  }

  return { requestPermission, refreshSchedules, init };
})();
window.NotificationsModule = NotificationsModule;
