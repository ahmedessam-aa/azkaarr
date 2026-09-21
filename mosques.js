'use strict';

const MosquesModule = (()=>{
  let userLat = null, userLon = null;

  function toRad(d){ return d * Math.PI / 180; }

  function haversineKm(lat1, lon1, lat2, lon2){
    const R = 6371;
    const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function bearing(lat1, lon1, lat2, lon2){
    const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2-lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    return (Math.atan2(y,x) * 180/Math.PI + 360) % 360;
  }

  function bearingToArabicDirection(deg){
    const dirs = ['الشمال','شمال شرق','الشرق','جنوب شرق','الجنوب','جنوب غرب','الغرب','شمال غرب'];
    return dirs[Math.round(deg / 45) % 8];
  }

  async function search(){
    const list = document.getElementById('mosquesList');
    list.innerHTML = `<div class="state-msg"><div class="spin"></div>جارِ تحديد موقعك والبحث عن أقرب المساجد…</div>`;

    try{
      const coords = await getCoords();
      userLat = coords.lat; userLon = coords.lon;

      const radius = 3000; // متر
      const query = `[out:json][timeout:20];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${userLat},${userLon});way["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${userLat},${userLon}););out center 30;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });
      if(!res.ok) throw new Error('overpass failed');
      const json = await res.json();

      const mosques = json.elements.map(el => {
        const lat = el.lat || (el.center && el.center.lat);
        const lon = el.lon || (el.center && el.center.lon);
        if(lat == null || lon == null) return null;
        return {
          name: (el.tags && el.tags.name) || 'مسجد',
          lat, lon,
          distKm: haversineKm(userLat, userLon, lat, lon),
          bear: bearing(userLat, userLon, lat, lon)
        };
      }).filter(Boolean).sort((a,b)=> a.distKm - b.distKm).slice(0, 20);

      renderList(mosques);
    }catch(e){
      list.innerHTML = `<div class="state-msg">تعذّر البحث عن المساجد القريبة — تحقق من إذن الموقع والاتصال بالإنترنت.
        <br><button class="btn btn-outline btn-block" id="mosquesRetryBtn" style="margin-top:14px;max-width:220px;margin-inline:auto;">إعادة المحاولة</button></div>`;
      document.getElementById('mosquesRetryBtn')?.addEventListener('click', search);
    }
  }

  function getCoords(){
    return new Promise((resolve, reject)=>{
      if(window.PrayerModule && PrayerModule.getCoords()){
        resolve(PrayerModule.getCoords());
        return;
      }
      if(!('geolocation' in navigator)){ reject(); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => reject(),
        { enableHighAccuracy:false, timeout:8000, maximumAge:600000 }
      );
    });
  }

  function renderList(mosques){
    const list = document.getElementById('mosquesList');
    if(!mosques.length){
      list.innerHTML = `<div class="state-msg">مفيش مساجد مسجّلة على الخريطة في نطاق 3 كم حواليك — جرّب توسيع البحث من موقع تاني.</div>`;
      return;
    }
    list.innerHTML = mosques.map(m => `
      <div class="mosque-card">
        <div class="mosque-info">
          <b>${m.name}</b>
          <span>${m.distKm < 1 ? Math.round(m.distKm*1000)+' متر' : m.distKm.toFixed(1)+' كم'} — جهة ${bearingToArabicDirection(m.bear)}</span>
        </div>
        ${Favorites.btn({ id:`mosque:${m.lat.toFixed(4)},${m.lon.toFixed(4)}`, type:'mosque', title:m.name, sub:`${m.distKm < 1 ? Math.round(m.distKm*1000)+' متر' : m.distKm.toFixed(1)+' كم'}`, data:{ url:`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}` } })}
        <a class="mosque-route-btn" href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          الطريق
        </a>
      </div>
    `).join('');
  }

  let initialized = false;
  function onEnter(){
    if(!initialized){
      initialized = true;
    }
    search();
  }

  return { onEnter };
})();
window.MosquesModule = MosquesModule;
