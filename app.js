/* ============================================================
   ZÜRICH DASHBOARD — app.js
   APIs used (all free, no key required):
     Weather   → open-meteo.com
     Transport → transport.opendata.ch  (SBB open data)
     News      → rss2json.com + 20min.ch RSS
   ============================================================ */

'use strict';

/* ── Constants ──────────────────────────────────────────── */
const ZURICH_LAT = 47.3769;
const ZURICH_LNG = 8.5417;
const STATION    = 'Zürich HB';

const WMO_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',
  80:'🌦️',81:'🌦️',82:'⛈️',
  85:'🌨️',86:'❄️',
  95:'⛈️',96:'⛈️',99:'⛈️',
};

const WMO_DESC = {
  0:'Despejado',1:'Principalmente despejado',2:'Parcialmente nublado',3:'Nublado',
  45:'Neblina',48:'Neblina helada',
  51:'Llovizna ligera',53:'Llovizna moderada',55:'Llovizna intensa',
  61:'Lluvia ligera',63:'Lluvia moderada',65:'Lluvia intensa',
  71:'Nieve ligera',73:'Nieve moderada',75:'Nieve intensa',80:'Chubascos',
  81:'Chubascos moderados',82:'Chubascos fuertes',
  95:'Tormenta',96:'Tormenta con granizo',99:'Tormenta fuerte',
};

const LINE_COLORS = {
  S1:'#c8102e',S2:'#005eb8',S3:'#e67e22',S4:'#16a34a',S5:'#7c3aed',
  S6:'#0e7490',S7:'#92400e',S8:'#c8102e',S9:'#1d4ed8',S10:'#059669',
  S11:'#7e22ce',S12:'#0784c1',S14:'#dc2626',S15:'#059669',S16:'#d97706',
  S18:'#7c3aed',S19:'#0e7490',S24:'#c2410c',
  IC:'#eb0000',IR:'#eb0000',EC:'#eb0000',ICE:'#eb0000',
  RE:'#1e40af',RJ:'#e11d48',
  TGV:'#003189',
  B:'#0066cc',T:'#cc2200',
};

const DAYS_DE  = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MONTHS_DE= ['Januar','Februar','März','April','Mai','Juni',
                  'Juli','August','September','Oktober','November','Dezember'];

let currentTab         = 'departures';
let transportTimer     = null;
let refreshCountdown   = 60;
let countdownInterval  = null;

/* ── Boot ───────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  startClock();
  updateDateString();
  loadWeather();
  loadTransport();
  loadNews();
  setInterval(updateDateString, 30_000);
  setInterval(loadWeather, 10 * 60_000);   // refresh weather every 10 min
  setInterval(loadNews,    5  * 60_000);   // refresh news every 5 min
});

/* ── Theme Toggle ───────────────────────────────────────── */
function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const saved = localStorage.getItem('zurich-theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  
  btn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('zurich-theme', newTheme);
  });
}

/* ============================================================
   CLOCK
   ============================================================ */
function tickClockDirect() {
  const now = new Date();
  const h   = now.getHours() % 12;
  const m   = now.getMinutes();
  const s   = now.getSeconds();

  rotateHand('hour-hand', (h + m/60) * 30,  { cx:22, cy:22, len:8  });
  rotateHand('min-hand',  (m + s/60) * 6,   { cx:22, cy:22, len:12 });
  rotateHand('s-hour',    (h + m/60) * 30,  { cx:18, cy:18, len:7  });
  rotateHand('s-min',     (m + s/60) * 6,   { cx:18, cy:18, len:10 });
}

function rotateHand(id, deg, {cx, cy, len}) {
  const el = document.getElementById(id);
  if (!el) return;
  const r = (deg - 90) * Math.PI / 180;
  el.setAttribute('x2', (cx + Math.cos(r) * len).toFixed(2));
  el.setAttribute('y2', (cy + Math.sin(r) * len).toFixed(2));
}

// override startClock with cleaner version
function startClock() {
  tickClockDirect();
  setInterval(tickClockDirect, 1000);
}

/* ── Date string ────────────────────────────────────────── */
function updateDateString() {
  const now = new Date();
  const d   = DAYS_DE[now.getDay()];
  const day = now.getDate();
  const mon = MONTHS_DE[now.getMonth()];
  document.getElementById('date-str').textContent =
    `${d}, ${day}. ${mon} ${now.getFullYear()}`;
}

