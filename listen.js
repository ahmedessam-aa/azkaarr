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
    document.querySelectorAll('.listen-progress-fill').forEach(f=> f.style.width = pct+'%');
    document.querySelectorAll('.listen-time-cur').forEach(t=> t.textContent = fmtTime(el.currentTime));
    document.querySelectorAll('.listen-time-dur').forEach(t=> t.textContent = fmtTime(el.duration));
    const seek = document.getElementById('listenSeek');
    if(seek && el.duration) seek.value = (el.currentTime/el.duration)*100;
  }

  function syncPlayButtons(){
    const iconSvg = isPlaying
      ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
      : '<polygon points="6,4 20,12 6,20"/>';
    document.querySelectorAll('.listen-play-icon').forEach(el=> el.innerHTML = iconSvg);
    const mini = document.querySelector('.mini-player');
    if(mini) mini.classList.toggle('show', !!(audioEl && audioEl.src));
    if('mediaSession' in navigator){
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  function setMediaSession(){
    if(!('mediaSession' in navigator)) return;
    const s = surahMeta(currentSurahNum);
    const r = reciterById(currentReciterId);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s ? `سورة ${s.name}` : 'القرآن الكريم',
      artist: r.name,
      album: 'تطبيق أذكار',
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
  function playSurah(number){
    recovering = false;
    recoveryAttempts = 0;
    currentSurahNum = number;
    localStorage.setItem('azkar_listen_surah', String(number));
    const r = reciterById(currentReciterId);
    if(!r || !r.surahUrl){ showToast('هذا القارئ غير متاح للاستماع للسورة كاملة حاليًا'); return; }

    const el = getAudioEl();
    el.src = r.surahUrl(number);
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
      <button class="surah-row ${s.number===currentSurahNum ? 'active-row' : ''}" data-n="${s.number}">
        <div class="left">
          <div class="surah-num">${s.number===currentSurahNum && isPlaying ? '▶' : s.number}</div>
          <div class="surah-names">
            <b>${s.englishName}</b>
            <span>${s.numberOfAyahs} آية · ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
          </div>
        </div>
        <div class="ar-name">${s.name}</div>
      </button>
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

  function renderNowPlaying(){
    const s = surahMeta(currentSurahNum);
    const r = reciterById(currentReciterId);
    document.querySelectorAll('.listen-now-title').forEach(el=> el.textContent = s ? `سورة ${s.name}` : '—');
    document.querySelectorAll('.listen-now-reciter').forEach(el=> el.textContent = r ? r.name : '—');
    syncPlayButtons();
  }

  /* ---------------- persistent mini player (shown across all pages) ---------------- */
  function ensureMiniPlayer(){
    if(document.querySelector('.mini-player')) return;
    const bar = document.createElement('div');
    bar.className = 'mini-player';
    bar.innerHTML = `
      <button class="mini-prev" aria-label="السابق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <button class="mini-play-btn" aria-label="تشغيل/إيقاف">
        <svg class="listen-play-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
      </button>
      <button class="mini-next" aria-label="التالي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
      <div class="mini-info">
        <b class="listen-now-title">—</b>
        <span class="listen-now-reciter">—</span>
      </div>
      <div class="mini-progress"><i class="listen-progress-fill"></i></div>
      <button class="mini-stop" aria-label="إيقاف كلي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    `;
    document.body.appendChild(bar);

    bar.querySelector('.mini-play-btn').addEventListener('click', togglePlay);
    bar.querySelector('.mini-prev').addEventListener('click', ()=> playSurah(currentSurahNum > 1 ? currentSurahNum - 1 : 114));
    bar.querySelector('.mini-next').addEventListener('click', ()=> playSurah(currentSurahNum < 114 ? currentSurahNum + 1 : 1));
    bar.querySelector('.mini-stop').addEventListener('click', stopAll);
    bar.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      navigateTo('listen');
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
      document.getElementById('listenSeek').addEventListener('input', (e)=>{
        if(audioEl && audioEl.duration) audioEl.currentTime = (e.target.value/100) * audioEl.duration;
      });

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

  return { onEnter };
})();
window.ListenModule = ListenModule;
