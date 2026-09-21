'use strict';

/* ============ قصص الأنبياء ============ */
const ProphetsModule = (()=>{
  let loaded = false;

  function render(){
    const list = document.getElementById('prophetsList');
    list.innerHTML = PROPHETS_DATA.map((p, i) => `
      <div class="prophet-card" data-i="${i}">
        <div class="prophet-head-row">
        <button class="prophet-head">
          <div class="prophet-name-wrap">
            <span class="prophet-order">${p.order}</span>
            <div>
              <b>${p.name}</b>
              <span>${p.title}</span>
            </div>
          </div>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        ${Favorites.btn({ id:`prophet:${i}`, type:'prophet', title:p.name, text:p.summary, sub:p.title, data:{ i } })}
        </div>
        <div class="prophet-body">
          <p>${p.summary}</p>
          <span class="prophet-lineage">🔗 ${p.lineage}</span>
          <span class="prophet-surahs">📖 أهم السور: ${p.surahs}</span>
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
      <div class="seerah-item" data-i="${i}">
        <div class="seerah-dot-col">
          <span class="seerah-dot"></span>
          ${i < items.length-1 ? '<span class="seerah-line"></span>' : ''}
        </div>
        <div class="seerah-content">
          <div class="seerah-yr-row">
            <span class="seerah-year">${it.year}</span>
            ${Favorites.btn({ id:`seerah:${activeEra}:${i}`, type:'seerah', title:it.title, text:it.text, sub:[it.year, SEERAH_DATA[activeEra].era].filter(Boolean).join(' — '), data:{ era:activeEra, i } })}
          </div>
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
  // jump to a specific era / event (used by the favourites page)
  function show(era, i){
    onEnter();
    activeEra = era || 0;
    renderTabs();
    renderTimeline();
    setTimeout(()=>{
      const el = document.querySelector(`#seerahTimeline .seerah-item[data-i="${i}"]`);
      if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 320);
  }
  return { onEnter, show };
})();
window.SeerahModule = SeerahModule;

/* ============ دليل الفتوى ============ */
const FatwaModule = (()=>{
  let loaded = false;
  function render(){
    const wrap = document.getElementById('fatwaList');
    wrap.innerHTML = FATWA_SOURCES.map((cat, ci) => `
      <div class="section-title" style="margin-top:18px;"><h2>${cat.category}</h2></div>
      <div class="fatwa-grid">
        ${cat.items.map((it, ii) => `
          <div class="fatwa-item">
            <a class="fatwa-card" href="${it.url}" target="_blank" rel="noopener">
              <div class="fatwa-card-txt">
                <b>${it.name}</b>
                <span>${it.desc}</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>
            </a>
            ${Favorites.btn({ id:`fatwa:${ci}:${ii}`, type:'fatwa', title:it.name, text:it.desc, sub:cat.category, data:{ url:it.url } })}
          </div>
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

/* ============ الأدعية ============ */
const DuasModule = (()=>{
  let loaded = false;
  function render(){
    const wrap = document.getElementById('duasList');
    wrap.innerHTML = DUAS_DATA.map((cat, ci) => `
      <div class="section-title" style="margin-top:${ci===0?'0':'18px'};"><h2>${cat.icon} ${cat.category}</h2></div>
      ${cat.items.map((it, ii) => `
        <div class="prophet-card" data-cat="${ci}" data-i="${ii}">
          <div class="prophet-head-row">
          <button class="prophet-head">
            <div class="prophet-name-wrap">
              <b>دعاء ${ii+1}</b>
              <span>${it.source}</span>
            </div>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          ${Favorites.btn({ id:`dua:${ci}:${ii}`, type:'dua', title:`${cat.category} — دعاء ${ii+1}`, text:it.text, sub:it.source, data:{ ci, ii } })}
          </div>
          <div class="prophet-body">
            <p class="quran-font" style="font-size:17px; line-height:2;">${it.text}</p>
          </div>
        </div>
      `).join('')}
    `).join('');

    wrap.querySelectorAll('.prophet-card').forEach(card=>{
      card.querySelector('.prophet-head').addEventListener('click', ()=> card.classList.toggle('open'));
    });
  }
  function onEnter(){
    if(!loaded){ loaded = true; render(); }
  }
  return { onEnter };
})();
window.DuasModule = DuasModule;
