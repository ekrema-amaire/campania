
// assets/js/home.js — robust: erkennt Preise aller Kategorien & fügt korrekt in den Warenkorb
(function () {
  // --- Helpers ---------------------------------------------------------------
  function money(v) {
    var n = Number(v || 0);
    if (window.Campania && typeof Campania.formatPrice === "function") return Campania.formatPrice(n);
    return n.toFixed(2).replace(".", ",") + " €";
  }
  function toast(msg) { if (typeof window.showToast === "function") return showToast(msg); alert(msg); }

  // kleinsten verfügbaren Preis finden (Pizza, Pasta, Nuggets, Dips, …)
  function basePrice(p) {
    var keys = ["price","price26","price30","price6","price9","price10","price12","price15","price20"];
    var vals = [];
    for (var i=0;i<keys.length;i++){ var k=keys[i]; if (p && p[k]!=null) vals.push(Number(p[k])); }
    if (!vals.length) return 0;
    vals.sort(function(a,b){return a-b;});
    return vals[0];
  }

  // ---------- Öffnungsstatus (wie gehabt) ----------
  function computeStatus(hours) {
    var now = new Date();
    var dayNames = ["sun","mon","tue","wed","thu","fri","sat"];
    var key = dayNames[now.getDay()];
    var r = hours && hours.regular ? hours.regular[key] : null;
    if (!r) return { open:false, next:null };
    function hhmm(s){ var p=String(s||"00:00").split(":"); return {h:+p[0]||0,m:+p[1]||0}; }
    var o=hhmm(r.open), c=hhmm(r.close), l=hhmm(r.last_order||r.close);
    var openTime=new Date(now), closeTime=new Date(now), lastTime=new Date(now);
    openTime.setHours(o.h,o.m,0,0); closeTime.setHours(c.h,c.m,0,0); lastTime.setHours(l.h,l.m,0,0);
    if (now < openTime) return {open:false,next:openTime};
    if (now > closeTime){ var nxt=new Date(openTime.getTime()+86400000); return {open:false,next:nxt}; }
    return {open:true,soon:((lastTime-now)/60000)<30,last:lastTime};
  }
  var statusEl=document.getElementById("openStatus");
  if (statusEl){
    fetch("data/hours.json").then(function(r){return r.json();}).then(function(hours){
      var st=computeStatus(hours);
      statusEl.innerHTML = st.open
        ? (st.soon ? "Letzte Bestellungen bis "+st.last.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})+"." :
            "Heute <strong>geöffnet</strong>. Lieferzeit: <strong>25–35 Min.</strong>")
        : "Aktuell <strong>geschlossen</strong>. Vorbestellen möglich.";
    }).catch(function(){ statusEl.textContent="Status derzeit nicht verfügbar."; });
  }

  // ---------- Bestseller-Gitter ----------
  var grid = document.getElementById("bestseller");
  if (grid) {
    fetch("data/products.json")
      .then(function (res) { return res.json(); })
      .then(function (products) {
        var list = (products || []).filter(function (p) {
          return p && p.tags && p.tags.indexOf("bestseller") !== -1;
        }).slice(0, 4);

        grid.innerHTML = "";
        if (!list.length) { grid.innerHTML = '<div class="notice">Keine Bestseller verfügbar.</div>'; return; }

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
          if (addBtn) addBtn.addEventListener("click", function () { openProductModal(p.id); });
          grid.appendChild(card);
        });
      })
      .catch(function () { grid.innerHTML = '<div class="notice">Keine Bestseller verfügbar.</div>'; });
  }

  // ---------- Produkt-Modal: Öffnen ----------
  window.openProductModal = function (productId) {
    fetch("data/products.json")
      .then(function (res) { return res.json(); })
      .then(function (products) {
        var p = (products || []).find(function (x) { return x.id === productId; });
        if (!p) { toast("Produkt nicht gefunden."); return; }
        createProductModal(p, products);
      })
      .catch(function () { toast("Produktdaten nicht verfügbar."); });
  };

  // ---------- Produkt-Modal: Aufbau ----------
  function createProductModal(p, products) {
    function lc(x){ return (x||"").toString().toLowerCase(); }
    function isPizza(prod){ var c=lc(prod.category||prod.type||""); return c==="pizza" || /pizza/.test(c)||/pizza/.test(lc(prod.name||"")); }
    function isPasta(prod){ var c=lc(prod.category||""); var n=lc(prod.name||""); return c==="pasta"||/(pasta|penne|spaghetti|tagliatelle|gnocchi|lasagne)/.test(n); }
    function isBroetchen(prod){ var c=lc(prod.category||""); var n=lc(prod.name||""); return c==="pizzabrötchen"||c==="pizzabroetchen"||/pizzabr(ö|o)tchen/.test(n); }
    function isNuggets(prod){ var s=lc(String(prod.id||""))+" "+lc(String(prod.name||"")); return /nugget/.test(s); }

    function getExtrasList(prod, all){
      if (Array.isArray(prod.extras) && prod.extras.length) return prod.extras;
      if (prod.extras_ref){ var ref=(all||[]).find(function(x){return x.id===prod.extras_ref;}); if (ref && Array.isArray(ref.items)) return ref.items; }
      var master=(all||[]).find(function(x){return x.id==="extras_master";}); if (master && Array.isArray(master.items)) return master.items;
      return [];
    }
    function buildNuggetOptions(prod){
      var opts = [];
      if (Array.isArray(prod.options)) for (var i=0;i<prod.options.length;i++){
        var o=prod.options[i]||{}; if (o.value!=null && o.price!=null){
          opts.push({value:String(o.value), label:(o.label||(o.value+" Stück"))+" – "+money(+o.price), price:+o.price});
        }
      }
      [6,9,10,12,15,20].forEach(function(cnt){ var key="price"+cnt; if (key in prod){ var pr=+prod[key]||0; opts.push({value:String(cnt), label:cnt+" Stück – "+money(pr), price:pr}); } });
      if (!opts.length){ var base=Number(p.price||p.price26||p.price30||0); opts.push({value:"standard", label:"Standard – "+money(base), price:base}); }
      return opts;
    }

    var pizza=isPizza(p), pasta=isPasta(p), broetchen=isBroetchen(p), nuggets=isNuggets(p);
    var showSize=pizza, showCalzone=pizza, showExtras=(pizza||pasta||broetchen), showMenge=nuggets;

    var wrap=document.createElement("div");
    wrap.setAttribute("role","dialog"); wrap.setAttribute("aria-modal","true"); wrap.className="drawer"; wrap.style.display="block";
    wrap.innerHTML =
      '<div class="drawer-content" style="left:50%; right:auto; transform:translateX(-50%); width:min(560px, 100%); border-left:none; border:1px solid var(--border);" tabindex="-1">' +
        '<header class="drawer-header"><h2 id="pmTitle">' + (p.name||"") + '</h2><button class="btn icon" aria-label="Schließen" type="button">✕</button></header>' +
        '<div class="drawer-body">' +
          '<img src="assets/img/' + (p.image||"") + '" alt="' + (p.name||"") + '" style="width:100%; border-radius:12px; margin-bottom:.5rem;">' +
          '<p class="muted">' + (p.short||"") + '</p>' +
          (showSize ? (function(){ var sizeOpts=""; if (p.price26!=null) sizeOpts+='<option value="26" data-price="'+Number(p.price26||0)+'">26 cm – '+money(p.price26)+'</option>'; if (p.price30!=null) sizeOpts+='<option value="30" data-price="'+Number(p.price30||0)+'">30 cm – '+money(p.price30)+'</option>'; if(!sizeOpts){ var b=Number(p.price||p.price26||p.price30||0); sizeOpts='<option value="standard" data-price="'+b+'">Standard – '+money(b)+'</option>'; } return '<div class="field"><label for="size">Größe</label><select id="size">'+sizeOpts+'</select></div>'; })() : '') +
          (showCalzone ? ('<div class="field"><label><input type="checkbox" id="calzone"> Als Calzone (+2,00 €)</label></div>') : '') +
          (showMenge ? ('<div class="field"><label for="menge">Menge</label><select id="menge"></select></div>') : '') +
          (showExtras ? ('<div class="field"><label>Extras</label><div id="extras"></div></div>') : '') +
          '<div class="field"><details><summary>Allergene & Details</summary><p>' + (p.allergens || "Keine Angaben") + '</p></details></div>' +
        '</div>' +
        '<div class="drawer-footer"><div class="drawer-actions" style="justify-content: space-between;"><div>Zwischensumme: <strong id="subtotal"></strong></div><div><button class="btn ghost" id="cancel" type="button">Abbrechen</button><button class="btn primary" id="add" type="button">In den Warenkorb</button></div></div></div>' +
      '</div>';
    document.body.appendChild(wrap);
    var dlg=wrap.querySelector(".drawer-content"); if (dlg && dlg.focus) dlg.focus();

    var sizeEl=wrap.querySelector("#size"), mengeEl=wrap.querySelector("#menge"), calzEl=wrap.querySelector("#calzone"), extrasEl=wrap.querySelector("#extras"), subtotal=wrap.querySelector("#subtotal");

    if (showMenge && mengeEl){ var nOpts=buildNuggetOptions(p); mengeEl.innerHTML=nOpts.map(function(o){ return '<option value="'+String(o.value)+'" data-price="'+Number(o.price||0)+'">'+o.label+'</option>'; }).join(""); }
    if (showExtras && extrasEl){
      var extraList=getExtrasList(p, products||[]);
      for (var i=0;i<extraList.length;i++){ var e=extraList[i]||{}; var id="x_"+(e.id!=null?e.id:i), name=(e.name||"Extra").replace(/"/g,"&quot;"), price=Number(e.price||0);
        var lbl = document.createElement("label");
        lbl.className = "option"; // <-- für die CSS-Regel oben
        lbl.innerHTML =
          '<input type="checkbox" id="'+id+'" data-id="'+(e.id!=null?e.id:i)+'" data-name="'+name+'" data-price="'+price+'">' +
          '<span>' + (e.name || "Extra") + ' (+' + money(price) + ')</span>';
        extrasEl.appendChild(lbl);
      }
    }

    function compute(){
      var base=0, variantLabel="Standard";
      if (showSize && sizeEl && sizeEl.selectedIndex>=0){ var sopt=sizeEl.options[sizeEl.selectedIndex]; base=Number(sopt.getAttribute("data-price")||0); variantLabel=(sopt.value==="standard")?"Standard":(sopt.value+" cm"); }
      else if (showMenge && mengeEl && mengeEl.selectedIndex>=0){ var mopt=mengeEl.options[mengeEl.selectedIndex]; base=Number(mopt.getAttribute("data-price")||0); variantLabel=(mopt.value==="standard")?"Standard":(mopt.value+" Stück"); }
      else { base=Number(p.price||p.price26||p.price30||0); variantLabel="Standard"; }
      var sum=base + ((showCalzone && calzEl && calzEl.checked) ? 2.0 : 0);
      var chosen=[]; if (extrasEl){ var checks=extrasEl.querySelectorAll("input:checked"); for (var i=0;i<checks.length;i++){ var x=checks[i]; var exPrice=Number(x.getAttribute("data-price")||0); chosen.push({id:x.getAttribute("data-id"), name:x.getAttribute("data-name"), price:exPrice}); sum+=exPrice; } }
      if (subtotal) subtotal.textContent = money(sum);
      return { price:sum, extras:chosen, variantLabel:variantLabel };
    }
    compute();
    if (sizeEl) sizeEl.addEventListener("change", compute);
    if (mengeEl) mengeEl.addEventListener("change", compute);
    if (calzEl) calzEl.addEventListener("change", compute);
    if (extrasEl) extrasEl.addEventListener("change", compute);

    var addBtn=wrap.querySelector("#add");
    if (addBtn) addBtn.addEventListener("click", function(){
      var comp=compute();
      if (!window.Cart || typeof Cart.add!=="function") { toast("Warenkorb nicht verfügbar."); return; }
      var item={ id:p.id, name:p.name, price:Number(comp.price||0), extras:comp.extras, size:(comp.variantLabel||"Standard") };
      if (showCalzone && calzEl) item.calzone=!!calzEl.checked;
      if (showMenge && mengeEl) item.menge=(mengeEl.value==="standard"?"Standard":(mengeEl.value+" Stück"));
      Cart.add(item);
      toast("Hinzugefügt: " + (p.name || "Produkt"));
      if (wrap.parentNode) document.body.removeChild(wrap);
    });

    function closeModal(){ if (wrap.parentNode) document.body.removeChild(wrap); }
    var cancelBtn=wrap.querySelector("#cancel"); if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    var xBtn=wrap.querySelector('button[aria-label="Schließen"]'); if (xBtn) xBtn.addEventListener("click", closeModal);
    wrap.addEventListener("keydown", function(e){ if (e.key==="Escape") closeModal(); });
  }
})();

// Optional globaler Öffner (falls irgendwo data-action="open" genutzt wird)
document.addEventListener("click", function (e) {
  var btn = e.target && e.target.closest('[data-action="open"][data-id]');
  if (!btn) return;
  e.preventDefault();
  if (typeof window.openProductModal === "function") window.openProductModal(btn.getAttribute("data-id"));
});
