'use strict';

const AzkarModule = (()=>{
  let activeCat = 'morning';
  let progress = {}; // { itemIndex: currentCount }

  function todayStr(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  function loadProgress(cat){
    const raw = localStorage.getItem('azkar_progress_' + cat);
    if(raw){
      const obj = JSON.parse(raw);
      if(obj.date === todayStr()) return obj.counts;
    }
    return {};
  }

  function saveProgress(cat){
    localStorage.setItem('azkar_progress_' + cat, JSON.stringify({ date: todayStr(), counts: progress }));
  }

  function renderTabs(){
    document.querySelectorAll('.azkar-tab').forEach(tab=>{
      tab.classList.toggle('active', tab.dataset.cat === activeCat);
    });
  }

  function bindTabs(){
    document.querySelectorAll('.azkar-tab').forEach(tab=>{
      tab.addEventListener('click', ()=> selectCategory(tab.dataset.cat));
    });
  }

  function renderList(){
    const data = AZKAR_DATA[activeCat];
    progress = loadProgress(activeCat);
    const listEl = document.getElementById('azkarList');

    listEl.innerHTML = data.items.map((item, i)=>{
      const cur = progress[i] || 0;
      const done = cur >= item.count;
      return `
        <div class="zikr-card ${done ? 'done' : ''}" data-i="${i}">
          <p class="zikr-text quran-font">${item.text}</p>
          <div class="zikr-foot">
            <span class="zikr-source">${item.source}</span>
            <div class="zikr-counter">
              <button class="minus-btn" aria-label="إنقاص"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
              <span class="num">${cur} / ${item.count}</span>
              <button class="plus-btn" aria-label="زيادة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
            </div>
          </div>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.zikr-card').forEach(card=>{
      const i = card.dataset.i;
      const item = data.items[i];
      const numEl = card.querySelector('.num');

      const bump = (delta)=>{
        let cur = progress[i] || 0;
        cur = Math.max(0, Math.min(item.count, cur + delta));
        progress[i] = cur;
        saveProgress(activeCat);
        numEl.textContent = `${cur} / ${item.count}`;
        card.classList.toggle('done', cur >= item.count);
        updateProgressBar();
        if(delta > 0 && navigator.vibrate) navigator.vibrate(12);
      };

      card.querySelector('.plus-btn').addEventListener('click', (e)=>{ e.stopPropagation(); bump(1); });
      card.querySelector('.minus-btn').addEventListener('click', (e)=>{ e.stopPropagation(); bump(-1); });
      card.addEventListener('click', ()=> bump(1));
    });

    updateProgressBar();
  }

  function updateProgressBar(){
    const data = AZKAR_DATA[activeCat];
    const doneCount = data.items.filter((item,i)=> (progress[i]||0) >= item.count).length;
    document.getElementById('azkarProgressLabel').textContent = `${doneCount} / ${data.items.length}`;
    document.getElementById('azkarProgressBar').style.width = `${(doneCount/data.items.length)*100}%`;
  }

  function selectCategory(cat){
    activeCat = cat;
    renderTabs();
    renderList();
  }

  function resetActive(){
    progress = {};
    saveProgress(activeCat);
    renderList();
    showToast('تم إعادة تعيين هذا القسم');
  }

  function init(){
    renderTabs();
    bindTabs();
    renderList();
    document.getElementById('azkarResetBtn').addEventListener('click', resetActive);
  }

  return { init, selectCategory };
})();
window.AzkarModule = AzkarModule;