/* ============================================================
   WEATHER  (Open-Meteo, free, no key)
   ============================================================ */
async function loadWeather() {
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${ZURICH_LAT}&longitude=${ZURICH_LNG}`
    + `&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max`
    + `&current_weather=true`
    + `&wind_speed_unit=kmh`
    + `&timezone=Europe%2FZurich`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    renderWeather(data);
  } catch (e) {
    document.getElementById('wx-desc').textContent = 'Clima no disponible (sin conexión)';
  }
}

function renderWeather(data) {
  const cw   = data.current_weather;
  const d    = data.daily;
  const code = cw.weathercode;

  document.getElementById('wx-icon').textContent  = WMO_ICONS[code] ?? '🌡️';
  document.getElementById('wx-high').textContent  = `${Math.round(d.temperature_2m_max[0])}°`;
  document.getElementById('wx-low').textContent   = `${Math.round(d.temperature_2m_min[0])}°`;
  document.getElementById('wx-desc').textContent  = WMO_DESC[code] ?? 'Variable';
  document.getElementById('wx-wind-val').textContent = `${Math.round(cw.windspeed)} km/h`;

  // Forecast (next 3 days)
  const container = document.getElementById('wx-forecast');
  container.innerHTML = '';

  for (let i = 1; i <= 3; i++) {
    const date  = new Date(d.time[i] + 'T12:00:00');
    const wcode = d.weathercode[i];
    const item  = document.createElement('div');
    item.className = 'forecast-item';
    item.innerHTML = `
      <div class="forecast-day">${DAYS_DE[date.getDay()]}, ${date.getDate()}.${date.getMonth()+1}</div>
      <div class="forecast-icon">${WMO_ICONS[wcode] ?? '🌡️'}</div>
      <div class="forecast-hi">${Math.round(d.temperature_2m_max[i])}°</div>
      <div class="forecast-lo">${Math.round(d.temperature_2m_min[i])}°</div>
      <div class="forecast-wind-sm">💨 ${Math.round(d.windspeed_10m_max[i])} km/h</div>
    `;
    container.appendChild(item);
  }
}

/* ============================================================
   SBB TRANSPORT  (transport.opendata.ch)
   ============================================================ */
window.setTab = function(tab) {
  currentTab = tab;
  document.getElementById('tab-dep').classList.toggle('active', tab === 'departures');
  document.getElementById('tab-arr').classList.toggle('active', tab === 'arrivals');
  loadTransport();
};

window.loadTransport = async function() {
  resetCountdown();
  showTransportSkeleton();

  const type = currentTab === 'departures' ? 'departure' : 'arrival';
  const url  = `https://transport.opendata.ch/v1/stationboard`
    + `?station=${encodeURIComponent(STATION)}`
    + `&limit=5&type=${type}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    renderDepartures(data.stationboard ?? []);
  } catch(e) {
    document.getElementById('departures-list').innerHTML =
      `<div class="error-state">⚠️ Keine Verbindung zur SBB API.<br>Bitte Verbindung prüfen.</div>`;
  }
};

function renderDepartures(entries) {
  const list = document.getElementById('departures-list');
  list.innerHTML = '';

  if (!entries.length) {
    list.innerHTML = `<div class="error-state">Keine Verbindungen gefunden.</div>`;
    return;
  }

  const isDep = currentTab === 'departures';

  entries.slice(0, 4).forEach((e, idx) => {
    const cat      = e.category ?? '';
    const num      = e.number  ?? '';
    const lineName = cat + (num ? num : '');
    const dest     = isDep ? (e.to ?? '—') : (e.stop?.station?.name ?? '—');
    const platform = e.stop?.platform ?? '—';

    // times
    const scheduled = parseApiTime(isDep ? e.stop?.departure : e.stop?.arrival);
    const prognosis  = parseApiTime(isDep
      ? e.stop?.prognosis?.departure
      : e.stop?.prognosis?.arrival);

    const displayTime  = prognosis ?? scheduled ?? '—:—';
    const isDelayed    = prognosis && scheduled && prognosis !== scheduled;
    const isOnTime     = prognosis && !isDelayed;

    let statusText  = '—';
    let statusClass = 'unknown';
    if (isOnTime)  { statusText = 'Pünktlich';  statusClass = 'on-time'; }
    if (isDelayed) { statusText = `+${minuteDiff(scheduled, prognosis)} min`; statusClass = 'delayed'; }

    const color    = getLineColor(cat, num);
    const row      = document.createElement('div');
    row.className  = 'dep-row';
    row.style.setProperty('--row-delay', `${idx * 40}ms`);
    row.style.animationDelay = `${idx * 40}ms`;

    row.innerHTML = `
      <div class="line-badge" style="background:${color};">${escHtml(lineName || cat)}</div>
      <div class="dep-info">
        <div class="dep-destination">${escHtml(dest)}</div>
        <div class="dep-platform">Gleis ${escHtml(String(platform))}</div>
      </div>
      <div class="dep-time-wrap">
        <div class="dep-time">${displayTime}</div>
        <div class="dep-status ${statusClass}">${statusText}</div>
      </div>
    `;
    list.appendChild(row);
  });

  updateLastUpdate();
}

function showTransportSkeleton() {
  const list = document.getElementById('departures-list');
  list.innerHTML = Array(4).fill('<div class="skeleton-row"></div>').join('');
}

function parseApiTime(raw) {
  if (!raw) return null;
  // Format: "2024-08-06T14:05:00+0200"  or  "2024-08-06T14:05:00+02:00"
  try {
    const d = new Date(raw);
    if (isNaN(d)) return null;
    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    return `${h}:${m}`;
  } catch { return null; }
}

function minuteDiff(t1, t2) {
  // "HH:MM" strings
  try {
    const [h1,m1] = t1.split(':').map(Number);
    const [h2,m2] = t2.split(':').map(Number);
    return Math.abs((h2*60+m2) - (h1*60+m1));
  } catch { return '?'; }
}

function getLineColor(cat, num) {
  const full = (cat + num).toUpperCase();
  for (const [key, color] of Object.entries(LINE_COLORS)) {
    if (full.startsWith(key)) return color;
  }
  // fallback by category
  if (['IC','IR','EC','ICE','RJ','TGV'].includes(cat)) return '#eb0000';
  if (cat === 'S')  return '#1d4ed8';
  if (cat === 'RE') return '#1e40af';
  if (cat === 'T')  return '#cc2200';
  if (cat === 'B')  return '#0066cc';
  return '#4f8ef7';
}

/* ── Countdown ──────────────────────────────────────────── */
function resetCountdown() {
  clearInterval(countdownInterval);
  refreshCountdown = 60;
  updateCountdownUI();
  countdownInterval = setInterval(() => {
    refreshCountdown--;
    if (refreshCountdown <= 0) {
      loadTransport();
    } else {
      updateCountdownUI();
    }
  }, 1000);
}

function updateCountdownUI() {
  const el = document.getElementById('refresh-info');
  if (el) el.textContent = `Aktualisierung in ${refreshCountdown}s`;
}

/* ============================================================
   NEWS  — 20 Minuten Zürich
   Strategy: show mocked instantly, upgrade to real if available
   ============================================================ */
const NEWS_RSS = 'https://www.20min.ch/rss/rss.tmpl?Type=cat&ID=9'; // Zürich

async function loadNews() {
  // Always show mocked headlines immediately — never blank
  renderNewsMocked();

  const ENC = encodeURIComponent(NEWS_RSS);

  // 1. Try rss2json (structured JSON, best option)
  try {
    const res  = await fetchWithTimeout(
      `https://api.rss2json.com/v1/api.json?rss_url=${ENC}&count=6`, 7000);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length >= 1) {
        renderNews(data.items);
        return;
      }
    }
  } catch (e) { /* network error or timeout — try next */ }

  // 2. Try allorigins.win (CORS proxy for raw XML)
  try {
    const res  = await fetchWithTimeout(
      `https://api.allorigins.win/get?url=${ENC}`, 7000);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.contents === 'string' && data.contents.includes('<item>')) {
        const items = parseRSS(data.contents);
        if (items.length >= 1) { renderNews(items); return; }
      }
    }
  } catch (e) { /* ignore */ }

  // 3. Try corsproxy.io
  try {
    const res  = await fetchWithTimeout(
      `https://corsproxy.io/?${ENC}`, 7000);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<item>')) {
        const items = parseRSS(text);
        if (items.length >= 1) { renderNews(items); return; }
      }
    }
  } catch (e) { /* ignore */ }

  // All live sources failed — mocked data already shown, nothing more to do
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function parseRSS(xmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlText, 'text/xml');
  const items  = [...doc.querySelectorAll('item')].slice(0, 6);
  return items.map(item => ({
    title:      stripCDATA(item.querySelector('title')?.textContent ?? ''),
    link:       item.querySelector('link')?.textContent?.trim() ?? '#',
    pubDate:    item.querySelector('pubDate')?.textContent ?? '',
    thumbnail:  item.querySelector('enclosure')?.getAttribute('url')
                ?? item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url')
                ?? null,
    categories: [...item.querySelectorAll('category')].map(c => stripCDATA(c.textContent)),
  }));
}

