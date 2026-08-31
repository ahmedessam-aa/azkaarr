'use strict';

/* ============ قصص الأنبياء ============ */
const ProphetsModule = (()=>{
  let loaded = false;

  function render(){
    const list = document.getElementById('prophetsList');
    list.innerHTML = PROPHETS_DATA.map((p, i) => `
      <div class="prophet-card" data-i="${i}">
        <button class="prophet-head">
          <div class="prophet-name-wrap">
            <b>${p.name}</b>
            <span>${p.title}</span>
          </div>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="prophet-body">
          <p>${p.summary}</p>
          <span class="prophet-surahs">أهم السور: ${p.surahs}</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.prophet-card').forEach(card=>{
      card.querySelector('.prophet-head').addEventListener('click', ()=>{
        card.classList.toggle('open');
      });
    });
  }

  function onEnter(){
    if(!loaded){ loaded = true; render(); }
  }
  return { onEnter };
})();
window.ProphetsModule = ProphetsModule;

/* ============ السيرة النبوية ============ */
const SeerahModule = (()=>{
  let loaded = false;
  let activeEra = 0;

  function renderTabs(){
    const tabs = document.getElementById('seerahTabs');
    tabs.innerHTML = SEERAH_DATA.map((e,i)=> `
      <button class="azkar-tab ${i===activeEra?'active':''}" data-i="${i}">${e.era}</button>
    `).join('');
    tabs.querySelectorAll('.azkar-tab').forEach(tab=>{
      tab.addEventListener('click', ()=>{
        activeEra = parseInt(tab.dataset.i,10);
        renderTabs();
        renderTimeline();
      });
    });
  }

  function renderTimeline(){
    const wrap = document.getElementById('seerahTimeline');
    const items = SEERAH_DATA[activeEra].items;
    wrap.innerHTML = items.map((it, i) => `
      <div class="seerah-item">
        <div class="seerah-dot-col">
          <span class="seerah-dot"></span>
          ${i < items.length-1 ? '<span class="seerah-line"></span>' : ''}
        </div>
        <div class="seerah-content">
          <span class="seerah-year">${it.year}</span>
          <h4>${it.title}</h4>
          <p>${it.text}</p>
        </div>
      </div>
    `).join('');
  }

  function onEnter(){
    if(!loaded){
      loaded = true;
      renderTabs();
      renderTimeline();
    }
  }
  return { onEnter };
})();
window.SeerahModule = SeerahModule;

/* ============ دليل الفتوى ============ */
const FatwaModule = (()=>{
  let loaded = false;
  function render(){
    const wrap = document.getElementById('fatwaList');
    wrap.innerHTML = FATWA_SOURCES.map(cat => `
      <div class="section-title" style="margin-top:18px;"><h2>${cat.category}</h2></div>
      <div class="fatwa-grid">
        ${cat.items.map(it => `
          <a class="fatwa-card" href="${it.url}" target="_blank" rel="noopener">
            <div class="fatwa-card-txt">
              <b>${it.name}</b>
              <span>${it.desc}</span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
          </a>
        `).join('')}
      </div>
    `).join('');
  }
  function onEnter(){
    if(!loaded){ loaded = true; render(); }
  }
  return { onEnter };
})();
window.FatwaModule = FatwaModule;
