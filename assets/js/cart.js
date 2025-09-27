// assets/js/cart.js
(function () {
  const SKEY = "campania-cart";

  // ---------- Helpers ----------
  const $id = (x) => document.getElementById(x);
  const drawer      = $id("cartDrawer");
  const openBtn     = $id("openCart");
  const closeBtn    = $id("closeCart");
  const itemsEl     = $id("cartItems");
  const totalsEl    = $id("cartTotals");
  const checkoutBtn = $id("checkoutBtn");
  const continueBtn = $id("continueShopping");
  const badgeEl     = $id("cartBadge");
  const cartMsgEl   = $id("cartMessages");

  function jparse(s, fb){ try { return JSON.parse(s); } catch { return fb; } }
  function fmtMoney(v){
    const n = Number(v || 0);
    try { return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n); }
    catch { return n.toFixed(2).replace(".", ",") + " €"; }
  }
  function esc(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

  // ---------- externe Rule/Mode aus localStorage ----------
  function getSavedMode() {
    const saved = jparse(localStorage.getItem("campania-mode-confirmed"), null);
    // index.html speichert 'delivery' | 'pickup'
    if (saved?.mode === "delivery") return "lieferung";
    if (saved?.mode === "pickup")   return "abholung";
    return null;
  }
  function getDeliveryRuleLS() {
    // { zip, mbw, fee, free_from }
    return jparse(localStorage.getItem("campania-delivery-rule"), null);
  }

  // ---------- State laden & härten ----------
  let cart = (function(){
    const v = jparse(localStorage.getItem(SKEY), null);
    const base = {
      items: [],
      mode: "abholung",    // "abholung" | "lieferung"
      zip:  null,
      fees: { mbw: 0, fee: 0, free_from: 0 } // euro
    };
    if (!v || typeof v !== "object") return base;

    const items = Array.isArray(v.items) ? v.items : [];
    const mode  = (v.mode === "lieferung" || v.mode === "abholung") ? v.mode : "abholung";
    const zip   = v.zip ?? null;
    const fees  = {
      mbw: Number(v.fees?.mbw || 0),
      fee: Number(v.fees?.fee || 0),
      free_from: Number(v.fees?.free_from || 0)
    };
    return { items, mode, zip, fees };
  })();

  // Erstsynchronisation mit externem Mode/Rule
  (function initialSync() {
    const extMode = getSavedMode();
    if (extMode) cart.mode = extMode;
    const rule = getDeliveryRuleLS();
    if (rule && extMode === "lieferung") {
      cart.zip = String(rule.zip || "");
      cart.fees.mbw = Number(rule.mbw || 0);
      cart.fees.fee = Number(rule.fee || 0);
      cart.fees.free_from = Number(rule.free_from || 0);
    }
    persist(false); // kein Event-Spam beim Boot
  })();

  // ---------- Storage & Events ----------
  function persist(emit = true) {
    localStorage.setItem(SKEY, JSON.stringify(cart));
    updateBadge();
    if (emit) { try { document.dispatchEvent(new CustomEvent("cart:changed", { detail: cart })); } catch {} }
  }
  function updateBadge(){
    if (badgeEl) {
      const count = cart.items.reduce((n,i)=>n + Number(i.qty||1), 0);
      badgeEl.textContent = String(count);
    }
  }

  // ---------- API ----------
  function makeKey(item){
    const extras = (item.extras||[]).map(e=>e.id ?? e).sort();
    return JSON.stringify({ id:item.id, size:item.size, calzone:!!item.calzone, extras });
  }
  function add(item){
    const key = makeKey(item);
    const ex = cart.items.find(i=>i.key===key);
    if (ex) ex.qty = Math.max(1, Number(ex.qty||1) + Number(item.qty||1));
    else cart.items.push({ ...item, key, qty: Math.max(1, Number(item.qty||1)) });
    persist(); renderAllIfOpen();
  }
  function remove(key){ cart.items = cart.items.filter(i=>i.key!==key); persist(); renderAllIfOpen(); }
  function setQty(key, qty){ const it = cart.items.find(i=>i.key===key); if(!it) return; it.qty = Math.max(1, Number(qty||1)); persist(); renderAllIfOpen(); }
  function clear(){ cart.items = []; persist(); renderAllIfOpen(); }
  function setMode(m){
    // akzeptiere deutsch (lieferung/abholung) und englisch (delivery/pickup)
    const map = { delivery: "lieferung", pickup: "abholung" };
    cart.mode = map[m] || m || "abholung";
    persist(); renderAllIfOpen();
  }
  function setFees(f){
    cart.fees = {
      mbw: Number(f?.mbw ?? cart.fees.mbw ?? 0),
      fee: Number(f?.fee ?? cart.fees.fee ?? 0),
      free_from: Number(f?.free_from ?? cart.fees.free_from ?? 0)
    };
    if (f?.zip) cart.zip = String(f.zip);
    persist(); renderAllIfOpen();
  }
  function getItems(){ return cart.items.slice(); }
  function getState(){ return JSON.parse(JSON.stringify(cart)); }

  // Gebührenberechnung mit "gratis ab" Logik
  function totals(){
    const subtotal = cart.items.reduce((s,i)=>s + Number(i.price||0)*Number(i.qty||1), 0);
    let fee = 0;
    if (cart.mode === "lieferung") {
      const threshold = Number(cart.fees.free_from || 0);
      const baseFee   = Number(cart.fees.fee || 0);
      fee = (threshold > 0 && subtotal >= threshold) ? 0 : baseFee;
    }
    const total = subtotal + fee;
    // MBW bezieht sich in der Regel auf Warenwert (subtotal), nicht inkl. Liefergebühr
    const mbw = Number(cart.fees.mbw || 0);
    const belowMbw = (cart.mode === "lieferung" && mbw > 0 && subtotal < mbw);
    return { subtotal, fee, total, mbw, belowMbw };
  }

  // Expose
  window.Cart = { add, remove, setQty, clear, setMode, setFees, totals, getItems, getState };

  // ---------- Rendering ----------
  function renderItems(){
    if (!itemsEl) return;
    if (!cart.items.length){
      itemsEl.innerHTML = `
        <p class="muted">Dein Warenkorb ist leer.</p>
        <p><a href="menue.html" class="btn">Jetzt etwas aussuchen</a></p>
      `;
      if (cartMsgEl) cartMsgEl.textContent = "";
      return;
    }
    itemsEl.innerHTML = `
      <ul id="cartList" class="cart-list" style="list-style:none; margin:0; padding:0;">
        ${cart.items.map(it => `
          <li class="cart-item" data-key="${esc(it.key)}" style="display:flex; gap:.75rem; align-items:flex-start; padding:.5rem 0; border-bottom:1px solid var(--border);">
            <div style="flex:1 1 auto;">
              <div class="title" style="font-weight:600">${esc(it.name || "Artikel")}</div>
              <div class="muted" style="font-size:.9em">
                ${it.size ? `Variante: ${esc(it.size)}` : ``}
                ${it.calzone ? ` · Calzone` : ``}
                ${(it.extras && it.extras.length) ? ` · Extras: ${it.extras.map(e=>esc(e.name || e)).join(", ")}` : ``}
              </div>
              <div class="muted" style="font-size:.9em">${fmtMoney(it.price)}</div>
            </div>
            <div class="qty" style="display:flex; align-items:center; gap:.25rem;">
              <button class="btn ghost cart-dec" type="button" aria-label="Menge verringern">−</button>
              <input type="number" class="qty-input" value="${Number(it.qty||1)}" min="1" style="width:3.5rem; text-align:center;">
              <button class="btn ghost cart-inc" type="button" aria-label="Menge erhöhen">+</button>
            </div>
            <button class="btn ghost cart-remove" type="button" aria-label="Entfernen">✕</button>
          </li>
        `).join("")}
      </ul>
    `;
    bindListEvents();
  }

  function renderTotals(){
    if (!totalsEl) return;
    const t = totals();

    // Hinweis-Boxen
    let hints = [];
    if (cart.mode === "lieferung") {
      if (Number(cart.fees.free_from || 0) > 0) {
        const rest = Math.max(0, Number(cart.fees.free_from) - t.subtotal);
        if (t.subtotal < Number(cart.fees.free_from)) {
          hints.push(`Noch ${fmtMoney(rest)} bis zur kostenlosen Lieferung.`);
        } else {
          hints.push(`Lieferung kostenlos (Schwelle erreicht).`);
        }
      }
      if (t.belowMbw && t.mbw > 0) {
        const fehlend = Math.max(0, t.mbw - t.subtotal);
        hints.push(`Mindestbestellwert ${fmtMoney(t.mbw)} nicht erreicht. Es fehlen ${fmtMoney(fehlend)}.`);
      }
    }

    totalsEl.innerHTML = `
      <div>Zwischensumme: <strong>${fmtMoney(t.subtotal)}</strong></div>
      ${cart.mode==="lieferung" ? `<div>Liefergebühr${cart.zip ? ` (${esc(cart.zip)})` : ``}: <strong>${fmtMoney(t.fee)}</strong></div>` : ``}
      <div>Gesamt: <strong>${fmtMoney(t.total)}</strong></div>
    `;

    if (cartMsgEl) cartMsgEl.textContent = hints.join(" ");

    // Checkout sperren, wenn leer oder MBW nicht erreicht (bei Lieferung)
    const canCheckout = cart.items.length > 0 && !(cart.mode==="lieferung" && t.belowMbw);
    if (checkoutBtn) {
      checkoutBtn.setAttribute("aria-disabled", canCheckout ? "false" : "true");
      if (!canCheckout) checkoutBtn.classList.add("is-disabled");
      else checkoutBtn.classList.remove("is-disabled");
    }
  }

  function renderAll(){
    renderItems();
    renderTotals();
    updateBadge();
  }
  function isOpen(){ return drawer && drawer.getAttribute("aria-hidden") === "false"; }
  function renderAllIfOpen(){ if (isOpen()) renderAll(); }

  // ---------- Events im Listenteil ----------
  function bindListEvents(){
    const list = document.getElementById("cartList");
    if (!list) return;

    list.addEventListener("click", function (e) {
      const dec = e.target.closest(".cart-dec");
      const inc = e.target.closest(".cart-inc");
      const rmv = e.target.closest(".cart-remove");
      if (dec || inc || rmv) { e.preventDefault(); e.stopPropagation(); }

      const li = e.target.closest(".cart-item");
      if (!li) return;
      const key = li.getAttribute("data-key");

      if (rmv) { remove(key); renderAll(); return; }
      if (inc) {
        const it = cart.items.find(i=>i.key===key); if (!it) return;
        it.qty = Number(it.qty||1) + 1; persist(); renderAll(); return;
      }
      if (dec) {
        const it = cart.items.find(i=>i.key===key); if (!it) return;
        it.qty = Math.max(1, Number(it.qty||1) - 1); persist(); renderAll(); return;
      }
    });

    list.addEventListener("change", function (e) {
      if (!e.target.classList.contains("qty-input")) return;
      e.stopPropagation();
      const li = e.target.closest(".cart-item"); if (!li) return;
      const key = li.getAttribute("data-key");
      const val = Math.max(1, Number(e.target.value||1));
      setQty(key, val); renderAll();
    });
  }

  // ---------- Integrationen / externe Events ----------
  // beim Öffnen frisch rendern
  if (openBtn) openBtn.addEventListener("click", function(){ renderAll(); });

  // globaler Warenkorb-Event
  document.addEventListener("cart:changed", function(){ renderAllIfOpen(); });

  // „Weiter einkaufen“ nur Rendering überlassen; Schließen macht ui.js
  if (continueBtn) continueBtn.addEventListener("click", function(e){ e.stopPropagation(); });

  // Events von index.html (PLZ-Regel gesetzt / gelöscht)
  window.addEventListener("campania:delivery-rule", (e) => {
    const rule = e?.detail || getDeliveryRuleLS();
    if (!rule) return;
    cart.mode = "lieferung";
    cart.zip  = String(rule.zip || "");
    cart.fees.mbw = Number(rule.mbw || 0);
    cart.fees.fee = Number(rule.fee || 0);
    cart.fees.free_from = Number(rule.free_from || 0);
    persist(); renderAllIfOpen();
  });
  window.addEventListener("campania:delivery-rule-cleared", () => {
    // Regel löschen, Modus ggf. auf Abholung (sichtbarer Effekt: keine Liefergebühr/MBW)
    cart.zip = null;
    cart.fees = { mbw: 0, fee: 0, free_from: 0 };
    // Modus beibehalten – oder auf Wunsch hart auf Abholung:
    // cart.mode = "abholung";
    persist(); renderAllIfOpen();
  });

  // Badge initial & ggf. initial rendern
  updateBadge();
  if (itemsEl) renderAll();
})();
