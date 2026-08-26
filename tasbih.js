'use strict';

const TasbihModule = (()=>{
  let current = 0;
  let total = 0;
  let sessions = 0;
  let todayCount = 0;
  let todayDate = '';
  let selectedDhikr = 'سبحان الله';
  let vibrateOn = true;

  const els = {};

  function todayStr(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  function load(){
    current = parseInt(localStorage.getItem('azkar_tasbih_current') || '0', 10);
    total = parseInt(localStorage.getItem('azkar_tasbih_total') || '0', 10);
    sessions = parseInt(localStorage.getItem('azkar_tasbih_sessions') || '0', 10);
    selectedDhikr = localStorage.getItem('azkar_tasbih_dhikr') || 'سبحان الله';
    vibrateOn = localStorage.getItem('tasbih_vibrate') !== '0';

    const savedToday = localStorage.getItem('azkar_tasbih_today');
    if(savedToday){
      const obj = JSON.parse(savedToday);
      if(obj.date === todayStr()){
        todayCount = obj.count;
        todayDate = obj.date;
      } else {
        todayCount = 0;
        todayDate = todayStr();
      }
    } else {
      todayCount = 0;
      todayDate = todayStr();
    }
  }

  function persist(){
    localStorage.setItem('azkar_tasbih_current', String(current));
    localStorage.setItem('azkar_tasbih_total', String(total));
    localStorage.setItem('azkar_tasbih_sessions', String(sessions));
    localStorage.setItem('azkar_tasbih_dhikr', selectedDhikr);
    localStorage.setItem('azkar_tasbih_today', JSON.stringify({date: todayDate, count: todayCount}));
  }

  function render(){
    els.count.textContent = current;
    els.currentDhikr.textContent = selectedDhikr;
    els.statToday.textContent = todayCount;
    els.statTotal.textContent = total;
    els.statSessions.textContent = sessions;
    document.querySelectorAll('.dhikr-chip').forEach(chip=>{
      chip.classList.toggle('active', chip.dataset.dhikr === selectedDhikr);
    });
    els.vibrateLabel.textContent = `الاهتزاز: ${vibrateOn ? 'تشغيل' : 'إيقاف'}`;
  }

  function increment(){
    if(todayDate !== todayStr()){ todayDate = todayStr(); todayCount = 0; }
    current++;
    total++;
    todayCount++;
    persist();
    render();
    if(vibrateOn && navigator.vibrate) navigator.vibrate(18);
    els.ring.style.transform = 'scale(0.96)';
    setTimeout(()=> els.ring.style.transform = '', 110);
  }

  function reset(){
    if(current > 0) sessions++;
    current = 0;
    persist();
    render();
    showToast('تم تصفير العداد');
  }

  function setDhikr(label){
    selectedDhikr = label;
    persist();
    render();
  }

  function setVibrate(on){
    vibrateOn = on;
    render();
  }

  function init(){
    els.ring = document.getElementById('tasbihRing');
    els.count = document.getElementById('tasbihCount');
    els.currentDhikr = document.getElementById('tasbihCurrentDhikr');
    els.statToday = document.getElementById('statToday');
    els.statTotal = document.getElementById('statTotal');
    els.statSessions = document.getElementById('statSessions');
    els.vibrateLabel = document.getElementById('vibrateLabel');

    load();
    render();

    els.ring.addEventListener('click', increment);
    document.getElementById('tasbihResetBtn').addEventListener('click', reset);
    document.getElementById('tasbihVibrateBtn').addEventListener('click', ()=>{
      vibrateOn = !vibrateOn;
      localStorage.setItem('tasbih_vibrate', vibrateOn ? '1' : '0');
      const el = document.getElementById('toggleVibrate');
      if(el) el.checked = vibrateOn;
      render();
    });
    document.querySelectorAll('.dhikr-chip').forEach(chip=>{
      chip.addEventListener('click', ()=> setDhikr(chip.dataset.dhikr));
    });
  }

  return { init, setVibrate };
})();
window.TasbihModule = TasbihModule;
