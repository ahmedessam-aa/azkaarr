'use strict';

const QiblaModule = (()=>{
  const KAABA_LAT = 21.4225;
  const KAABA_LON = 39.8262;
  let qiblaBearing = null;
  let compassActive = false;
  let currentHeading = 0;

  function toRad(d){ return d * Math.PI / 180; }
  function toDeg(r){ return r * 180 / Math.PI; }

  function computeBearing(lat1, lon1){
    const φ1 = toRad(lat1), φ2 = toRad(KAABA_LAT);
    const Δλ = toRad(KAABA_LON - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    let θ = toDeg(Math.atan2(y, x));
    return (θ + 360) % 360;
  }

  function haversineKm(lat1, lon1, lat2, lon2){
    const R = 6371;
    const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function updateCompassVisual(){
    const needle = document.getElementById('qiblaNeedle');
    const ring = document.getElementById('qiblaRing');
    if(!needle) return;
    if(compassActive){
      // الإبرة ثابتة على اتجاه القبلة، والدائرة نفسها بتلف عكس اتجاه الجهاز عشان تحاكي بوصلة حقيقية
      ring.style.transform = `rotate(${-currentHeading}deg)`;
      needle.style.transform = `rotate(${qiblaBearing}deg)`;
    } else {
      ring.style.transform = 'rotate(0deg)';
      needle.style.transform = `rotate(${qiblaBearing}deg)`;
    }
  }

  function renderResult(lat, lon){
    qiblaBearing = computeBearing(lat, lon);
    const distKm = Math.round(haversineKm(lat, lon, KAABA_LAT, KAABA_LON));
    document.getElementById('qiblaDegree').textContent = `${Math.round(qiblaBearing)}°`;
    document.getElementById('qiblaDistance').textContent = `${distKm.toLocaleString('ar-EG')} كم من مكانك إلى الكعبة المشرفة`;
    document.getElementById('qiblaResult').style.display = 'block';
    document.getElementById('qiblaLoading').style.display = 'none';
    updateCompassVisual();
  }

  function locate(){
    document.getElementById('qiblaLoading').style.display = 'block';
    document.getElementById('qiblaResult').style.display = 'none';
    document.getElementById('qiblaError').style.display = 'none';

    if(window.PrayerModule && PrayerModule.getCoords()){
      const { lat, lon } = PrayerModule.getCoords();
      renderResult(lat, lon);
      return;
    }
    if(!('geolocation' in navigator)){
      showLocError();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => renderResult(pos.coords.latitude, pos.coords.longitude),
      () => showLocError(),
      { enableHighAccuracy:false, timeout:8000, maximumAge:600000 }
    );
  }

  function showLocError(){
    document.getElementById('qiblaLoading').style.display = 'none';
    document.getElementById('qiblaError').style.display = 'block';
  }

  /* ---------------- device compass (best-effort) ---------------- */
  function handleOrientation(e){
    let heading = null;
    if(typeof e.webkitCompassHeading === 'number'){
      heading = e.webkitCompassHeading; // iOS Safari
    } else if(e.absolute && e.alpha != null){
      heading = 360 - e.alpha; // Android Chrome (تقريبي)
    }
    if(heading == null) return;
    currentHeading = heading;
    compassActive = true;
    document.getElementById('qiblaCompassHint').textContent = 'البوصلة شغّالة — لُف بجهازك حتى يشير السهم الذهبي لأعلى';
    updateCompassVisual();
  }

  async function enableCompass(){
    try{
      if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
        const perm = await DeviceOrientationEvent.requestPermission();
        if(perm !== 'granted'){
          showToast('محتاج إذن استشعار الاتجاه عشان البوصلة الحية تشتغل');
          return;
        }
      }
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      showToast('جارِ تفعيل البوصلة الحية…');
    }catch(e){
      showToast('البوصلة الحية غير مدعومة على هذا الجهاز');
    }
  }

  let initialized = false;
  function onEnter(){
    if(!initialized){
      initialized = true;
      document.getElementById('qiblaRetryBtn').addEventListener('click', locate);
      document.getElementById('qiblaCompassBtn').addEventListener('click', enableCompass);
    }
    locate();
  }

  return { onEnter };
})();
window.QiblaModule = QiblaModule;
