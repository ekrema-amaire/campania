(function () {
  const SKEY = "campania-cart";

  // ---------- State laden & härten ----------
  function jparse(s, fb){ try { return JSON.parse(s); } catch { return fb; } }
  let cart = (function(){
    const v = (window.Campania && Campania.storage)
      ? Campania.storage.get(SKEY, null)
      : jparse(localStorage.getItem(SKEY), null);
    if (!v || typeof v !== "object" || !Array.isArray(v.items)) {
      return { items: [], mode: "abholung", zip: null, fees: { mbw: 0, fee: 0 } };
    }
    return {
      items: Array.isArray(v.items) ? v.items : [],
      mode: v.mode || "abholung",
      zip:  v.zip ?? null,
      fees: { mbw: Number(v.fees?.mbw || 0), fee: Number(v.fees?.fee || 0) }
    };
  })();

  // ---------- DOM Helpers ----------
  const $id = (x) => document.getElementById(x);
  const drawer          = $id("cartDrawer");
  const openBtn         = $id("openCart");
  const closeBtn        = $id("closeCart");
  const itemsEl         = $id("cartItems");   // <div class="drawer-body" id="cartItems">
  const totalsEl        = $id("cartTotals");  // <div id="cartTotals">
  const checkoutBtn     = $id("checkoutBtn"); // <a id="checkoutBtn">
  const continueBtn     = $id("continueShopping");
  const badgeEl         = $id("cartBadge");

  function fmt(v){
    const n = Number(v || 0);
    try { return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n); }
    catch { return n.toFixed(2).replace(".", ",") + " €"; }
  }
  function esc(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

  // ---------- Storage & Events ----------
  function persist() {
    if (window.Campania?.storage) Campania.storage.set(SKEY, cart);
    else localStorage.setItem(SKEY, JSON.stringify(cart));
    updateBadge();
    // App-weites Ereignis für andere Module
    try { document.dispatchEvent(new CustomEvent("cart:changed", { detail: cart })); } catch {}
  }
  function updateBadge(){
    if (badgeEl) {
      const count = cart.items.reduce((n,i)=>n + Number(i.qty||1), 0);
      badgeEl.textContent = String(count);
    }
  }

  // ---------- API ----------
  function makeKey(item){
    const extras = (item.extras||[]).map(e=>e.id).sort();
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
  function setMode(m){ cart.mode=m; persist(); renderAllIfOpen(); }
  function setFees(f){ cart.fees = { ...cart.fees, ...f }; persist(); renderAllIfOpen(); }
  function totals(){
    const subtotal = cart.items.reduce((s,i)=>s + Number(i.price||0)*Number(i.qty||1), 0);
    const fee = cart.mode === "lieferung" ? Number(cart.fees.fee||0) : 0;
    const total = subtotal + fee;
    return { subtotal, fee, total };
  }
  window.Cart = { add, remove, setQty, clear, setMode, setFees, totals };

  // ---------- Rendering ----------
  function renderItems(){
    if (!itemsEl) return;
    if (!cart.items.length){
      itemsEl.innerHTML = `
        <p class="muted">Dein Warenkorb ist leer.</p>
        <p><a href="menue.html" class="btn">Jetzt etwas aussuchen</a></p>
      `;
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
                ${(it.extras && it.extras.length) ? ` · Extras: ${it.extras.map(e=>esc(e.name)).join(", ")}` : ``}
              </div>
              <div class="muted" style="font-size:.9em">${fmt(it.price)}</div>
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
    bindListEvents(); // nach neuem HTML neu binden
  }

  function renderTotals(){
    if (!totalsEl) return;
    const t = totals();
    const canCheckout = cart.items.length > 0 && (!cart.fees.mbw || t.total >= Number(cart.fees.mbw || 0));
    totalsEl.innerHTML = `
      <div>Zwischensumme: <strong>${fmt(t.subtotal)}</strong></div>
      ${cart.mode==="lieferung" && t.fee ? `<div>Liefergebühr: <strong>${fmt(t.fee)}</strong></div>` : ``}
      <div>Gesamt: <strong>${fmt(t.total)}</strong></div>
    `;
    if (checkoutBtn) checkoutBtn.setAttribute("aria-disabled", canCheckout ? "false" : "true");
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

  // ---------- Init / Integrationen ----------
  // beim Klick auf den Warenkorb immer frisch rendern
  if (openBtn) openBtn.addEventListener("click", function(){ renderAll(); });

  // wenn sich der Warenkorb ändert (z. B. von einer anderen Seite) und der Drawer offen ist → aktualisieren
  document.addEventListener("cart:changed", function(){ renderAllIfOpen(); });

  // „Weiter einkaufen“ nur Rendering überlassen; Schließen macht deine ui.js
  if (continueBtn) continueBtn.addEventListener("click", function(e){ e.stopPropagation(); });

  // Badge initial
  updateBadge();

  // Falls der Drawer bei Seitenaufruf schon im DOM ist, einmal initial rendern
  if (itemsEl) renderAll();
})();
