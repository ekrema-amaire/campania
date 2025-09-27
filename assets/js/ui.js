// assets/js/ui.js — Drawer-Open/Close, Focus-Handling & Toast (kompatibel)
(function () {
  var drawer  = document.getElementById("cartDrawer");
  var openBtn = document.getElementById("openCart");
  var closeBtn= document.getElementById("closeCart");
  var contBtn = document.getElementById("continueShopping");
  var toastEl = document.getElementById("toast");

  if (drawer && !drawer.hasAttribute("aria-hidden")) drawer.setAttribute("aria-hidden", "true");

  // Focus-Management für den Dialog
  function focusFirst() {
    if (!drawer) return;
    var dc = drawer.querySelector(".drawer-content");
    if (dc && typeof dc.focus === "function") dc.focus();
  }

  function openDrawer() {
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "false");
    if (openBtn) openBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    focusFirst();
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "true");
    if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    // Fokus zurück zum Auslöser
    if (openBtn && typeof openBtn.focus === "function") openBtn.focus();
  }

  // Click-Wiring
  if (openBtn && drawer) openBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (contBtn)  contBtn.addEventListener("click", closeDrawer);

  // ESC schließt
  if (drawer) drawer.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  // Optional: Klick außerhalb der Drawer-Content schließt
  if (drawer) {
    drawer.addEventListener("click", function (e) {
      var content = drawer.querySelector(".drawer-content");
      if (!content) return;
      if (!content.contains(e.target)) closeDrawer();
    });
  }

  // ----- Toast -----
  // API: window.showToast(msg, {duration})
  // Falls bereits sichtbar, wird die Zeit zurückgesetzt (kein „Stapel“ nötig).
  var toastTimer = null;
  window.showToast = function (msg, opts) {
    if (!toastEl) return;
    var duration = (opts && opts.duration) ? Number(opts.duration) : 2400;
    toastEl.textContent = String(msg || "");
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, duration);
  };
})();
