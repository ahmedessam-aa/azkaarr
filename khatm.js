'use strict';

const KhatmModule = (()=>{
  const TOTAL_PAGES = 604;
  const STORAGE_KEY = 'azkar_khatm_plan';
  let plan = null;

  function loadPlan(){
    const raw = localStorage.getItem(STORAGE_KEY);
    plan = raw ? JSON.parse(raw) : null;
  }
  function savePlan(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }

  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysBetween(iso1, iso2){
    const a = new Date(iso1 + 'T00:00:00');
    const b = new Date(iso2 + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function createPlan(totalDays){
    plan = {
      totalDays,
      pagesPerDay: Math.ceil(TOTAL_PAGES / totalDays),
      startDate: todayISO(),
      pagesReadSoFar: 0,
      readLog: {}   // { 'YYYY-MM-DD': pagesReadThatDay }
    };
    savePlan();
    render();
  }

  function resetPlan(){
    plan = null;
    localStorage.removeItem(STORAGE_KEY);
    render();
  }

  function daysSinceStart(){
    return Math.max(0, daysBetween(plan.startDate, todayISO()));
  }

  function currentDayNumber(){
    // اليوم اللي المستخدم واصله فعليًا حسب الصفحات المقروءة (مش التاريخ)، بحد أقصى مدة الخطة
    return Math.min(plan.totalDays, Math.floor(plan.pagesReadSoFar / plan.pagesPerDay) + 1);
  }

  function todayRange(){
    const dayNum = currentDayNumber();
    const startPage = plan.pagesReadSoFar + 1;
    const endPage = Math.min(TOTAL_PAGES, plan.pagesReadSoFar + plan.pagesPerDay);
    return { dayNum, startPage, endPage };
  }

  function isBehindSchedule(){
    const elapsed = daysSinceStart();
    const expectedPages = Math.min(TOTAL_PAGES, elapsed * plan.pagesPerDay);
    return plan.pagesReadSoFar < expectedPages;
  }

  function behindPageCount(){
    const elapsed = daysSinceStart();
    const expectedPages = Math.min(TOTAL_PAGES, elapsed * plan.pagesPerDay);
    return Math.max(0, expectedPages - plan.pagesReadSoFar);
  }

  function markTodayDone(){
    if(plan.pagesReadSoFar >= TOTAL_PAGES) return;
    const { endPage, startPage } = todayRange();
    const pagesThisTime = endPage - startPage + 1;
    plan.pagesReadSoFar = Math.min(TOTAL_PAGES, plan.pagesReadSoFar + pagesThisTime);
    plan.readLog[todayISO()] = (plan.readLog[todayISO()] || 0) + pagesThisTime;
    savePlan();
    render();
    if(plan.pagesReadSoFar >= TOTAL_PAGES){
      showToast('🎉 مبروك! ختمت القرآن الكريم كاملاً');
    } else {
      showToast('تم تسجيل قراءة اليوم، بارك الله فيك');
    }
  }

  function readNow(){
    const { startPage } = todayRange();
    if(window.QuranModule){
      QuranModule.openPage(startPage);
      navigateTo('quran');
    }
  }

  function rebalance(){
    const remainingPages = TOTAL_PAGES - plan.pagesReadSoFar;
    const remainingDays = Math.max(1, plan.totalDays - daysSinceStart());
    plan.pagesPerDay = Math.max(1, Math.ceil(remainingPages / remainingDays));
    savePlan();
    render();
    showToast('تم إعادة توزيع الصفحات المتبقية على باقي أيام الخطة');
  }

  function extendDeadline(extraDays){
    const remainingPages = TOTAL_PAGES - plan.pagesReadSoFar;
    const remainingDaysOriginal = Math.max(1, plan.totalDays - daysSinceStart());
    plan.totalDays += extraDays;
    plan.pagesPerDay = Math.max(1, Math.ceil(remainingPages / (remainingDaysOriginal + extraDays)));
    savePlan();
    render();
    showToast(`تم تمديد الخطة ${extraDays} يومًا وتخفيف الوتيرة`);
  }

  /* ---------------- rendering ---------------- */
  function render(){
    const setupView = document.getElementById('khatmSetupView');
    const activeView = document.getElementById('khatmActiveView');

    if(!plan){
      setupView.style.display = 'block';
      activeView.style.display = 'none';
      return;
    }
    setupView.style.display = 'none';
    activeView.style.display = 'block';

    const finished = plan.pagesReadSoFar >= TOTAL_PAGES;
    const pct = Math.round((plan.pagesReadSoFar / TOTAL_PAGES) * 100);
    const remainingPages = TOTAL_PAGES - plan.pagesReadSoFar;
    const { dayNum, startPage, endPage } = todayRange();
    const behind = !finished && isBehindSchedule();
    const behindPages = behindPageCount();

    document.getElementById('khatmProgressPct').textContent = `${pct}%`;
    document.getElementById('khatmProgressBar').style.width = `${pct}%`;
    document.getElementById('khatmPagesRemaining').textContent = remainingPages;
    document.getElementById('khatmDaysLabel').textContent = finished ? 'اكتملت الخطة 🎉' : `اليوم ${dayNum} من ${plan.totalDays}`;

    const todayCard = document.getElementById('khatmTodayCard');
    if(finished){
      todayCard.innerHTML = `
        <div class="khatm-done-badge">🎉 ختمت القرآن الكريم كاملاً — تقبّل الله منك</div>
        <button class="btn btn-outline btn-block" id="khatmNewPlanBtn">ابدأ ختمة جديدة</button>
      `;
      document.getElementById('khatmNewPlanBtn')?.addEventListener('click', resetPlan);
    } else {
      todayCard.innerHTML = `
        <span class="hifz-ayah-badge">وِرد اليوم</span>
        <div class="khatm-page-range">من صفحة ${startPage} إلى صفحة ${endPage}</div>
        <div class="khatm-today-btns">
          <button class="btn btn-outline" id="khatmReadBtn">📖 اقرأ الآن</button>
          <button class="btn btn-gold" id="khatmDoneBtn">✅ تم القراءة</button>
        </div>
      `;
      document.getElementById('khatmReadBtn').addEventListener('click', readNow);
      document.getElementById('khatmDoneBtn').addEventListener('click', markTodayDone);
    }

    const behindBanner = document.getElementById('khatmBehindBanner');
    if(behind){
      behindBanner.style.display = 'block';
      behindBanner.innerHTML = `
        <p>⏳ انت متأخر عن الخطة بحوالي ${behindPages} صفحة. تقدر تعيد توزيع الباقي على الأيام المتبقية، أو تمدد الخطة كام يوم.</p>
        <div class="khatm-today-btns">
          <button class="btn btn-outline" id="khatmRebalanceBtn">أعد توزيع الأيام المتبقية</button>
          <button class="btn btn-outline" id="khatmExtendBtn">مدّ الخطة ٧ أيام</button>
        </div>
      `;
      document.getElementById('khatmRebalanceBtn').addEventListener('click', rebalance);
      document.getElementById('khatmExtendBtn').addEventListener('click', ()=> extendDeadline(7));
    } else {
      behindBanner.style.display = 'none';
    }

    document.getElementById('khatmPagesPerDay').textContent = plan.pagesPerDay;
    document.getElementById('khatmResetBtn2').onclick = ()=>{
      if(confirm('هل تريد إلغاء الخطة الحالية والبدء من جديد؟')) resetPlan();
    };
  }

  function initSetup(){
    document.querySelectorAll('.khatm-duration-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const days = parseInt(btn.dataset.days, 10);
        if(days) createPlan(days);
      });
    });
    document.getElementById('khatmCustomBtn').addEventListener('click', ()=>{
      const val = parseInt(document.getElementById('khatmCustomDays').value, 10);
      if(val && val > 0) createPlan(val);
      else showToast('اكتب عدد أيام صحيح');
    });
  }

  let initialized = false;
  function onEnter(){
    if(!initialized){
      initialized = true;
      initSetup();
    }
    loadPlan();
    render();
  }

  return { onEnter };
})();
window.KhatmModule = KhatmModule;
