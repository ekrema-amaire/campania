// ===== Campania Admin Panel =====
const API_BASE = 'http://localhost:4000/api';
const $ = (id) => document.getElementById(id);
const msg = (t, ok = true) => { const m = $('msg'); if (!m) return; m.textContent = t || ''; m.style.color = ok ? '#333' : '#b00020'; };
const money = (v) => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';
const fmt = (ts) => { try { return new Date(ts).toLocaleString(); } catch { return ts; } };

// ===== AUDIO (WebAudio-only, mit Debug) =====
let audioCtx = null;

async function initAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      console.warn('[audio] AudioContext nicht verfügbar');
      msg('AudioContext nicht verfügbar (Browser?)', false);
      return;
    }
    if (!audioCtx) {
      audioCtx = new Ctx();
      console.log('[audio] Context erzeugt:', audioCtx.state);
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      console.log('[audio] Context resumed →', audioCtx.state);
    }
  } catch (e) {
    console.error('[audio] initAudio error', e);
  }
}

async function beep() {
  try {
    if (!audioCtx) { console.warn('[audio] kein Context (initAudio vorher klicken)'); return; }
    if (audioCtx.state === 'suspended') { await audioCtx.resume(); }

    // Deutlicher Ton: 600 ms + kurzer Sweep
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);

    // Sweep: 660 Hz → 880 Hz
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.6);

    // Lautstärke-Hüllkurve
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
    gain.gain.setValueAtTime(0.12, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);

    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch {}
      console.log('[audio] beep played');
    };
  } catch (e) {
    console.error('[audio] beep error', e);
    msg('Audio-Fehler (siehe Console)', false);
  }
}

// ===== Orders API =====
async function loadOrders() {
  const token = $('token').value.trim();
  msg('Lade …');
  try {
    const res = await fetch(`${API_BASE}/orders`, { headers: { 'x-admin-token': token } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) { msg(json?.error || ('Fehler ' + res.status), false); return; }
    render(json.data || []);
    msg('OK – ' + (json.data?.length || 0) + ' Bestellungen');
  } catch (e) {
    console.error(e);
    msg('Netzwerkfehler – läuft das Backend auf Port 4000?', false);
  }
}

async function updateStatus(id, status) {
  const token = $('token').value.trim();
  try {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ status })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) { alert(json?.error || ('Fehler ' + res.status)); return; }
    loadOrders();
  } catch (e) { console.error(e); alert('Netzwerkfehler'); }
}

function render(list) {
  const tb = $('tbody'); if (!tb) return;
  tb.innerHTML = '';
  for (const o of list) {
    const tr = document.createElement('tr');

    const itemsHtml = (o.items || []).map(it => {
      const ex = (it.extras && it.extras.length) ? ' <span class="muted">+ ' + it.extras.join(', ') + '</span>' : '';
      return `<div>${it.qty}× ${it.name}${it.size ? ' (' + it.size + ')' : ''}${ex}</div>`;
    }).join('');

    const sel = document.createElement('select');
    [['new','Neu'],['in_progress','In Arbeit'],['ready','Fertig'],['delivered','Ausgeliefert'],['cancelled','Storniert']]
      .forEach(([v, l]) => { const opt = document.createElement('option'); opt.value = v; opt.textContent = l; if (o.status === v) opt.selected = true; sel.appendChild(opt); });
    const btn = document.createElement('button'); btn.textContent = 'Speichern'; btn.onclick = () => updateStatus(o.id, sel.value);

    tr.innerHTML = `
      <td>${fmt(o.createdAt)}</td>
      <td><span class="badge">${o.id}</span></td>
      <td>${o.customer?.email || ''}<br/><span class="muted">${o.customer?.phone || ''}</span><br/>${
        o.mode === 'pickup' ? '<span class="badge">Abholung</span>' : '<span class="badge">Lieferung</span>'}</td>
      <td>${itemsHtml || '-'}</td>
      <td>${money(o.totals?.total)}</td>
      <td></td>
      <td></td>
    `;
    tr.children[5].appendChild(sel);
    tr.children[6].appendChild(btn);
    tb.appendChild(tr);
  }
}

// ===== Live-Updates: SSE mit Fallback-Polling =====
let es = null;
let pollTimer = null;

function startPolling() {
  if (pollTimer) return;
  msg('Live: Polling 5s', true);
  pollTimer = setInterval(loadOrders, 5000);
}
function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function connectStream() {
  const token = $('token').value.trim();
  if (!token) { msg('Bitte Admin-Token eingeben.'); return; }

  if (!('EventSource' in window)) { startPolling(); return; }

  if (es) { es.close(); es = null; }
  stopPolling();

  const url = `${API_BASE}/orders/stream?token=${encodeURIComponent(token)}`;
  es = new EventSource(url);

  es.addEventListener('ready', () => msg('Live verbunden (SSE)'));
  es.addEventListener('ping',  () => {/* keep-alive */});
  es.addEventListener('new-order', async (e) => {
  console.log('[live] new-order event', e?.data || '');
  try {
    await initAudio();          // Context ggf. re-aktivieren
    await beep();               // Ton abspielen
  } catch (err) {
    console.error('[live] beep failed', err);
  }
  loadOrders();                 // danach UI aktualisieren
});


  es.onerror = () => {
    console.warn('SSE getrennt – wechsle auf Polling');
    msg('SSE getrennt – Fallback Polling 5s', false);
    es && es.close(); es = null;
    startPolling();
  };
}

// ===== Boot =====
window.addEventListener('DOMContentLoaded', () => {
  $('load')?.addEventListener('click', async () => {
    // Audio beim User-Klick initialisieren
    await initAudio();

    // Debug: zeigen, ob der Browser die User-Geste erkannt hat
    try {
      const ua = navigator.userActivation;
      console.log('[audio] userActivation', ua);
    } catch {}

    loadOrders();
    connectStream();
    setInterval(() => { audioCtx?.resume?.(); }, 30000);
  });

  // Optionaler Testton-Button
  $('testBeep')?.addEventListener('click', async () => {
    await initAudio();
    beep();
  });

  // optional: ?token=... → auto, aber ohne Audio-Garantie bis zum ersten Klick
  try {
    const p = new URLSearchParams(location.search);
    const t = p.get('token');
    if (t) { $('token').value = t; loadOrders(); connectStream(); }
  } catch {}
});
