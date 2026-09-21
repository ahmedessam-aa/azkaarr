'use strict';

const ListenModule = (()=>{
  let surahsList = [];
  let loadedOnce = false;
  let currentReciterId = localStorage.getItem('azkar_listen_reciter') || 'alafasy';
  let currentSurahNum = parseInt(localStorage.getItem('azkar_listen_surah') || '1', 10);
  let audioEl = null;
  let isPlaying = false;          // used only to drive UI rendering — never trusted for play/pause decisions
  let lastProgressAt = Date.now();
  let watchdogTimer = null;
  let recoveryAttempts = 0;
  const MAX_RECOVERY_ATTEMPTS = 4;
  let recovering = false;
  let repeatOn = localStorage.getItem('azkar_listen_repeat') === '1';
  const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
  let speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, parseInt(localStorage.getItem('azkar_listen_speed') || '0', 10) || 0));

  const ICON_PLAY  = '<path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/>';
  const ICON_PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1.4"/><rect x="14" y="5" width="4" height="14" rx="1.4"/>';

  function fullReciters(){
    return RECITERS.filter(r => typeof r.surahUrl === 'function');
  }
  function reciterById(id){
    return fullReciters().find(r => r.id === id) || fullReciters()[0];
  }
  function surahMeta(n){
    return surahsList.find(s => s.number === n);
  }

  /* ---------------- core audio element ---------------- */
  function getAudioEl(){
    if(!audioEl){
      audioEl = new Audio();
      audioEl.preload = 'auto';

      audioEl.addEventListener('play', ()=>{ isPlaying = true; syncPlayButtons(); });
      audioEl.addEventListener('playing', ()=>{
        isPlaying = true;
        recoveryAttempts = 0;
        recovering = false;
        lastProgressAt = Date.now();
        syncPlayButtons();
      });
      audioEl.addEventListener('pause', ()=>{ isPlaying = false; syncPlayButtons(); });
      audioEl.addEventListener('ended', ()=>{
        if(recovering) return; // a stall-recovery reload can spuriously fire ended in rare cases — ignore mid-recovery
        if(repeatOn){ audioEl.currentTime = 0; attemptPlay(audioEl, 2); return; }
        playSurah(currentSurahNum + 1 <= 114 ? currentSurahNum + 1 : 1);
      });
      audioEl.addEventListener('timeupdate', ()=>{
        lastProgressAt = Date.now();
        updateProgressUI();
      });
      audioEl.addEventListener('loadedmetadata', updateProgressUI);
      audioEl.addEventListener('error', ()=> handleStreamFailure('error'));
      audioEl.addEventListener('stalled', ()=> { /* let the watchdog decide — 'stalled' alone is often harmless */ });

      startWatchdog();
    }
    return audioEl;
  }

  /* ---------------- stall watchdog ---------------- */
  // Mobile networks / third-party audio servers sometimes just stop delivering bytes
  // with no 'error' event at all. If we're supposedly playing but currentTime hasn't
  // moved in a while, force a reconnect instead of leaving the player stuck.
  function startWatchdog(){
    clearInterval(watchdogTimer);
    watchdogTimer = setInterval(()=>{
      if(!audioEl || !audioEl.src || recovering) return;
      if(!audioEl.paused && (Date.now() - lastProgressAt > 12000)){
        handleStreamFailure('stall');
      }
    }, 4000);
  }

  function handleStreamFailure(reason){
    if(!audioEl || !audioEl.src || recovering) return;
    recoveryAttempts++;
    if(recoveryAttempts > MAX_RECOVERY_ATTEMPTS){
      recovering = false;
      isPlaying = false;
      syncPlayButtons();
      showToast('تعذّر الاتصال بالصوت — تحقق من الإنترنت وحاول التشغيل يدويًا');
      return;
    }

    recovering = true;
    const savedTime = audioEl.currentTime || 0;
    const savedSrc = audioEl.src;
    showToast('انقطع الاتصال بالصوت، جارِ إعادة المحاولة…');

    const el = audioEl;
    const onReady = ()=>{
      el.removeEventListener('loadedmetadata', onReady);
      try{ el.currentTime = savedTime; }catch(e){}
      attemptPlay(el, 2, ()=>{ recovering = false; });
    };
    el.addEventListener('loadedmetadata', onReady);
    el.src = savedSrc;
    el.load();

    // safety net in case loadedmetadata never fires (e.g. server unreachable)
    setTimeout(()=>{
      if(recovering){
        el.removeEventListener('loadedmetadata', onReady);
        recovering = false;
        if(el.paused) handleStreamFailure('timeout-retry');
      }
    }, 9000);
  }

  /* ---------------- retry-aware play ---------------- */
  function attemptPlay(el, retries, onSettle){
    el.play().then(()=>{
      isPlaying = true;
      lastProgressAt = Date.now();
      syncPlayButtons();
      if(onSettle) onSettle(true);
    }).catch(()=>{
      if(retries > 0){
        setTimeout(()=> attemptPlay(el, retries - 1, onSettle), 900);
      } else {
        isPlaying = false;
        syncPlayButtons();
        showToast('تعذّر تشغيل الصوت — تحقق من الاتصال بالإنترنت');
        if(onSettle) onSettle(false);
      }
    });
  }

  function fmtTime(sec){
    if(!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function updateProgressUI(){
    const el = audioEl;
    if(!el) return;
    const pct = el.duration ? (el.currentTime/el.duration)*100 : 0;
    document.querySelectorAll('.listen-time-cur').forEach(t=> t.textContent = fmtTime(el.currentTime));
    document.querySelectorAll('.listen-time-dur').forEach(t=> t.textContent = fmtTime(el.duration));
    document.querySelectorAll('.listen-seek').forEach(inp=>{
      if(inp.dataset.drag) return;          // don't fight the finger while it's dragging the slider
      inp.value = pct;
      inp.style.setProperty('--p', pct + '%');
    });
  }

  function bindSeek(inp){
    inp.addEventListener('input', ()=>{
      inp.style.setProperty('--p', inp.value + '%');
      if(audioEl && audioEl.duration) audioEl.currentTime = (inp.value/100) * audioEl.duration;
    });
    const start = ()=>{ inp.dataset.drag = '1'; };
    const end = ()=>{ delete inp.dataset.drag; };
    inp.addEventListener('pointerdown', start);
    inp.addEventListener('pointerup', end);
    inp.addEventListener('pointercancel', end);
    inp.addEventListener('touchend', end);
    inp.addEventListener('blur', end);
  }

  function syncPlayButtons(){
    document.querySelectorAll('.listen-play-icon').forEach(el=> el.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY);
    const hasSrc = !!(audioEl && audioEl.src);
    const mini = document.querySelector('.mini-player');
    if(mini) mini.classList.toggle('show', hasSrc);
    document.body.classList.toggle('has-mini', hasSrc);
    document.querySelectorAll('#listenRepeatBtn').forEach(b=>{
      b.classList.toggle('on', repeatOn);
      b.setAttribute('aria-pressed', String(repeatOn));
    });
    const sl = document.getElementById('listenSpeedLabel');
    if(sl) sl.textContent = SPEEDS[speedIdx] + 'x';
    if('mediaSession' in navigator){
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  function applySpeed(el){
    if(!el) return;
    el.defaultPlaybackRate = SPEEDS[speedIdx];
    el.playbackRate = SPEEDS[speedIdx];
  }
  function cycleSpeed(){
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    localStorage.setItem('azkar_listen_speed', String(speedIdx));
    applySpeed(audioEl);
    syncPlayButtons();
  }
  function toggleRepeat(){
    repeatOn = !repeatOn;
    localStorage.setItem('azkar_listen_repeat', repeatOn ? '1' : '0');
    syncPlayButtons();
    showToast(repeatOn ? 'تكرار السورة: مفعّل' : 'تكرار السورة: متوقف');
  }

  function setMediaSession(){
    if(!('mediaSession' in navigator)) return;
    const s = surahMeta(currentSurahNum);
    const r = reciterById(currentReciterId);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s ? surahLabel(s.name) : 'القرآن الكريم',
      artist: r.name,
      album: 'تطبيق أذكاري',
      artwork: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ]
    });
    navigator.mediaSession.setActionHandler('play', ()=> resume());
    navigator.mediaSession.setActionHandler('pause', ()=> pause());
    navigator.mediaSession.setActionHandler('previoustrack', ()=> playSurah(currentSurahNum > 1 ? currentSurahNum - 1 : 114));
    navigator.mediaSession.setActionHandler('nexttrack', ()=> playSurah(currentSurahNum < 114 ? currentSurahNum + 1 : 1));
    try{
      navigator.mediaSession.setActionHandler('seekto', (details)=>{
        if(audioEl && details.seekTime != null) audioEl.currentTime = details.seekTime;
      });
    }catch(e){ /* not supported everywhere */ }
  }

  /* ---------------- transport controls ---------------- */
  function playSurah(number, reciterId){
    if(reciterId && fullReciters().some(r => r.id === reciterId)){
      currentReciterId = reciterId;
      localStorage.setItem('azkar_listen_reciter', reciterId);
      renderReciters();
    }
    recovering = false;
    recoveryAttempts = 0;
    currentSurahNum = number;
    localStorage.setItem('azkar_listen_surah', String(number));
    const r = reciterById(currentReciterId);
    if(!r || !r.surahUrl){ showToast('هذا القارئ غير متاح للاستماع للسورة كاملة حاليًا'); return; }

    const el = getAudioEl();
    el.src = r.surahUrl(number);
    applySpeed(el);
    lastProgressAt = Date.now();
    attemptPlay(el, 2);
    setMediaSession();
    renderNowPlaying();
    renderSurahList();
  }

  function pause(){
    if(audioEl) audioEl.pause();
  }

  function resume(){
    const el = getAudioEl();
    if(!el.src){ playSurah(currentSurahNum); return; }
    lastProgressAt = Date.now();
    attemptPlay(el, 2);
  }

  // Always decide from the real DOM state (el.paused), never from the isPlaying flag —
  // this is the fix for "play/next/prev stop responding": a stuck flag could never
  // happen again since every control below re-derives truth from the audio element itself.
  function togglePlay(){
    const el = getAudioEl();
    if(!el.src){ playSurah(currentSurahNum); return; }
    if(el.paused) resume(); else pause();
  }

  function stopAll(){
    clearInterval(watchdogTimer);
    recovering = false;
    if(audioEl){ audioEl.pause(); audioEl.removeAttribute('src'); }
    isPlaying = false;
    syncPlayButtons();
  }

  function setReciter(id){
    const wasPlaying = !!(audioEl && !audioEl.paused);
    currentReciterId = id;
    localStorage.setItem('azkar_listen_reciter', id);
    renderReciters();
    if(wasPlaying){ playSurah(currentSurahNum); }
    else{ renderNowPlaying(); }
  }

  /* ---------------- rendering ---------------- */
  function renderReciters(){
    const bar = document.getElementById('listenReciterBar');
    if(!bar) return;
    bar.innerHTML = fullReciters().map(r => `
      <button class="reciter-chip ${r.id===currentReciterId?'active':''}" data-id="${r.id}">${r.name}</button>
    `).join('');
    bar.querySelectorAll('.reciter-chip').forEach(chip=>{
      chip.addEventListener('click', ()=> setReciter(chip.dataset.id));
    });
  }

  function renderSurahList(){
    const container = document.getElementById('listenSurahList');
    if(!container) return;
    container.innerHTML = surahsList.map(s => `
      <div class="surah-item">
        <button class="surah-row ${s.number===currentSurahNum ? 'active-row' : ''}" data-n="${s.number}">
          <div class="left">
            <div class="surah-num">${s.number===currentSurahNum && isPlaying ? '▶' : s.number}</div>
            <div class="surah-names">
              <b>${s.englishName}</b>
              <span>${s.numberOfAyahs} آية · ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
            </div>
          </div>
          <div class="ar-name">${surahBare(s.name)}</div>
        </button>
        ${Favorites.btn(Favorites.surahItem(s))}
      </div>
    `).join('');
    container.querySelectorAll('.surah-row').forEach(btn=>{
      btn.addEventListener('click', ()=> playSurah(parseInt(btn.dataset.n,10)));
    });
  }

  function filterList(q){
    q = q.trim().toLowerCase();
    const container = document.getElementById('listenSurahList');
    const filtered = !q ? surahsList : surahsList.filter(s =>
      s.englishName.toLowerCase().includes(q) || s.name.includes(q.trim()) || String(s.number) === q
    );
    const original = surahsList;
    surahsList = filtered;
    renderSurahList();
    surahsList = original;
  }

  function currentFavItem(){
    const s = surahMeta(currentSurahNum) || { number: currentSurahNum, name: `سورة ${currentSurahNum}` };
    return Favorites.surahItem(s);
  }

  function renderNowPlaying(){
    const s = surahMeta(currentSurahNum);
    const r = reciterById(currentReciterId);
    document.querySelectorAll('.listen-now-title').forEach(el=> el.textContent = s ? surahFull(s.name) : '—');
    document.querySelectorAll('.listen-now-reciter').forEach(el=> el.textContent = r ? r.name : '—');
    // heart buttons follow the surah that is currently loaded in the player
    document.querySelectorAll('.js-fav-slot').forEach(slot=>{
      slot.innerHTML = Favorites.btn(currentFavItem(), 'mp-btn');
    });
    const lbl = document.getElementById('listenMenuFavLabel');
    if(lbl) lbl.textContent = Favorites.has(currentFavItem().id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
    syncPlayButtons();
  }

  /* ---------------- persistent mini player (shown across all pages) ---------------- */
  function ensureMiniPlayer(){
    if(document.querySelector('.mini-player')) return;
    const bar = document.createElement('div');
    bar.className = 'mini-player';
    bar.innerHTML = `
      <button class="mp-grip" aria-label="فتح المشغّل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
      <button class="mp-close" aria-label="إيقاف التشغيل وإغلاق المشغّل"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="mp-cover"><img src="player-cover.jpg" alt="" width="56" height="56"></div>
      <div class="mp-mid">
        <b class="mp-title listen-now-title">—</b>
        <span class="mp-sub listen-now-reciter">—</span>
        <input type="range" class="pc-range listen-seek mp-range" min="0" max="100" value="0" step="0.1" aria-label="التقدم في التلاوة">
        <div class="pc-times"><span class="listen-time-cur">0:00</span><span class="listen-time-dur">0:00</span></div>
      </div>
      <div class="mp-ctrl">
        <button class="mp-btn mp-prev" aria-label="السابق"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="3" height="14" rx="1.2"/><path d="M19 6l-9.5 6 9.5 6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
        <button class="mp-play" aria-label="تشغيل/إيقاف"><svg class="listen-play-icon" viewBox="0 0 24 24" fill="currentColor">${ICON_PLAY}</svg></button>
        <button class="mp-btn mp-next" aria-label="التالي"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="16" y="5" width="3" height="14" rx="1.2"/><path d="M5 6l9.5 6L5 18z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
        <span class="js-fav-slot"></span>
      </div>
    `;
    document.body.appendChild(bar);

    bindSeek(bar.querySelector('.listen-seek'));
    bar.querySelector('.mp-play').addEventListener('click', togglePlay);
    bar.querySelector('.mp-prev').addEventListener('click', ()=> playSurah(currentSurahNum > 1 ? currentSurahNum - 1 : 114));
    bar.querySelector('.mp-next').addEventListener('click', ()=> playSurah(currentSurahNum < 114 ? currentSurahNum + 1 : 1));
    bar.querySelector('.mp-close').addEventListener('click', stopAll);
    bar.querySelector('.mp-grip').addEventListener('click', ()=> navigateTo('listen'));
    bar.addEventListener('click', (e)=>{
      if(e.target.closest('button, input')) return;
      navigateTo('listen');
    });
    renderNowPlaying();
  }

  /* ---------------- player card ⋮ menu ---------------- */
  function initPlayerMenu(){
    const btn = document.getElementById('listenMenuBtn');
    const menu = document.getElementById('listenMenu');
    if(!btn || !menu) return;
    const closeMenu = ()=>{ menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const willOpen = menu.hidden;
      if(willOpen) renderNowPlaying();      // refresh the favourite label
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    document.addEventListener('click', (e)=>{
      if(!menu.hidden && !e.target.closest('.pc-menu-wrap')) closeMenu();
    });
    menu.addEventListener('click', (e)=>{
      const item = e.target.closest('.pc-menu-item');
      if(!item) return;
      closeMenu();
      const s = surahMeta(currentSurahNum);
      if(item.dataset.act === 'fav'){
        Favorites.toggle(currentFavItem());
        renderNowPlaying();
      } else if(item.dataset.act === 'mushaf'){
        navigateTo('quran');
        QuranModule.openSurah(currentSurahNum);
      } else if(item.dataset.act === 'share'){
        const text = `${s ? surahLabel(s.name) : 'القرآن الكريم'} — بصوت ${reciterById(currentReciterId).name}`;
        if(navigator.share){ navigator.share({ title: 'أذكاري', text }).catch(()=>{}); }
        else if(navigator.clipboard){ navigator.clipboard.writeText(text).then(()=> showToast('تم نسخ اسم السورة والقارئ')).catch(()=>{}); }
      }
    });
  }

  /* ---------------- init ---------------- */
  async function onEnter(){
    ensureMiniPlayer();
    if(!loadedOnce){
      loadedOnce = true;
      document.getElementById('listenSearch').addEventListener('input', (e)=> filterList(e.target.value));
      document.getElementById('listenPlayBtn').addEventListener('click', togglePlay);
      document.getElementById('listenPrevBtn').addEventListener('click', ()=> playSurah(currentSurahNum > 1 ? currentSurahNum - 1 : 114));
      document.getElementById('listenNextBtn').addEventListener('click', ()=> playSurah(currentSurahNum < 114 ? currentSurahNum + 1 : 1));
      bindSeek(document.querySelector('#listenPlayerCard .listen-seek'));
      document.getElementById('listenRepeatBtn').addEventListener('click', toggleRepeat);
      document.getElementById('listenSpeedBtn').addEventListener('click', cycleSpeed);
      initPlayerMenu();

      const list = document.getElementById('listenSurahList');
      list.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحميل قائمة السور…</div>`;
      surahsList = await QuranModule.getSurahs();
      renderReciters();
      renderSurahList();
      renderNowPlaying();
    }
  }

  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && audioEl && !audioEl.paused && !recovering){
      if(Date.now() - lastProgressAt > 8000){
        handleStreamFailure('visibility-resume');
      }
    }
  });

  return { onEnter, playSurah };
})();
window.ListenModule = ListenModule;