function stripCDATA(str) {
  if (!str) return '';
  return str.replace('<![CDATA[', '').replace(']]>', '').trim();
}

function renderNews(items) {
  // Guard: never clear existing content with an empty array
  if (!items || !items.length) return;

  // Filter out to specifically find "Politik" and "Sport", limit to 2 total.
  // If not found in live feed, fall back to mocked ones.
  let politikMatch = items.find(i => i.categories?.some(c => c.toLowerCase().includes('politik')));
  let sportMatch   = items.find(i => i.categories?.some(c => c.toLowerCase().includes('sport')));

  const mockP = { title: 'Zürcher Kantonsrat diskutiert Wohnungsmangel', cat: 'Politik', icon: '🏛️', time: 'vor 1 Std.' };
  const mockS = { title: 'FCZ gewinnt Lokalderby gegen GC mit 2:1', cat: 'Sport', icon: '⚽', time: 'vor 2 Std.' };

  const finalItems = [
    politikMatch || { ...mockP, isMock: true },
    sportMatch   || { ...mockS, isMock: true }
  ];

  const list = document.getElementById('news-list');
  list.innerHTML = '';

  finalItems.forEach((item, idx) => {
    const title = item.title ?? '';
    const link  = item.link  ?? '#';
    const cat   = item.cat ?? item.categories?.[0] ?? 'Zürich';
    const thumb = item.thumbnail ?? null;
    const pub   = item.time ?? (item.pubDate ? timeAgo(new Date(item.pubDate)) : '');

    const a = document.createElement('a');
    a.className = 'news-item';
    a.href      = link;
    if (!item.isMock) {
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
    }
    a.style.animationDelay = `${idx * 50}ms`;

    let thumbHtml;
    if (item.isMock) {
      thumbHtml = `<div class="news-thumb"><div class="news-thumb-placeholder">${item.icon}</div></div>`;
    } else {
      thumbHtml = thumb
        ? `<div class="news-thumb"><img src="${escHtml(thumb)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=news-thumb-placeholder>📰</div>'"/></div>`
        : `<div class="news-thumb"><div class="news-thumb-placeholder">📰</div></div>`;
    }

    a.innerHTML = `
      ${thumbHtml}
      <div class="news-body">
        <span class="news-category">${escHtml(String(cat).slice(0,20))}</span>
        <span class="news-title">${escHtml(title)}</span>
        <span class="news-time">${pub}</span>
      </div>
    `;
    list.appendChild(a);
  });

  updateLastUpdate();
}

