// assets/js/state.js — robustere Utilities (kompatibel zu deiner bisherigen API)
(function () {
  // Sichere JSON-Helfer
  function jparse(s, fb) { try { return JSON.parse(s); } catch { return fb; } }
  function jstring(v) { try { return JSON.stringify(v); } catch { return "{}"; } }

  // Lokales Event-Bus-Objekt (EventTarget mit on/off/once)
  var bus = new EventTarget();
  function on(name, fn)  { try { bus.addEventListener(name, fn); } catch {} }
  function off(name, fn) { try { bus.removeEventListener(name, fn); } catch {} }
  function once(name, fn){
    function w(e){ try { fn(e); } finally { off(name, w); } }
    on(name, w);
  }
  function notify(name, detail){ try { bus.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch {} }

  // Preisformatierung (Fallback auf deutsches Format)
  function formatPrice(v) {
    var n = Number(v || 0);
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
    } catch {
      return n.toFixed(2).replace('.', ',') + ' €';
    }
  }

  // Storage mit Fallbacks & Quota-Schutz
  var storage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        var val = jparse(raw, fallback);
        return (val == null ? fallback : val); // <<< wichtig: null -> Fallback
      } catch {
        return fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, jstring(value)); } catch { /* Quota voll? Ignorieren */ }
    },
    del: function (key) {
      try { localStorage.removeItem(key); } catch {}
    }
  };

  // Expose
  window.Campania = {
    storage: storage,
    formatPrice: formatPrice,
    events: bus,
    notify: notify,
    on: on,
    off: off,
    once: once
  };
})();
