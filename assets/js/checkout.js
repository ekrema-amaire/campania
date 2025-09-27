// === Campania Checkout – stabile Version ===
const API_BASE = "http://localhost:4000/api";

/* -------------------- CART -------------------- */
function readCartSnapshot() {
  const PREFERRED_KEYS = [
    "campania_cart", "cart", "CART_STATE", "cart_items",
    "CART", "CART:STATE", "CAMPANIA_CART"
  ];
  function deepFindItems(node, depth = 0) {
    if (depth > 5 || !node) return null;
    if (Array.isArray(node)) {
      if (node.length === 0) return node;
      const score = node.reduce((s, it) => {
        if (it && typeof it === "object") {
          if ("id" in it || "name" in it || "title" in it) s += 1;
          if ("qty" in it || "quantity" in it || "count" in it || "amount" in it || "menge" in it) s += 1;
          if ("price" in it || "unitPrice" in it || "total" in it || "preis" in it) s += 1;
        }
        return s;
      }, 0);
      if (score >= Math.max(1, Math.ceil(node.length * 0.5))) return node;
      for (const it of node) {
        const found = deepFindItems(it, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      for (const key of Object.keys(node)) {
        const low = key.toLowerCase();
        if (["items", "lines", "positions", "artikel", "products"].includes(low)) {
          const v = node[key];
          if (Array.isArray(v)) return v;
        }
      }
      for (const key of Object.keys(node)) {
        const found = deepFindItems(node[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  function tryParse(x) { try { return JSON.parse(x); } catch { return null; } }

  const stores = [localStorage, sessionStorage];
  for (const store of stores) {
    for (const k of PREFERRED_KEYS) {
      const raw = store.getItem(k);
      if (!raw) continue;
      const parsed = tryParse(raw) ?? raw;
      const items = deepFindItems(parsed);
      if (items) return items;
    }
  }
  for (const store of stores) {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      const raw = store.getItem(key);
      if (!raw) continue;
      const parsed = tryParse(raw) ?? raw;
      const items = deepFindItems(parsed);
      if (items) return items;
    }
  }
  return [];
}

function normalizeItems(items) {
  return (items || []).map((it) => {
    const qtyRaw = it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.menge ?? 1;
    let unit = it.unitPrice ?? it.price ?? it.preis ?? 0;
    if ((!unit || Number.isNaN(+unit)) && it.total && qtyRaw) {
      unit = Number(it.total) / Number(qtyRaw);
    }
    return {
      id: it.id ?? it.sku ?? it.code ?? it.productId ?? "unknown",
      name: it.name ?? it.title ?? it.productName ?? "Artikel",
      qty: Number(qtyRaw) || 1,
      price: Number(unit) || 0,
      size: it.size ?? it.variant ?? it.option ?? null,
      extras: it.extras ?? it.addons ?? it.options ?? [],
      notes: it.note ?? it.notes ?? it.kommentar ?? ""
    };
  });
}

function computeTotals(items) {
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const delivery = 0;
  const discount = 0;
  const total = subtotal + delivery - discount;
  return { subtotal, delivery, discount, total };
}

function money(v) {
  return (Number(v) || 0).toFixed(2).replace(".", ",") + " €";
}

/* -------------------- MODE -------------------- */
function getMode() {
  try {
    const params = new URLSearchParams(location.search);
    const p = (params.get("mode") || "").toLowerCase();
    if (p === "pickup" || p === "abholung") return "pickup";
    if (p === "delivery" || p === "lieferung") return "delivery";
  } catch {}
  const mf = document.getElementById("modeField");
  if (mf && mf.value) {
    const v = mf.value.toLowerCase();
    if (v.includes("abholung") || v.includes("pickup")) return "pickup";
    if (v.includes("liefer")) return "delivery";
  }
  const keys = ["campania_mode", "order_mode", "MODE", "mode"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (!v) continue;
    const x = v.toLowerCase();
    if (x.includes("pickup") || x.includes("abholung")) return "pickup";
    if (x.includes("delivery") || x.includes("liefer")) return "delivery";
  }
  return "delivery";
}

function setModeUI(mode) {
  const field = document.getElementById("modeField");
  if (field) field.value = mode === "pickup" ? "Abholung" : "Lieferung";
  const df = document.getElementById("deliveryFields");
  if (df) df.style.display = mode === "pickup" ? "none" : "";
}

/* -------------------- RENDER -------------------- */
function renderOrderSummary({ items, totals, mode, address, note, customer }) {
  const el = document.getElementById("orderSummary");
  if (!el) return;

  const rows = items.map(
    (it) =>
      `<tr>
        <td>${it.qty}×</td>
        <td>${it.name}${it.size ? ` (${it.size})` : ""}${
        it.extras && it.extras.length ? `<div class="muted">+ ${it.extras.join(", ")}</div>` : ""
      }</td>
        <td style="text-align:right">${money(it.price * it.qty)}</td>
      </tr>`
  ).join("");

  const addrBlock =
    mode === "pickup"
      ? `<p><strong>Abholung</strong> – Adresse nicht erforderlich.</p>`
      : `<p><strong>Lieferung</strong><br>${address.street || ""}<br>${address.zip || ""} ${address.city || ""}${
          address.info ? "<br>" + address.info : ""
        }</p>`;

  el.innerHTML = `
    <div class="card">
      <table style="width:100%; border-collapse: collapse;">
        <tbody>${rows || `<tr><td colspan="3">Warenkorb ist leer.</td></tr>`}</tbody>
        <tfoot>
          <tr><td></td><td>Zwischensumme</td><td style="text-align:right">${money(totals.subtotal)}</td></tr>
          <tr><td></td><td>Lieferung</td><td style="text-align:right">${money(totals.delivery)}</td></tr>
          <tr><td></td><td>Rabatt</td><td style="text-align:right">-${money(totals.discount)}</td></tr>
          <tr><td></td><td><strong>Summe</strong></td><td style="text-align:right"><strong>${money(totals.total)}</strong></td></tr>
        </tfoot>
      </table>
    </div>
    <div class="grid mt">
      <div>${addrBlock}</div>
      <div>
        <p><strong>Kontakt</strong><br>${customer.email || ""}${customer.phone ? "<br>" + customer.phone : ""}</p>
        ${note ? `<p><strong>Hinweis:</strong><br>${note}</p>` : ""}
      </div>
    </div>
  `;
}

/* -------------------- API -------------------- */
async function submitOrder(payload) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const msg = json?.error || `Fehler (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/* -------------------- BOOT / UI-LOGIK -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Steps & Buttons
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");
  const toStep2 = document.getElementById("toStep2");
  const backTo1 = document.getElementById("backTo1");
  const toStep3 = document.getElementById("toStep3");
  const placeOrder = document.getElementById("placeOrder");
  const agb = document.getElementById("agb");
  const resultBox = document.getElementById("orderResult");

  // Form (falls die Steps in <form> liegen → Submit verhindern)
  document.querySelectorAll("form").forEach(f => {
    f.addEventListener("submit", (e) => e.preventDefault());
  });

  // Fields
  const streetEl = document.getElementById("street");
  const zipEl = document.getElementById("zip");
  const cityEl = document.getElementById("city");
  const infoEl = document.getElementById("info");
  const noteEl = document.getElementById("note");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");

  const mode = getMode();
  setModeUI(mode);

  function showStep(n) {
    if (step1) step1.style.display = n === 1 ? "" : "none";
    if (step2) step2.style.display = n === 2 ? "" : "none";
    if (step3) step3.style.display = n === 3 ? "" : "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function isEmail(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x || "").trim()); }
  function showMsg(html, isError) {
    if (!resultBox) return;
    resultBox.innerHTML = html;
    resultBox.classList.toggle("error", !!isError);
    resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function setToStep3Enabled(on) {
    if (!toStep3) return;
    toStep3.disabled = !on;
    toStep3.setAttribute("aria-disabled", on ? "false" : "true");
  }

  // Initial
  setToStep3Enabled(false);
  showStep(1);

  // STEP 1 → STEP 2
  toStep2?.addEventListener("click", (ev) => {
    ev.preventDefault();

    const items = normalizeItems(readCartSnapshot());
    if (items.length === 0) { alert("Dein Warenkorb ist leer."); return; }

    const email = emailEl?.value?.trim() || "";
    if (!isEmail(email)) { alert("Bitte eine gültige E-Mail eingeben."); emailEl?.focus(); return; }

    if (getMode() === "delivery") {
      const street = streetEl?.value?.trim() || "";
      const zip = zipEl?.value?.trim() || "";
      const city = cityEl?.value?.trim() || "";
      if (!street || !zip || !city) {
        alert("Für Lieferung brauchen wir Straße, PLZ und Ort.");
        (street ? (zip ? cityEl : zipEl) : streetEl)?.focus();
        return;
      }
    }

    const address = {
      street: streetEl?.value?.trim() || "",
      zip: zipEl?.value?.trim() || "",
      city: cityEl?.value?.trim() || "",
      info: infoEl?.value?.trim() || ""
    };
    const customer = { email: emailEl?.value?.trim() || "", phone: phoneEl?.value?.trim() || "" };
    const note = noteEl?.value?.trim() || "";
    const totals = computeTotals(items);

    renderOrderSummary({ items, totals, mode: getMode(), address, note, customer });
    setToStep3Enabled(false);
    showStep(2);
  });

  // AGB → Step3-Button freischalten
  agb?.addEventListener("change", () => setToStep3Enabled(!!agb.checked));

  // STEP 2 → STEP 3
  toStep3?.addEventListener("click", (ev) => {
    ev.preventDefault();
    if (toStep3.disabled) { alert("Bitte AGB/Datenschutz bestätigen."); return; }
    showStep(3);
  });

  // Zurück
  backTo1?.addEventListener("click", (ev) => { ev.preventDefault(); showStep(1); });

  // STEP 3: Bestellung absenden (bleibt auf Step 3)
  placeOrder?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    try {
      placeOrder.disabled = true;
      placeOrder.textContent = "Wird gesendet…";

      const items = normalizeItems(readCartSnapshot());
      if (items.length === 0) { showMsg("<p>Dein Warenkorb ist leer.</p>", true); showStep(3); return; }

      const address = {
        street: streetEl?.value?.trim() || "",
        zip: zipEl?.value?.trim() || "",
        city: cityEl?.value?.trim() || "",
        info: infoEl?.value?.trim() || ""
      };

      const payload = {
        mode: getMode(),
        customer: { email: emailEl?.value?.trim() || "", phone: phoneEl?.value?.trim() || "" },
        address: getMode() === "delivery" ? address : {},
        note: noteEl?.value?.trim() || "",
        items,
        totals: computeTotals(items)
      };

      const resp = await submitOrder(payload);

      // >>> Wichtig: Auf Step 3 bleiben & Bestätigung zeigen
      showStep(3);
      showMsg(
        `<p>✅ Danke! Deine Bestellung ist eingegangen.</p>
         <p>Bestellnummer: <strong>${resp.orderId}</strong></p>`,
        false
      );

      // Optional: Warenkorb leeren
      try { localStorage.removeItem("campania_cart"); } catch {}

    } catch (err) {
      showStep(3);
      showMsg(`<p>Bestellung fehlgeschlagen: ${err.message || err}</p>`, true);
    } finally {
      placeOrder.disabled = false;
      placeOrder.textContent = "Kostenpflichtig bestellen";
    }
  });
});