function renderNewsMocked() {
  const mockP = { title: 'Zürcher Kantonsrat diskutiert Wohnungsmangel', cat: 'Politik', icon: '🏛️', time: 'vor 1 Std.' };
  const mockS = { title: 'FCZ gewinnt Lokalderby gegen GC mit 2:1', cat: 'Sport', icon: '⚽', time: 'vor 2 Std.' };
  
  const finalItems = [mockP, mockS];
  const list = document.getElementById('news-list');
  list.innerHTML = '';
  
  finalItems.forEach((n, idx) => {
    const a = document.createElement('a');
    a.className = 'news-item';
    a.href = '#';
    a.style.animationDelay = `${idx * 50}ms`;
    a.innerHTML = `
      <div class="news-thumb"><div class="news-thumb-placeholder">${n.icon}</div></div>
      <div class="news-body">
        <span class="news-category">${escHtml(n.cat)}</span>
        <span class="news-title">${escHtml(n.title)}</span>
        <span class="news-time">${n.time}</span>
      </div>
    `;
    list.appendChild(a);
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function timeAgo(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const diff = Math.round((Date.now() - date) / 60000);
  if (diff < 1)   return 'gerade eben';
  if (diff < 60)  return `vor ${diff} Min.`;
  const h = Math.round(diff / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h/24)} Tag(en)`;
}

function updateLastUpdate() {
  const el = document.getElementById('last-update');
  if (!el) return;
  const now = new Date();
  el.textContent = `Stand: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')} Uhr`;
}
