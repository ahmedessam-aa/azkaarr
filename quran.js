'use strict';

function pad3g(n){ return String(n).padStart(3,'0'); }

// كل قارئ: folder (ملفات آية بآية لمتابعة القراءة في المصحف) + surahUrl (ملف السورة كاملة متصلاً بدون قطع، للاستماع الحر)
const RECITERS = [
  { id: 'alafasy',  folder: 'Alafasy_128kbps',            name: 'مشاري العفاسي',        surahUrl: n => `https://server8.mp3quran.net/download/afs/${pad3g(n)}.mp3` },
  { id: 'husary',   folder: 'Husary_128kbps',              name: 'محمود خليل الحصري',    surahUrl: n => `https://server13.mp3quran.net/husr/${pad3g(n)}.mp3` },
  { id: 'minshawy', folder: 'Minshawy_Murattal_128kbps',   name: 'محمد صديق المنشاوي',   surahUrl: n => `https://server10.mp3quran.net/minsh/${pad3g(n)}.mp3` },
  { id: 'muaiqly',  folder: 'Maher_AlMuaiqly_64kbps',      name: 'ماهر المعيقلي',        surahUrl: n => `https://server12.mp3quran.net/maher/${pad3g(n)}.mp3` },
  { id: 'dosari',   folder: 'Yasser_Ad-Dussary_128kbps',   name: 'ياسر الدوسري',         surahUrl: n => `https://server11.mp3quran.net/download/yasser/${pad3g(n)}.mp3` },
  { id: 'basit',    folder: 'Abdul_Basit_Murattal_192kbps',name: 'عبد الباسط عبد الصمد', surahUrl: null },
  { id: 'sudais',   folder: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبد الرحمن السديس', surahUrl: null },
];

const QuranModule = (()=>{
  const API_BASE = 'https://api.alquran.cloud/v1';
  const AUDIO_BASE = 'https://everyayah.com/data';
  const TOTAL_PAGES = 604;

  let surahs = [];
  let loadedOnce = false;
  let currentPage = 1;
  let currentPageAyahs = [];   // ayahs on the current page (with surah info)
  let currentReciterId = localStorage.getItem('azkar_reciter') || 'alafasy';

  let audioEl = null;
  let playQueue = [];
  let playIndex = -1;
  let isPlaying = false;

  function pad3(n){ return String(n).padStart(3,'0'); }

  function currentReciter(){
    return RECITERS.find(r => r.id === currentReciterId) || RECITERS[0];
  }

  function ayahAudioUrl(surahNum, ayahNum){
    const r = currentReciter();
    return `${AUDIO_BASE}/${r.folder}/${pad3(surahNum)}${pad3(ayahNum)}.mp3`;
  }

  /* ---------------- last read position ---------------- */
  function saveLastRead(page, surahName){
    localStorage.setItem('azkar_last_read', JSON.stringify({ page, name: surahName, at: Date.now() }));
    renderContinueCard();
  }

  function renderContinueCard(){
    const raw = localStorage.getItem('azkar_last_read');
    const card = document.getElementById('continueCard');
    if(!raw){ card.style.display = 'none'; return; }
    const data = JSON.parse(raw);
    document.getElementById('continueLabel').textContent = `سورة ${data.name} — صفحة ${data.page}`;
    card.style.display = 'flex';
    document.getElementById('continueBtn').onclick = ()=> openPage(data.page);
  }

  /* ---------------- surah list ---------------- */
  async function loadSurahList(){
    const container = document.getElementById('surahList');
    try{
      const res = await fetch(`${API_BASE}/surah`);
      if(!res.ok) throw new Error('failed');
      const json = await res.json();
      surahs = json.data;
      renderSurahList(surahs);
    }catch(e){
      container.innerHTML = `<div class="state-msg">تعذّر تحميل قائمة السور. تحقق من اتصال الإنترنت وحاول مرة أخرى.
        <br><button class="btn btn-outline btn-block" id="retrySurahList" style="margin-top:14px;max-width:240px;margin-inline:auto;">إعادة المحاولة</button></div>`;
      document.getElementById('retrySurahList')?.addEventListener('click', loadSurahList);
    }
  }

  function renderSurahList(list){
    const container = document.getElementById('surahList');
    if(list.length === 0){
      container.innerHTML = `<div class="state-msg">لا توجد نتائج مطابقة</div>`;
      return;
    }
    container.innerHTML = list.map(s => `
      <button class="surah-row" data-n="${s.number}">
        <div class="left">
          <div class="surah-num">${s.number}</div>
          <div class="surah-names">
            <b>${s.englishName}</b>
            <span>${s.englishNameTranslation} · ${s.numberOfAyahs} آية · ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</span>
          </div>
        </div>
        <div class="ar-name">${s.name}</div>
      </button>
    `).join('');
    container.querySelectorAll('.surah-row').forEach(btn=>{
      btn.addEventListener('click', ()=> openSurah(parseInt(btn.dataset.n,10)));
    });
  }

  function filterSurahs(query){
    const q = query.trim().toLowerCase();
    if(!q){ renderSurahList(surahs); return; }
    const filtered = surahs.filter(s =>
      s.englishName.toLowerCase().includes(q) ||
      s.englishNameTranslation.toLowerCase().includes(q) ||
      s.name.includes(query.trim()) ||
      String(s.number) === q
    );
    renderSurahList(filtered);
  }

  /* ---------------- open a surah -> resolve its starting mushaf page ---------------- */
  async function openSurah(number){
    document.getElementById('quranListView').style.display = 'none';
    document.getElementById('quranReaderView').style.display = 'block';
    window.scrollTo({top:0, behavior:'smooth'});

    const textEl = document.getElementById('mushafText');
    textEl.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحديد صفحة السورة…</div>`;

    try{
      const res = await fetch(`${API_BASE}/ayah/${number}:1/quran-uthmani`);
      if(!res.ok) throw new Error('failed');
      const json = await res.json();
      const page = json.data.page || 1;
      openPage(page);
    }catch(e){
      textEl.innerHTML = `<div class="state-msg">تعذّر فتح السورة. تحقق من الاتصال وحاول مرة أخرى.</div>`;
    }
  }

  /* ---------------- open a specific mushaf page (1-604) ---------------- */
  async function openPage(pageNum){
    if(pageNum < 1 || pageNum > TOTAL_PAGES) return;
    stopAudio();

    document.getElementById('quranListView').style.display = 'none';
    document.getElementById('quranReaderView').style.display = 'block';

    currentPage = pageNum;
    const textEl = document.getElementById('mushafText');
    textEl.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحميل الصفحة…</div>`;
    document.getElementById('mushafPageNum').textContent = `صفحة ${pageNum} / ${TOTAL_PAGES}`;
    document.getElementById('audioBar').style.display = 'none';

    try{
      const res = await fetch(`${API_BASE}/page/${pageNum}/quran-uthmani`);
      if(!res.ok) throw new Error('failed');
      const json = await res.json();
      const ayahs = json.data.ayahs;
      currentPageAyahs = ayahs;

      const firstSurah = ayahs[0].surah;
      document.getElementById('mushafSurahBadge').textContent = `سورة ${firstSurah.name}`;

      const bismillahEl = document.getElementById('mushafBismillah');
      const isNewSurahStart = ayahs[0].numberInSurah === 1;
      bismillahEl.textContent = (isNewSurahStart && firstSurah.number !== 1 && firstSurah.number !== 9)
        ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' : '';

      let html = '';
      let lastSurahNum = null;
      ayahs.forEach((a, idx)=>{
        if(a.surah.number !== lastSurahNum){
          if(lastSurahNum !== null){
            html += `<div class="mushaf-surah-badge" style="display:inline-block;margin:14px 0 10px;">سورة ${a.surah.name}</div><br>`;
          }
          lastSurahNum = a.surah.number;
          if(a.numberInSurah === 1 && a.surah.number !== 1 && a.surah.number !== 9){
            html += `<div class="mushaf-bismillah" style="margin:6px 0 12px;">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
          }
        }
        html += `<span class="ayah-span" data-idx="${idx}">${a.text} <span class="ayah-num" data-surah="${a.surah.number}" data-ayah="${a.numberInSurah}" data-surah-name="${a.surah.name}" title="اضغط لعرض التفسير">${a.numberInSurah}</span></span> `;
      });
      textEl.innerHTML = html;
      textEl.querySelectorAll('.ayah-num').forEach(el=>{
        el.addEventListener('click', (e)=>{
          e.stopPropagation();
          if(window.TafsirModule){
            TafsirModule.open(parseInt(el.dataset.surah,10), parseInt(el.dataset.ayah,10), el.dataset.surahName);
          }
        });
      });

      document.getElementById('audioBar').style.display = 'flex';
      updateAudioMeta();
      saveLastRead(pageNum, firstSurah.name);
    }catch(e){
      textEl.innerHTML = `<div class="state-msg">تعذّر تحميل الصفحة. تحقق من الاتصال وحاول مرة أخرى.</div>`;
    }

    document.getElementById('prevPageBtn').disabled = pageNum <= 1;
    document.getElementById('nextPageBtn').disabled = pageNum >= TOTAL_PAGES;
  }

  /* ---------------- reciter bar ---------------- */
  function renderReciterBar(){
    const bar = document.getElementById('reciterBar');
    bar.innerHTML = RECITERS.map(r => `
      <button class="reciter-chip ${r.id === currentReciterId ? 'active' : ''}" data-id="${r.id}">${r.name}</button>
    `).join('');
    bar.querySelectorAll('.reciter-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        stopAudio();
        currentReciterId = chip.dataset.id;
        localStorage.setItem('azkar_reciter', currentReciterId);
        renderReciterBar();
        updateAudioMeta();
      });
    });
  }

  function updateAudioMeta(){
    const sub = document.getElementById('audioMetaSub');
    if(sub) sub.textContent = `بصوت ${currentReciter().name}`;
  }

  /* ---------------- audio playback (sequential per-ayah, whole page) ---------------- */
  function getAudioEl(){
    if(!audioEl){
      audioEl = new Audio();
      audioEl.addEventListener('ended', playNextInQueue);
    }
    return audioEl;
  }

  function highlightAyah(idx){
    document.querySelectorAll('.ayah-span.playing').forEach(el=> el.classList.remove('playing'));
    if(idx == null) return;
    const el = document.querySelector(`.ayah-span[data-idx="${idx}"]`);
    if(el){
      el.classList.add('playing');
      el.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }

  function playNextInQueue(){
    playIndex++;
    if(playIndex >= playQueue.length){
      stopAudio();
      return;
    }
    const item = playQueue[playIndex];
    highlightAyah(item.idx);
    const el = getAudioEl();
    el.src = ayahAudioUrl(item.surah, item.ayah);
    el.play().catch(()=> showToast('تعذّر تشغيل الصوت'));
  }

  function startPlayback(){
    if(!currentPageAyahs.length) return;
    playQueue = currentPageAyahs.map((a, idx)=> ({ idx, surah:a.surah.number, ayah:a.numberInSurah }));
    playIndex = -1;
    isPlaying = true;
    document.getElementById('audioPlayIcon').innerHTML = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
    playNextInQueue();
  }

  function stopAudio(){
    isPlaying = false;
    playQueue = [];
    playIndex = -1;
    if(audioEl){ audioEl.pause(); audioEl.removeAttribute('src'); }
    highlightAyah(null);
    const icon = document.getElementById('audioPlayIcon');
    if(icon) icon.innerHTML = '<polygon points="6,4 20,12 6,20"/>';
  }

  function togglePlayback(){
    if(isPlaying){ stopAudio(); }
    else{ startPlayback(); }
  }

  /* ---------------- swipe navigation ---------------- */
  function initSwipe(){
    const frame = document.querySelector('.mushaf-frame');
    let startX = null;
    frame.addEventListener('touchstart', (e)=>{ startX = e.touches[0].clientX; }, {passive:true});
    frame.addEventListener('touchend', (e)=>{
      if(startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if(Math.abs(dx) > 60){
        if(dx < 0) openPage(currentPage + 1);
        else openPage(currentPage - 1);
      }
      startX = null;
    }, {passive:true});
  }

  function initReaderNav(){
    document.getElementById('quranBackBtn').addEventListener('click', ()=>{
      stopAudio();
      document.getElementById('quranReaderView').style.display = 'none';
      document.getElementById('quranListView').style.display = 'block';
    });
    document.getElementById('prevPageBtn').addEventListener('click', ()=> openPage(currentPage - 1));
    document.getElementById('nextPageBtn').addEventListener('click', ()=> openPage(currentPage + 1));
    document.getElementById('audioPlayBtn').addEventListener('click', togglePlayback);
    document.getElementById('audioStopBtn').addEventListener('click', stopAudio);
    initSwipe();
  }

  async function getSurahs(){
    if(surahs.length) return surahs;
    try{
      const res = await fetch(`${API_BASE}/surah`);
      const json = await res.json();
      surahs = json.data;
      return surahs;
    }catch(e){ return []; }
  }

  function onEnter(){
    if(!loadedOnce){
      loadedOnce = true;
      loadSurahList();
      document.getElementById('surahSearch').addEventListener('input', (e)=> filterSurahs(e.target.value));
      renderReciterBar();
      initReaderNav();
    }
    renderContinueCard();
  }

  return { onEnter, openSurah, openPage, getSurahs };
})();
window.QuranModule = QuranModule;
window.RECITERS = RECITERS;
