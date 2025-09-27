// assets/js/checkout.js
(() => {
  const API_BASE = 'http://localhost:4000/api';

  // ====== Helpers ======
  const $ = (id) => document.getElementById(id);
  const fmtMoney = (v) => (Number(v) || 0).toFixed(2).replace('.', ',') + ' €';
  const toNum = (v) => Number(v || 0);

  function getSavedMode() {
    try { return JSON.parse(localStorage.getItem('campania-mode-confirmed') || 'null'); }
    catch { return null; }
  }
  function getDeliveryRule() {
    try { return JSON.parse(localStorage.getItem('campania-delivery-rule') || 'null'); }
    catch { return null; }
  }

  // Versuche Cart-Items aus möglichem State zu holen (kompatibel zu deinem cart.js)
  function getCartItems() {
    try {
      // Falls dein cart.js etwas global anbietet
      if (window.Cart && typeof window.Cart.getItems === 'function') {
        return window.Cart.getItems() || [];
      }
    } catch {}
    // Fallback: häufig genutzte Keys testen
    const keys = ['campania-cart', 'cart', 'cartItems'];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Varianten abfangen: {items:[]} oder direkt []
          if (Array.isArray(parsed)) return parsed;
          if (parsed && Array.isArray(parsed.items)) return parsed.items;
        }
      } catch {}
    }
    return [];
  }

  function computeTotals(items, rule, mode) {
    const subtotal = items.reduce((s, it) => s + toNum(it.price) * toNum(it.qty), 0);
    let deliveryFee = 0;
    let belowMbw = false;

    if (mode === 'delivery' && rule) {
      const mbw = toNum(rule.mbw);
      const freeFrom = toNum(rule.free_from);
      const fee = toNum(rule.fee);

      if (mbw > 0 && subtotal < mbw) belowMbw = true;
      deliveryFee = (freeFrom > 0 && subtotal >= freeFrom) ? 0 : fee;
    }

    const total = subtotal + deliveryFee;
    return { subtotal, deliveryFee, total, belowMbw };
  }

  function sanitizeEmail(v) {
    return String(v || '').trim();
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizeEmail(v));
  }
  function isValidZip(v) {
    return /^\d{5}$/.test(String(v || '').trim());
  }

  // ====== UI Elemente aus kasse.html ======
  const step1 = $('step1');
  const step2 = $('step2');
  const step3 = $('step3');

  const modeField = $('modeField');
  const deliveryFields = $('deliveryFields');

  const street = $('street');
  const zip = $('zip');
  const city = $('city');
  const info = $('info');

  const email = $('email');
  const phone = $('phone');
  const note = $('note');

  const btnToStep2 = $('toStep2');
  const btnBackTo1 = $('backTo1');
  const btnToStep3 = $('toStep3');
  const chkAgb = $('agb');
  const btnPlaceOrder = $('placeOrder');

  const orderSummary = $('orderSummary');
  const orderResult = $('orderResult');

  // ====== State ======
  let mode = 'pickup';         // default
  let rule = null;             // { zip, mbw, fee, free_from }
  let items = [];

  // ====== Init ======
  function initFromStorage() {
    const saved = getSavedMode();
    mode = saved?.mode === 'delivery' ? 'delivery' : 'pickup';
    rule = getDeliveryRule();
    items = getCartItems();

    // UI Modus
    modeField.value = mode === 'delivery' ? 'Lieferung' : 'Abholung';
    if (mode === 'delivery') {
      deliveryFields.style.display = '';
      // Vorbelegen der PLZ, falls vorhanden
      if (saved?.zip) { zip.value = saved.zip; }
      if (!city.value) { city.value = 'Braunschweig'; }
    } else {
      deliveryFields.style.display = 'none';
    }
  }

  // ====== Schrittwechsel ======
  function showStep(n) {
    step1.style.display = (n === 1) ? '' : 'none';
    step2.style.display = (n === 2) ? '' : 'none';
    step3.style.display = (n === 3) ? '' : 'none';
  }

  // ====== Validierungen ======
  function validateStep1() {
    // Email Pflicht
    if (!isValidEmail(email.value)) {
      alert('Bitte eine gültige E-Mail-Adresse eingeben.');
      email.focus();
      return false;
    }
    if (mode === 'delivery') {
      if (!street.value.trim()) {
        alert('Bitte Straße & Hausnummer angeben.');
        street.focus();
        return false;
      }
      if (!isValidZip(zip.value)) {
        alert('Bitte eine gültige PLZ (5 Ziffern) eingeben.');
        zip.focus();
        return false;
      }
      if (!city.value.trim()) {
        alert('Bitte Ort angeben.');
        city.focus();
        return false;
      }
      // Mindestbestellwert prüfen (auf Basis aktueller Items)
      const t = computeTotals(items, rule, mode);
      if (t.belowMbw) {
        alert(`Mindestbestellwert nicht erreicht. Bitte weitere Artikel hinzufügen.`);
        return false;
      }
    }
    return true;
  }

  function renderOverview() {
    if (!orderSummary) return;

    const t = computeTotals(items, rule, mode);

    const lines = [];

    // Artikelauflistung
    if (!items.length) {
      lines.push('<p>Dein Warenkorb ist leer.</p>');
    } else {
      const list = items.map(it => {
        const name = it.name || 'Artikel';
        const size = it.size ? ` (${it.size})` : '';
        const ex = (it.extras && it.extras.length) ? ` <span class="muted">+ ${it.extras.join(', ')}</span>` : '';
        const rowSum = toNum(it.price) * toNum(it.qty);
        return `<div class="row">
          <span>${toNum(it.qty)}× ${name}${size}${ex}</span>
          <span>${fmtMoney(rowSum)}</span>
        </div>`;
      }).join('');
      lines.push(`<div class="card surface pad-16 stack-8">${list}</div>`);
    }

    // Adresse/Kontakt (Kurzfassung)
    const addr = (mode === 'delivery')
      ? `<div class="row"><span>Lieferadresse</span><span>${street.value || ''}, ${zip.value || ''} ${city.value || ''}${info.value ? (' – ' + info.value) : ''}</span></div>`
      : `<div class="row"><span>Modus</span><span>Abholung</span></div>`;

    const contact = `<div class="row"><span>Kontakt</span><span>${email.value}${phone.value ? (' – ' + phone.value) : ''}</span></div>`;

    // Summen
    const totalsHtml = `
      <div class="row"><span>Zwischensumme</span><span>${fmtMoney(t.subtotal)}</span></div>
      ${mode === 'delivery' && rule ? `<div class="row"><span>Liefergebühr (${rule.zip})</span><span>${fmtMoney(t.deliveryFee)}</span></div>` : ''}
      <div class="row total"><span>Gesamt</span><span>${fmtMoney(t.total)}</span></div>
      ${mode === 'delivery' && rule && toNum(rule.free_from) > 0
        ? `<div class="hint">Gratis Lieferung ab ${fmtMoney(rule.free_from)}.</div>` : ''
      }
    `;

    // Mindestbestellwert Hinweis
    const mbwHint = (mode === 'delivery' && rule && t.belowMbw)
      ? `<div class="error" role="alert">Mindestbestellwert ${fmtMoney(rule.mbw)} nicht erreicht.</div>`
      : '';

    orderSummary.innerHTML = `
      <div class="stack-12">
        ${addr}
        ${contact}
        ${note.value ? `<div class="row"><span>Hinweis</span><span>${note.value}</span></div>` : ''}
        <hr/>
        ${totalsHtml}
        ${mbwHint}
      </div>
    `;

    // Button "Zur Bestellung" nur aktivieren, wenn AGB akzeptiert und MBW erfüllt
    const canProceed = (!t.belowMbw) && !!chkAgb?.checked && items.length > 0;
    btnToStep3.setAttribute('aria-disabled', String(!canProceed));
    btnToStep3.disabled = !canProceed;
  }

  async function placeOrder() {
    // Final prüfen
    const t = computeTotals(items, rule, mode);
    if (!items.length) { alert('Warenkorb ist leer.'); return; }
    if (mode === 'delivery' && t.belowMbw) { alert('Mindestbestellwert nicht erreicht.'); return; }

    const body = {
      mode,
      customer: {
        email: sanitizeEmail(email.value),
        phone: String(phone.value || '').trim()
      },
      address: (mode === 'delivery') ? {
        street: String(street.value || '').trim(),
        zip: String(zip.value || '').trim(),
        city: String(city.value || '').trim(),
        info: String(info.value || '').trim()
      } : {},
      note: String(note.value || '').trim(),
      items: items.map(it => ({
        name: it.name,
        qty: toNum(it.qty),
        price: toNum(it.price),
        size: it.size || null,
        extras: Array.isArray(it.extras) ? it.extras : []
      })),
      totals: {
        subtotal: t.subtotal,
        delivery_fee: t.deliveryFee,
        total: t.total,
        currency: 'EUR',
        zip_rule: mode === 'delivery' ? (rule || null) : null
      }
    };

    try {
      btnPlaceOrder.disabled = true;
      btnPlaceOrder.setAttribute('aria-disabled', 'true');

      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || ('Fehler ' + res.status));
      }

      // Erfolg
      orderResult.innerHTML = `
        <div class="notice" role="status">
          ✅ Danke! Deine Bestellung wurde aufgenommen.<br/>
          <strong>Bestellnummer:</strong> ${json.orderId || '—'}
        </div>
      `;

      // Optional: Warenkorb leeren (falls dein cart.js einen Hook hat, sonst localStorage versuchen)
      try {
        if (window.Cart && typeof window.Cart.clear === 'function') {
          window.Cart.clear();
        } else {
          // häufige Keys leeren
          ['campania-cart','cart','cartItems'].forEach(k => localStorage.removeItem(k));
        }
      } catch {}

    } catch (e) {
      console.error(e);
      orderResult.innerHTML = `<div class="error" role="alert">❌ Bestellung fehlgeschlagen: ${e.message || e}</div>`;
    } finally {
      btnPlaceOrder.disabled = false;
      btnPlaceOrder.setAttribute('aria-disabled', 'false');
    }
  }

  // ====== Events ======
  window.addEventListener('DOMContentLoaded', () => {
    initFromStorage();
    showStep(1);

    // Schritt 1 → Schritt 2
    btnToStep2?.addEventListener('click', () => {
      if (!validateStep1()) return;
      showStep(2);
      renderOverview();
    });

    // AGB Toggle
    chkAgb?.addEventListener('change', () => {
      // in Schritt 2 aktualisieren
      renderOverview();
    });

    // Zurück zu Schritt 1
    btnBackTo1?.addEventListener('click', () => {
      showStep(1);
    });

    // Schritt 2 → Schritt 3
    btnToStep3?.addEventListener('click', () => {
      // Sicherheitscheck
      const t = computeTotals(items, rule, mode);
      if (mode === 'delivery' && t.belowMbw) {
        alert('Mindestbestellwert nicht erreicht.');
        return;
      }
      if (!chkAgb?.checked) {
        alert('Bitte AGB akzeptieren.');
        return;
      }
      showStep(3);
    });

    // Bestellung absenden
    btnPlaceOrder?.addEventListener('click', placeOrder);

    // Falls sich währenddessen die Regel ändert (z. B. Nutzer geht zurück zur Startseite in neuem Tab)
    window.addEventListener('campania:delivery-rule', (e) => {
      rule = e?.detail || getDeliveryRule();
      if (step2.style.display !== 'none') renderOverview();
    });
    window.addEventListener('campania:delivery-rule-cleared', () => {
      rule = null;
      if (step2.style.display !== 'none') renderOverview();
    });
  });
})();
