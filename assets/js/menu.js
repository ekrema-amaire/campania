// assets/js/menu.js — zeigt überall den korrekten Einstiegspreis
(function () {
  var grid  = document.getElementById("menuGrid");
  var tabs  = document.querySelectorAll('[role="tab"]');
  var chips = document.querySelectorAll('[data-filter]');
  var reset = document.getElementById("resetFilters");
  if (!grid) return;

  var products = [];
  var products = [];
function loadProducts(cb) {
  const API_URL = 'http://localhost:4000/api/products';

  try {
    fetch(API_URL, { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        // Backend gibt { ok: true, data: [...] } zurück
        products = (json && Array.isArray(json.data)) ? json.data : [];
        cb();
      })
      .catch(function () {
        // Fallback: lokale Datei wie bisher
        fetch('data/products.json')
          .then(function (res) { return res.json(); })
          .then(function (json) { products = json || []; cb(); })
          .catch(function () { products = []; cb(); });
      });
  } catch (e) {
    products = []; cb();
  }
}


  var activeCat  = "Alle";
  var activeTags = new Set();

  function money(v) {
    var n = Number(v || 0);
    if (window.Campania && typeof Campania.formatPrice === "function") return Campania.formatPrice(n);
    return n.toFixed(2).replace(".", ",") + " €";
  }
  function basePrice(p) {
    var keys = ["price","price26","price30","price6","price9","price10","price12","price15","price20"];
    var vals = [];
    for (var i=0;i<keys.length;i++){ var k=keys[i]; if (p && p[k]!=null) vals.push(Number(p[k])); }
    if (!vals.length) return 0; vals.sort(function(a,b){return a-b;}); return vals[0];
  }

  function render() {
    var list = (products || [])
      .filter(function (p) { return p && p.active; })
      .filter(function (p) { return activeCat === "Alle" ? true : p.category === activeCat; })
      .filter(function (p) {
        if (!activeTags.size) return true;
        var ptags = Array.isArray(p.tags) ? p.tags : [];
        for (var t of activeTags) { if (ptags.indexOf(t) !== -1) return true; }
        return false;
      })
      .sort(function (a, b) { return Number(a.sort || 0) - Number(b.sort || 0); });

    grid.innerHTML = "";
    if (!list.length) { grid.innerHTML = '<div class="notice">Für deine Auswahl gibt es derzeit <strong>keine</strong> Artikel.</div>'; return; }

    list.forEach(function (p) {
      var card = document.createElement("article");
      card.className = "card";
      var alt = (p.name || "") + " – " + (p.short || "");
      card.innerHTML =
        '<img src="assets/img/' + p.image + '" alt="' + alt.replace(/"/g, "&quot;") + '">' +
        '<div class="card-body">' +
          '<h3 class="title">' + (p.name || "") + '</h3>' +
          '<div class="muted">' + (p.short || "") + '</div>' +
          '<div class="price-row">' +
            '<div>ab <strong>' + money(basePrice(p)) + '</strong></div>' +
            '<button class="btn add" aria-label="' + (p.name || "Produkt") + ' hinzufügen" type="button">+</button>' +
          '</div>' +
        '</div>';

      var addBtn = card.querySelector(".add");
      if (addBtn) addBtn.addEventListener("click", function () {
        if (typeof window.openProductModal === "function") window.openProductModal(p.id);
        else if (typeof window.showToast === "function") window.showToast("Produkt-Modal nicht geladen."); else alert("Produkt-Modal nicht geladen.");
      });
      grid.appendChild(card);
    });
  }

  tabs.forEach && tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.setAttribute("aria-selected", "false"); });
      t.setAttribute("aria-selected", "true");
      activeCat = t.getAttribute("data-cat") || "Alle";
      render();
    });
  });
  chips.forEach && chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var tag = c.getAttribute("data-filter"); if (!tag) return;
      if (activeTags.has(tag)) { activeTags.delete(tag); c.classList.remove("primary"); if (!c.classList.contains("ghost")) c.classList.add("ghost"); }
      else { activeTags.add(tag); c.classList.add("primary"); c.classList.remove("ghost"); }
      render();
    });
  });
  if (reset) reset.addEventListener("click", function () {
    activeTags = new Set();
    chips.forEach && chips.forEach(function (c) { c.classList.remove("primary"); if (!c.classList.contains("ghost")) c.classList.add("ghost"); });
    render();
  });

  if (!window.openProductModal) {
    window.openProductModal = function () {
      if (typeof window.showToast === "function") window.showToast("Produkt-Modal nicht geladen."); else alert("Produkt-Modal nicht geladen.");
    };
  }

  loadProducts(render);
})();
