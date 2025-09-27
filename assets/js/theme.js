
(function() {
  const root = document.documentElement;
  const key = "campania-theme";
  const saved = localStorage.getItem(key);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // priority: manual > system > default(light)
  if (saved === "dark" || saved === "light") {
    root.setAttribute("data-theme", saved);
  } else {
    root.setAttribute("data-theme", "system");
    if (prefersDark) root.setAttribute("data-theme", "dark");
  }

  function applyLabel(btn) {
    const t = root.getAttribute("data-theme");
    btn.setAttribute("aria-pressed", t === "dark");
    btn.title = t === "dark" ? "In helles Design wechseln" : "In dunkles Design wechseln";
  }

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    applyLabel(btn);
    btn.addEventListener("click", () => {
      const t = root.getAttribute("data-theme");
      const next = t === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem(key, next);
      applyLabel(btn);
    });
  });
})();
