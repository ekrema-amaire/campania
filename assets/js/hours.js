// assets/js/hours.js — Öffnungszeiten-Rendering + Status (mit "closed": true Unterstützung)
(function () {
  var box = document.getElementById("hoursTable");
  if (!box) return; // Falls Script auf anderer Seite geladen wird

  // Hilfen
  function parseHHMM(s) {
    var p = String(s || "00:00").split(":");
    return { h: Number(p[0] || 0), m: Number(p[1] || 0) };
  }

  function fmtTime(hhmm) {
    if (!hhmm) return "—";
    var hm = parseHHMM(hhmm);
    var d = new Date();
    d.setHours(hm.h, hm.m, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Liefert Status für "jetzt" (beachtet r.closed)
  function computeStatus(hours) {
    var now = new Date();
    var keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    var k = keys[now.getDay()];
    var r = hours && hours.regular ? hours.regular[k] : null;
    if (!r) return { open: false, soon: false, last: null, next: null };
    if (r.closed) return { open: false, soon: false, last: null, next: null };

    var o = parseHHMM(r.open);
    var c = parseHHMM(r.close);
    var l = parseHHMM(r.last_order || r.close);

    var openTime  = new Date(now); openTime.setHours(o.h, o.m, 0, 0);
    var closeTime = new Date(now); closeTime.setHours(c.h, c.m, 0, 0);
    var lastTime  = new Date(now); lastTime.setHours(l.h, l.m, 0, 0);

    if (now < openTime) return { open: false, soon: false, last: lastTime, next: openTime };
    if (now > closeTime) {
      var nxt = new Date(openTime.getTime() + 24 * 3600 * 1000);
      return { open: false, soon: false, last: lastTime, next: nxt };
    }
    var soon = (lastTime - now) / 60000 < 30;
    return { open: true, soon: soon, last: lastTime, next: null };
  }

  function render(hours) {
    var dayNamesDe = {
      mon: "Montag", tue: "Dienstag", wed: "Mittwoch",
      thu: "Donnerstag", fri: "Freitag", sat: "Samstag", sun: "Sonntag"
    };
    var order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    var todayIdx = new Date().getDay(); // 0..6 (0=So)
    var keyByIdx = ["sun","mon","tue","wed","thu","fri","sat"];
    var todayKey = keyByIdx[todayIdx];

    // Kopf mit Status
    var st = computeStatus(hours);
    var statusLine = "";
    if (st.open) {
      statusLine = st.soon
        ? 'Heute <strong>geöffnet</strong>. Letzte Bestellungen bis <strong>' +
            st.last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "</strong>."
        : "Heute <strong>geöffnet</strong>.";
    } else {
      statusLine = "Aktuell <strong>geschlossen</strong>.";
    }

    // Tabelle
    var rows = "";
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var r = hours && hours.regular ? hours.regular[k] : null;
      var isToday = (k === todayKey);

      var row = '<tr' + (isToday ? ' aria-current="date"' : '') + '>' +
                  '<th scope="row">' + dayNamesDe[k] + (isToday ? ' <span class="badge">Heute</span>' : '') + '</th>';

      if (r && (r.closed === true || (!r.open && !r.close))) {
        row += '<td>geschlossen</td><td>–</td>';
      } else {
        var openTxt  = r ? fmtTime(r.open)  : "—";
        var closeTxt = r ? fmtTime(r.close) : "—";
        var lastTxt  = r ? fmtTime(r.last_order || r.close) : "—";
        row += '<td>' + openTxt + '–' + closeTxt + '</td><td>Letzte Best.: ' + lastTxt + '</td>';
      }

      row += '</tr>';
      rows += row;
    }

    box.innerHTML =
      '<div class="stack" style="display:grid; gap:.75rem;">' +
        '<div>' + statusLine + '</div>' +
        '<div class="card" style="padding:0; overflow:auto;">' +
          '<table class="table" style="width:100%; border-collapse:collapse;">' +
            '<thead>' +
              '<tr>' +
                '<th style="text-align:left; padding:.75rem; border-bottom:1px solid var(--border);">Tag</th>' +
                '<th style="text-align:left; padding:.75rem; border-bottom:1px solid var(--border);">Öffnung</th>' +
                '<th style="text-align:left; padding:.75rem; border-bottom:1px solid var(--border);">Bestellschluss</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  // Laden
  function load() {
    fetch("data/hours.json")
      .then(function (res) { return res.json(); })
      .then(function (json) { render(json || {}); })
      .catch(function () {
        box.innerHTML = '<div class="notice">Öffnungszeiten konnten nicht geladen werden.</div>';
      });
  }

  load();
})();
