'use strict';

const TafsirModule = (()=>{
  const BASE = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
  const EDITIONS = [
    { id: 'ar-tafsir-muyassar', name: 'الميسّر' },
    { id: 'ar-tafsir-ibn-kathir', name: 'ابن كثير' },
    { id: 'ar-tafseer-al-saddi', name: 'السعدي' },
  ];
  let currentEdition = localStorage.getItem('azkar_tafsir_edition') || EDITIONS[0].id;
  let currentSurah = null;
  let currentAyah = null;
  let currentSurahName = '';

  function editionName(id){
    return (EDITIONS.find(e=>e.id===id) || EDITIONS[0]).name;
  }

  function renderChips(){
    const bar = document.getElementById('tafsirEditionBar');
    bar.innerHTML = EDITIONS.map(e => `
      <button class="reciter-chip ${e.id===currentEdition?'active':''}" data-id="${e.id}">${e.name}</button>
    `).join('');
    bar.querySelectorAll('.reciter-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        currentEdition = chip.dataset.id;
        localStorage.setItem('azkar_tafsir_edition', currentEdition);
        renderChips();
        loadTafsir();
      });
    });
  }

  async function loadTafsir(){
    const body = document.getElementById('tafsirBody');
    body.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحميل التفسير…</div>`;
    try{
      const url = `${BASE}/${currentEdition}/${currentSurah}/${currentAyah}.json`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('not found');
      const json = await res.json();
      if(!json.text || !json.text.trim()){
        body.innerHTML = `<div class="state-msg">التفسير غير متاح لهذه الآية في هذه النسخة — جرّب نسخة تفسير أخرى.</div>`;
        return;
      }
      body.innerHTML = `<p class="tafsir-text">${json.text}</p>`;
    }catch(e){
      body.innerHTML = `<div class="state-msg">تعذّر تحميل التفسير — تحقق من الاتصال أو جرّب نسخة تفسير أخرى.</div>`;
    }
  }

  function open(surahNum, ayahNum, surahName){
    currentSurah = surahNum;
    currentAyah = ayahNum;
    currentSurahName = surahName;
    document.getElementById('tafsirRef').textContent = `تفسير سورة ${surahName} — آية ${ayahNum}`;
    renderChips();
    loadTafsir();
    document.getElementById('tafsirSheetOverlay').classList.add('open');
    document.getElementById('tafsirSheet').classList.add('open');
  }

  function close(){
    document.getElementById('tafsirSheetOverlay').classList.remove('open');
    document.getElementById('tafsirSheet').classList.remove('open');
  }

  function init(){
    document.getElementById('tafsirSheetOverlay').addEventListener('click', close);
    document.getElementById('tafsirCloseBtn').addEventListener('click', close);
  }

  return { open, close, init };
})();
window.TafsirModule = TafsirModule;
