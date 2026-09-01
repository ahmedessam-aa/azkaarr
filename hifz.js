'use strict';

/*
  اختبار القراءة / اختبار الحفظ — بيستخدم Web Speech API (تحويل الصوت لنص) المدمجة في المتصفح.
  ملاحظات صادقة عن الحدود:
  - أفضل دعم في Chrome (كمبيوتر أو أندرويد). Safari وFirefox دعمهم ضعيف أو غير متوفر.
  - محتاج اتصال إنترنت (المتصفح بيبعت الصوت لخدمة التعرف الصوتي بتاعته).
  - التعرف الصوتي مصمم للكلام العادي مش لتلاوة القرآن بأحكام التجويد، فالدقة
    مش هتكون 100% دايمًا — استخدمه كأداة مساعدة للمراجعة مش كحكم نهائي.

  وضعين:
  - reading (اختبار القراءة): نص الآية ظاهر وانت بتقرا منه — بيصحح نطقك.
  - memorization (اختبار الحفظ): نص الآية مخفي، بتقرا من حفظك، والنص بيتكتب
    أول بأول وانت بتقول (follow-along)، وبعد ما توقف يتصحح ويظهرلك النص
    الصحيح للمقارنة.
*/

const HifzModule = (()=>{
  const API_BASE = 'https://api.alquran.cloud/v1';
  let surahsList = [];
  let loadedOnce = false;
  let testMode = 'reading';       // 'reading' | 'memorization'
  let currentSurahNum = null;
  let currentAyahs = [];          // [{numberInSurah, text (uthmani), simple (no tashkeel)}]
  let recognition = null;
  let activeAyahIdx = null;
  let isListening = false;

  const MODE_LABELS = {
    reading: { title: 'اختبار القراءة', desc: 'الآيات ظاهرة قدامك — اقرأها بصوتك وهيتصحح نطقك', recordLabel: 'ابدأ القراءة', placeholder: null },
    memorization: { title: 'اختبار الحفظ', desc: 'الآيات مخفية — اقرأها من حفظك، وهيتكتب اللي بتقوله أول بأول، وبعدها يتصحح', recordLabel: 'ابدأ التسميع', placeholder: 'اضغط "ابدأ التسميع" واقرأ الآية من حفظك — مش هتشوف نصها إلا بعد ما تخلّص' },
    'memorization-full': { title: 'حفظ السورة كاملة', desc: 'اقرأ السورة من أولها لآخرها من حفظك من غير توقف، وأول ما توقف هيتصحح كل حرف قلته دفعة واحدة', recordLabel: 'ابدأ تسميع السورة كاملة', placeholder: 'اضغط "ابدأ تسميع السورة كاملة" واقرأ من أول السورة لآخرها من حفظك، ثم دوس "إيقاف" لما تخلص' }
  };

  /* ---------------- Arabic text normalization for matching ---------------- */
  function normalize(text){
    return (text || '')
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')   // تشكيل
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[ىی]/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\u0621-\u064A\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------------- word-level diff (LCS-based) ---------------- */
  function diffWords(refWords, saidWords){
    const n = refWords.length, m = saidWords.length;
    const dp = Array.from({length:n+1}, ()=> new Array(m+1).fill(0));
    for(let i=1;i<=n;i++){
      for(let j=1;j<=m;j++){
        dp[i][j] = refWords[i-1] === saidWords[j-1]
          ? dp[i-1][j-1] + 1
          : Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
    const matchedRefIdx = new Set();
    let i=n, j=m;
    while(i>0 && j>0){
      if(refWords[i-1] === saidWords[j-1]){
        matchedRefIdx.add(i-1);
        i--; j--;
      } else if(dp[i-1][j] >= dp[i][j-1]){
        i--;
      } else {
        j--;
      }
    }
    return refWords.map((w, idx)=> ({ word: w, status: matchedRefIdx.has(idx) ? 'ok' : 'missing' }));
  }

  // بيبني مصفوفة كلمات السورة كاملة، وكل كلمة معاها رقم الآية اللي جاية منها
  function buildFullReference(){
    const flat = [];
    currentAyahs.forEach(a=>{
      normalize(a.simple).split(' ').filter(Boolean).forEach(w=> flat.push({ word: w, ayahNum: a.numberInSurah }));
    });
    return flat;
  }

  // بيرسم التصحيح مقسّم حسب الآية، مع رقم كل آية ظاهر قبل كلماتها
  function renderGroupedDiff(diffWithAyah){
    let html = '';
    let lastAyah = null;
    diffWithAyah.forEach(d=>{
      if(d.ayahNum !== lastAyah){
        html += `<span class="hifz-full-ayah-badge">﴿${d.ayahNum}﴾</span> `;
        lastAyah = d.ayahNum;
      }
      html += `<span class="hifz-word ${d.status === 'ok' ? 'ok' : 'bad'}">${d.word}</span> `;
    });
    return html;
  }

  /* ---------------- speech recognition ---------------- */
  function supported(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function getRecognition(){
    if(recognition) return recognition;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  function startAyahTest(idx){
    if(!supported()){
      showToast('التعرف الصوتي غير مدعوم في هذا المتصفح — جرّب Chrome');
      return;
    }
    if(isListening) stopAyahTest();

    activeAyahIdx = idx;
    const card = document.querySelector(`.hifz-card[data-idx="${idx}"]`);
    card.classList.add('listening');
    const liveEl = card.querySelector('.hifz-live');
    liveEl.textContent = 'جارِ الاستماع… ابدأ القراءة الآن';
    liveEl.style.display = 'block';
    card.querySelector('.hifz-result').innerHTML = '';

    const rec = getRecognition();
    let finalTranscript = '';

    rec.onresult = (e)=>{
      let interim = '';
      finalTranscript = '';
      for(let i=0;i<e.results.length;i++){
        const t = e.results[i][0].transcript;
        if(e.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      liveEl.textContent = (finalTranscript + interim) || 'جارِ الاستماع…';
    };
    rec.onerror = (e)=>{
      isListening = false;
      card.classList.remove('listening');
      if(e.error === 'no-speech'){
        showToast('مفيش صوت اتسمع — حاول تاني وتأكد من إذن الميكروفون');
      } else if(e.error === 'not-allowed' || e.error === 'permission-denied'){
        showToast('محتاج إذن استخدام الميكروفون عشان الميزة دي تشتغل');
      } else {
        showToast('حصل خطأ في التعرف الصوتي — حاول تاني');
      }
    };
    rec.onend = ()=>{
      isListening = false;
      card.classList.remove('listening');
      liveEl.style.display = 'none';
      if(finalTranscript.trim()){
        if(idx === 'full') evaluateFullSurah(finalTranscript);
        else evaluateAyah(idx, finalTranscript);
      }
    };

    try{
      rec.start();
      isListening = true;
    }catch(e){
      showToast('تعذّر بدء الميكروفون — حاول مرة أخرى');
    }
  }

  function stopAyahTest(){
    if(recognition && isListening){
      try{ recognition.stop(); }catch(e){}
    }
  }

  function evaluateAyah(idx, saidText){
    const ayah = currentAyahs[idx];
    const refWords = normalize(ayah.simple).split(' ').filter(Boolean);
    const saidWords = normalize(saidText).split(' ').filter(Boolean);
    const diff = diffWords(refWords, saidWords);

    const correctCount = diff.filter(d=> d.status === 'ok').length;
    const pct = refWords.length ? Math.round((correctCount / refWords.length) * 100) : 0;

    const card = document.querySelector(`.hifz-card[data-idx="${idx}"]`);
    const resultEl = card.querySelector('.hifz-result');

    const wordsHtml = diff.map(d =>
      d.status === 'ok'
        ? `<span class="hifz-word ok">${d.word}</span>`
        : `<span class="hifz-word bad">${d.word}</span>`
    ).join(' ');

    const scoreClass = pct >= 90 ? 'great' : pct >= 60 ? 'mid' : 'low';

    // في وضع الحفظ: نص الآية مخفي قبل المحاولة — نظهره دلوقتي جنب التصحيح مباشرة
    let revealHtml = '';
    if(testMode === 'memorization'){
      revealHtml = `
        <div class="hifz-reveal-label">النص الصحيح للآية:</div>
        <p class="hifz-target-text quran-font revealed">${ayah.text}</p>
      `;
    }

    resultEl.innerHTML = `
      <div class="hifz-score ${scoreClass}">${pct}% مطابقة (${correctCount} من ${refWords.length} كلمة)</div>
      <p class="hifz-diff-text">${wordsHtml}</p>
      ${pct < 100 ? '<span class="hifz-hint">الكلمات باللون الأحمر لم تُنطق أو اختلفت عن الآية — راجعها وأعد المحاولة</span>' : ''}
      ${revealHtml}
    `;

    saveScore(currentSurahNum, ayah.numberInSurah, pct);
    updateProgressSummary();
  }

  function evaluateFullSurah(saidText){
    const flatRef = buildFullReference();
    const refWordsPlain = flatRef.map(f=> f.word);
    const saidWords = normalize(saidText).split(' ').filter(Boolean);
    const diff = diffWords(refWordsPlain, saidWords);
    const diffWithAyah = diff.map((d,i)=> ({ ...d, ayahNum: flatRef[i].ayahNum }));

    const correctCount = diff.filter(d=> d.status === 'ok').length;
    const pct = refWordsPlain.length ? Math.round((correctCount / refWordsPlain.length) * 100) : 0;
    const scoreClass = pct >= 90 ? 'great' : pct >= 60 ? 'mid' : 'low';

    const card = document.querySelector('.hifz-full-card');
    const resultEl = card.querySelector('.hifz-result');
    const wordsHtml = renderGroupedDiff(diffWithAyah);

    resultEl.innerHTML = `
      <div class="hifz-score ${scoreClass}">${pct}% مطابقة (${correctCount} من ${refWordsPlain.length} كلمة على مستوى السورة كاملة)</div>
      <p class="hifz-diff-text hifz-full-diff">${wordsHtml}</p>
      ${pct < 100 ? '<span class="hifz-hint">الكلمات الحمراء لم تُنطق أو اختلفت — رقم الآية المشار إليه بجانبها يساعدك تراجعها</span>' : ''}
    `;

    saveScore(currentSurahNum, 'full', pct);
    updateProgressSummary();
  }

  /* ---------------- reference audio (hear correct recitation) ---------------- */
  function playReference(idx){
    const ayah = currentAyahs[idx];
    const url = `https://everyayah.com/data/Alafasy_128kbps/${String(currentSurahNum).padStart(3,'0')}${String(ayah.numberInSurah).padStart(3,'0')}.mp3`;
    const audio = new Audio(url);
    audio.play().catch(()=> showToast('تعذّر تشغيل الصوت'));
  }

  /* ---------------- progress persistence ---------------- */
  function scoresKey(surahNum){ return `azkar_hifz_${testMode}_${surahNum}`; }
  function saveScore(surahNum, ayahNum, pct){
    const raw = localStorage.getItem(scoresKey(surahNum));
    const scores = raw ? JSON.parse(raw) : {};
    if(!scores[ayahNum] || pct > scores[ayahNum]) scores[ayahNum] = pct;
    localStorage.setItem(scoresKey(surahNum), JSON.stringify(scores));
  }
  function getScores(surahNum){
    const raw = localStorage.getItem(scoresKey(surahNum));
    return raw ? JSON.parse(raw) : {};
  }

  function updateProgressSummary(){
    const scores = getScores(currentSurahNum);
    const el = document.getElementById('hifzProgressSummary');
    if(testMode === 'memorization-full'){
      if(el) el.textContent = scores['full'] != null
        ? `أفضل نتيجة: ${scores['full']}% مطابقة على مستوى السورة كاملة`
        : `لسه مجربتش اختبار السورة كاملة`;
      return;
    }
    const vals = Object.values(scores);
    const tested = vals.length;
    const avg = tested ? Math.round(vals.reduce((a,b)=>a+b,0)/tested) : 0;
    if(el) el.textContent = tested
      ? `تم اختبار ${tested} من ${currentAyahs.length} آية — متوسط المطابقة ${avg}%`
      : `لسه مبدأتش الاختبار في السورة دي`;
  }

  /* ---------------- full-surah mode rendering ---------------- */
  function renderFullSurahCard(){
    const list = document.getElementById('hifzAyahList');
    const scores = getScores(currentSurahNum);
    const savedPct = scores['full'];
    list.innerHTML = `
      <div class="hifz-card hifz-full-card" data-idx="full">
        <div class="hifz-card-top">
          <span class="hifz-ayah-badge">السورة كاملة — ${currentAyahs.length} آية${savedPct != null ? ` · أفضل نتيجة ${savedPct}%` : ''}</span>
        </div>
        <p class="hifz-memo-placeholder">${MODE_LABELS['memorization-full'].placeholder}</p>
        <div class="hifz-live" style="display:none;"></div>
        <div class="hifz-result"></div>
        <button class="hifz-record-btn">
          <span class="hifz-record-dot"></span>
          <span class="hifz-record-label">${MODE_LABELS['memorization-full'].recordLabel}</span>
        </button>
      </div>
    `;
    document.querySelector('.hifz-full-card .hifz-record-btn').addEventListener('click', ()=>{
      if(isListening){ stopAyahTest(); }
      else{ startAyahTest('full'); }
    });
    updateProgressSummary();
  }

  /* ---------------- rendering ---------------- */
  function renderAyahCards(){
    const list = document.getElementById('hifzAyahList');
    const scores = getScores(currentSurahNum);
    const labels = MODE_LABELS[testMode];
    const isMemo = testMode === 'memorization';

    list.innerHTML = currentAyahs.map((a, idx) => {
      const savedPct = scores[a.numberInSurah];
      return `
      <div class="hifz-card" data-idx="${idx}">
        <div class="hifz-card-top">
          <span class="hifz-ayah-badge">آية ${a.numberInSurah}${savedPct != null ? ` · أفضل نتيجة ${savedPct}%` : ''}</span>
          <button class="hifz-listen-btn" aria-label="استمع للنموذج">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </button>
        </div>
        ${isMemo ? `<p class="hifz-memo-placeholder">${labels.placeholder}</p>` : ''}
        <p class="hifz-target-text quran-font" ${isMemo ? 'style="display:none;"' : ''}>${a.text}</p>
        <div class="hifz-live" style="display:none;"></div>
        <div class="hifz-result"></div>
        <button class="hifz-record-btn">
          <span class="hifz-record-dot"></span>
          <span class="hifz-record-label">${labels.recordLabel}</span>
        </button>
      </div>`;
    }).join('');

    list.querySelectorAll('.hifz-card').forEach(card=>{
      const idx = parseInt(card.dataset.idx, 10);
      card.querySelector('.hifz-listen-btn').addEventListener('click', ()=> playReference(idx));
      card.querySelector('.hifz-record-btn').addEventListener('click', ()=>{
        if(isListening && activeAyahIdx === idx){ stopAyahTest(); }
        else{ startAyahTest(idx); }
      });
    });

    updateProgressSummary();
  }

  async function openSurah(number){
    currentSurahNum = number;
    document.getElementById('hifzPickerView').style.display = 'none';
    document.getElementById('hifzTestView').style.display = 'block';
    const meta = surahsList.find(s=> s.number === number);
    document.getElementById('hifzSurahTitle').textContent = `سورة ${meta ? meta.name : ''} — ${MODE_LABELS[testMode].title}`;

    const list = document.getElementById('hifzAyahList');
    list.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحميل الآيات…</div>`;

    try{
      const [uthRes, simpleRes] = await Promise.all([
        fetch(`${API_BASE}/surah/${number}/quran-uthmani`),
        fetch(`${API_BASE}/surah/${number}/quran-simple`)
      ]);
      const uth = (await uthRes.json()).data.ayahs;
      const simple = (await simpleRes.json()).data.ayahs;
      currentAyahs = uth.map((a, i)=> ({ numberInSurah: a.numberInSurah, text: a.text, simple: simple[i].text }));
      if(testMode === 'memorization-full') renderFullSurahCard();
      else renderAyahCards();
    }catch(e){
      list.innerHTML = `<div class="state-msg">تعذّر تحميل السورة — تحقق من الاتصال وحاول مرة أخرى.</div>`;
    }
  }

  function backToPicker(){
    stopAyahTest();
    document.getElementById('hifzTestView').style.display = 'none';
    document.getElementById('hifzPickerView').style.display = 'block';
  }

  function renderPicker(){
    const list = document.getElementById('hifzSurahPicker');
    list.innerHTML = surahsList.map(s => `
      <button class="surah-row" data-n="${s.number}">
        <div class="left">
          <div class="surah-num">${s.number}</div>
          <div class="surah-names">
            <b>${s.englishName}</b>
            <span>${s.numberOfAyahs} آية</span>
          </div>
        </div>
        <div class="ar-name">${s.name}</div>
      </button>
    `).join('');
    list.querySelectorAll('.surah-row').forEach(btn=>{
      btn.addEventListener('click', ()=> openSurah(parseInt(btn.dataset.n,10)));
    });
  }

  function filterPicker(q){
    q = q.trim().toLowerCase();
    const container = document.getElementById('hifzSurahPicker');
    const filtered = !q ? surahsList : surahsList.filter(s =>
      s.englishName.toLowerCase().includes(q) || s.name.includes(q.trim()) || String(s.number) === q
    );
    const original = surahsList;
    surahsList = filtered;
    renderPicker();
    surahsList = original;
  }

  function renderModeHead(){
    const labels = MODE_LABELS[testMode];
    document.getElementById('hifzModeTitle').textContent = labels.title;
    document.getElementById('hifzModeDesc').textContent = labels.desc;
    document.querySelectorAll('.hifz-mode-tab').forEach(tab=>{
      tab.classList.toggle('active', tab.dataset.mode === testMode);
    });
  }

  function setMode(mode){
    testMode = mode;
    renderModeHead();
  }

  /* ---------------- entry point (called from home quick-access tiles) ---------------- */
  function openWithMode(mode){
    setMode(mode);
    stopAyahTest();
    document.getElementById('hifzTestView').style.display = 'none';
    document.getElementById('hifzPickerView').style.display = 'block';
    navigateTo('hifz');
  }

  async function onEnter(){
    if(!loadedOnce){
      loadedOnce = true;

      if(!supported()){
        document.getElementById('hifzUnsupportedNote').style.display = 'block';
      }

      document.querySelectorAll('.hifz-mode-tab').forEach(tab=>{
        tab.addEventListener('click', ()=>{
          setMode(tab.dataset.mode);
          backToPicker();
        });
      });

      document.getElementById('hifzSearch').addEventListener('input', (e)=> filterPicker(e.target.value));
      document.getElementById('hifzBackBtn').addEventListener('click', backToPicker);

      surahsList = await QuranModule.getSurahs();
      renderPicker();
      renderModeHead();
    }
  }

  return { onEnter, openWithMode };
})();
window.HifzModule = HifzModule;
