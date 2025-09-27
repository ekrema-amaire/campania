// assets/js/auth.js
// Registrieren/Login -> sofort zum Profil umschalten & befüllen.
// Logout leert Formulare und springt zu #login. Login reagiert auch auf Enter (Form submit).
(function () {
  // ---------- Storage & Util ----------
  const KEY_USER = "campania-user";          // {id,first,last,email,passwordHash,profile,addresses}
  const KEY_SESS = "campania-session";       // {userId, sessionId, loggedInAt}
  const $ = (id) => document.getElementById(id);
  const now = () => new Date().toISOString();
  const genId = (p="id") => `${p}_${Math.random().toString(36).slice(2,10)}`;

  const loadUser = () => { try { return JSON.parse(localStorage.getItem(KEY_USER) || "null"); } catch { return null; } };
  const saveUser = (u) => { try { localStorage.setItem(KEY_USER, JSON.stringify(u)); } catch {} };

  const loadSess = () => { try { return JSON.parse(localStorage.getItem(KEY_SESS) || "null"); } catch { return null; } };
  const saveSess = (s) => { try { localStorage.setItem(KEY_SESS, JSON.stringify(s)); } catch {} };
  const clearSess = () => { try { localStorage.removeItem(KEY_SESS); } catch {} };

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmail = (e) => emailRe.test((e||"").trim());
  const validPwd   = (p) => typeof p==="string" && p.length >= 6;

  async function sha256(text){
    try{
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }catch{ return "h_"+btoa(text); } // Fallback für unsicheren Kontext
  }

  function emitAuthChange(){
    try {
      window.dispatchEvent(new CustomEvent("auth:change", {
        detail: { isLoggedIn: Auth.isLoggedIn(), user: Auth.getUser() }
      }));
    } catch {}
  }

  // ---------- Public API ----------
  async function register({ first="", last="", email="", password="" } = {}){
    if (!validEmail(email)) throw new Error("invalid_email");
    if (!validPwd(password)) throw new Error("weak_password");
    if (loadUser()) throw new Error("already_has_account");

    const user = {
      id: genId("user"),
      first: first.trim(), last: last.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await sha256(password),
      profile: { phone:"", newsletter:false, createdAt: now() },
      addresses: []
    };
    saveUser(user);

    // auto-login
    saveSess({ userId: user.id, sessionId: genId("sess"), loggedInAt: now() });
    emitAuthChange();
    return true;
  }

  async function login(email, password){
    const u = loadUser();
    if (!u) throw new Error("no_account");
    if ((email||"").trim().toLowerCase() !== u.email) throw new Error("email_mismatch");
    const h = await sha256(password||"");
    if (h !== u.passwordHash) throw new Error("bad_password");
    saveSess({ userId: u.id, sessionId: genId("sess"), loggedInAt: now() });
    emitAuthChange();
    return true;
  }

  function logout(){ clearSess(); emitAuthChange(); }
  function isLoggedIn(){ const s = loadSess(); const u = loadUser(); return !!(s && u && s.userId===u.id); }
  function getUser(){ return loadUser(); }

  function updateProfile({ first, last, email, phone, newsletter } = {}){
    const u = loadUser(); if (!u) return;
    if (first !== undefined) u.first = (first||"").trim();
    if (last  !== undefined) u.last  = (last||"").trim();
    if (email !== undefined) {
      if (!validEmail(email)) throw new Error("invalid_email");
      u.email = email.trim().toLowerCase();
    }
    if (phone !== undefined) u.profile.phone = (phone||"").trim();
    if (newsletter !== undefined) u.profile.newsletter = !!newsletter;
    saveUser(u);
    emitAuthChange();
  }

  async function changePassword(oldPwd, newPwd){
    if (!validPwd(newPwd)) throw new Error("weak_password");
    const u = loadUser(); if (!u) throw new Error("no_account");
    const ok = (await sha256(oldPwd||"")) === u.passwordHash;
    if (!ok) throw new Error("bad_password");
    u.passwordHash = await sha256(newPwd);
    saveUser(u);
    emitAuthChange();
  }

  // ------ Addresses ------
  const getAddresses = () => (loadUser()?.addresses || []);
  const getAddress   = (id) => getAddresses().find(a => a.id===id);
  function addAddress(a = {}){
    const u = loadUser(); if(!u) return;
    const addr = {
      id: genId("addr"),
      label: (a.label||"").trim(),
      street: (a.street||"").trim(),
      zip: (a.zip||"").trim(),
      city: (a.city||"").trim(),
      info: (a.info||"").trim(),
      isDefault: !!a.isDefault
    };
    if (addr.isDefault) (u.addresses||[]).forEach(x=>x.isDefault=false);
    u.addresses = [...(u.addresses||[]), addr];
    saveUser(u);
    emitAuthChange();
    return addr.id;
  }
  function updateAddress(id, data = {}){
    const u = loadUser(); if(!u) return;
    u.addresses = (u.addresses||[]).map(x => x.id===id ? {
      ...x,
      ...(data.label   !== undefined ? { label: String(data.label).trim() }   : {}),
      ...(data.street  !== undefined ? { street: String(data.street).trim() } : {}),
      ...(data.zip     !== undefined ? { zip: String(data.zip).trim() }       : {}),
      ...(data.city    !== undefined ? { city: String(data.city).trim() }     : {}),
      ...(data.info    !== undefined ? { info: String(data.info).trim() }     : {}),
      ...(data.isDefault !== undefined ? { isDefault: !!data.isDefault }      : {}),
    } : x);
    if (data.isDefault) u.addresses.forEach(x => x.isDefault = (x.id===id));
    saveUser(u);
    emitAuthChange();
  }
  function deleteAddress(id){
    const u = loadUser(); if(!u) return;
    u.addresses = (u.addresses||[]).filter(x => x.id!==id);
    if (!u.addresses.some(a=>a.isDefault) && u.addresses[0]) u.addresses[0].isDefault = true;
    saveUser(u);
    emitAuthChange();
  }
  function setDefaultAddress(id){
    const u = loadUser(); if(!u) return;
    (u.addresses||[]).forEach(a => a.isDefault = (a.id===id));
    saveUser(u);
    emitAuthChange();
  }

  // expose
  window.Auth = {
    // state
    isLoggedIn, getUser,
    // auth
    register, login, logout, changePassword,
    // profile
    updateProfile,
    // addresses
    getAddresses, getAddress, addAddress, updateAddress, deleteAddress, setDefaultAddress
  };

  // ---------- Konto-UI Wiring ----------
  document.addEventListener("DOMContentLoaded", () => {
    const forms = $("#authForms");
    const dash  = $("#accountDashboard");
    if (!forms && !dash) return;

    // sicheres Einfügen für Überschrift
    function renderHeader(){
      const el = document.querySelector('[data-auth="accountLabel"]');
      if (!el) return;
      const u = Auth.getUser();
      el.textContent = Auth.isLoggedIn() ? (u.first || u.email) : "Konto";
    }

    // Profilfelder hydratisieren
    function hydrateProfileFields(u){
      $("#accFirst") && ($("#accFirst").value = u.first || "");
      $("#accLast")  && ($("#accLast").value  = u.last  || "");
      $("#accEmail") && ($("#accEmail").value = u.email || "");
      $("#accPhone") && ($("#accPhone").value = u.profile?.phone || "");
      $("#accNewsletter") && ($("#accNewsletter").checked = !!u.profile?.newsletter);

      const s = document.getElementById('accSince');
      if (s) {
        const d = new Date(u.profile?.createdAt || Date.now());
        s.textContent = d.toLocaleDateString('de-DE', { year:'numeric', month:'short', day:'2-digit' });
      }
    }

    // Auth-Formulare komplett leeren (für Logout)
    function clearAuthForms(){
      // Registrieren
      $("#regFirst")  && ($("#regFirst").value  = "");
      $("#regLast")   && ($("#regLast").value   = "");
      $("#regEmail")  && ($("#regEmail").value  = "");
      $("#regPassword") && ($("#regPassword").value = "");
      $("#regMsg")    && ($("#regMsg").textContent = "");
      // Login
      $("#loginEmail")    && ($("#loginEmail").value    = "");
      $("#loginPassword") && ($("#loginPassword").value = "");
      $("#loginMsg")      && ($("#loginMsg").textContent = "");
      // Formulare resetten (Autofill vorbeugen)
      document.getElementById("regForm")?.reset();
      document.getElementById("loginForm")?.reset();
    }

    // Adresse(n) rendern
    const esc = (s) => String(s ?? "").replace(/[&<]/g, (m)=> m==="&"?"&amp;":"&lt;");
    function renderAddresses(){
      const list = $("#addrList"); if(!list) return;
      const addrs = Auth.getAddresses();
      list.innerHTML = addrs.length ? "" : '<div class="notice">Noch keine Adressen.</div>';
      addrs.forEach(a=>{
        const row = document.createElement("div");
        row.className = "card"; row.style.padding=".75rem";
        row.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:.5rem; align-items:center;">
            <div>
              <strong>${esc(a.label || "Adresse")}</strong>${a.isDefault ? ' <span class="badge">Standard</span>' : ''}<br>
              ${esc(a.street)}<br>${esc(a.zip)} ${esc(a.city)}${a.info ? " • " + esc(a.info) : ""}
            </div>
            <div style="display:flex; gap:.5rem;">
              <button class="btn ghost" data-act="default" data-id="${a.id}">Als Standard</button>
              <button class="btn ghost" data-act="edit" data-id="${a.id}">Bearbeiten</button>
              <button class="btn ghost" data-act="del" data-id="${a.id}">Löschen</button>
            </div>
          </div>`;
        list.appendChild(row);
      });
    }

    // Ansicht aktualisieren
    function refresh(){
      const logged = Auth.isLoggedIn();

      if (forms) forms.style.display = logged ? "none" : "block";
      if (dash)  dash.style.display  = logged ? "block" : "none";

      if (logged && dash){
        const u = Auth.getUser() || {};
        hydrateProfileFields(u);
        renderAddresses();
      } else {
        // Wenn ausgeloggt und die Formulare sichtbar werden → leeren
        clearAuthForms();
      }

      renderHeader();
      document.documentElement.dataset.auth = logged ? "in" : "out";
    }

    // --- Register (Click + Enter im Formular) ---
    const regBtn = $("#registerBtn");
    if (regBtn) {
      regBtn._wired = true;
      regBtn.addEventListener("click", onRegister);
      document.getElementById("regForm")?.addEventListener("submit", (e)=>{ e.preventDefault(); onRegister(e); });
    }
    async function onRegister(e){
      e && e.preventDefault();
      const m = $("#regMsg");
      try{
        await register({
          first: $("#regFirst")?.value, last: $("#regLast")?.value,
          email: $("#regEmail")?.value, password: $("#regPassword")?.value
        });
        m && (m.textContent = "Registrierung erfolgreich – du bist eingeloggt.");

        const u = Auth.getUser() || {};
        if (forms) forms.style.display = "none";
        if (dash)  dash.style.display  = "block";
        hydrateProfileFields(u);
        renderHeader();

        applyHeaderAccountLink();
        try { history.replaceState({}, "", "konto.html"); } catch {}
        document.documentElement.dataset.auth = "in";
        window.dispatchEvent(new CustomEvent("auth:change", { detail:{ isLoggedIn:true, user:u } }));
      }catch(err){
        m && (m.textContent =
          err?.message==="invalid_email"       ? "Bitte gültige E-Mail eingeben." :
          err?.message==="weak_password"       ? "Passwort min. 6 Zeichen." :
          err?.message==="already_has_account" ? "In diesem Browser existiert bereits ein Konto." :
          "Registrierung fehlgeschlagen."
        );
      }
    }

    // --- Login (Click + Enter im Formular) ---
    const loginBtn = $("#loginBtn");
    if (loginBtn) {
      loginBtn._wired = true;
      loginBtn.addEventListener("click", onLogin);
      document.getElementById("loginForm")?.addEventListener("submit", (e)=>{ e.preventDefault(); onLogin(e); });
    }
    async function onLogin(e){
      e && e.preventDefault();
      const m = $("#loginMsg");
      try{
        await login($("#loginEmail")?.value, $("#loginPassword")?.value);
        m && (m.textContent = "Erfolgreich eingeloggt.");

        const u = Auth.getUser() || {};
        if (forms) forms.style.display = "none";
        if (dash)  dash.style.display  = "block";
        hydrateProfileFields(u);
        renderHeader();

        applyHeaderAccountLink();
        try { history.replaceState({}, "", "konto.html"); } catch {}
        document.documentElement.dataset.auth = "in";
        window.dispatchEvent(new CustomEvent("auth:change", { detail:{ isLoggedIn:true, user:u } }));
      }catch(err){
        m && (m.textContent =
          err?.message==="no_account"     ? "Kein Konto vorhanden." :
          err?.message==="email_mismatch" ? "E-Mail stimmt nicht." :
          err?.message==="bad_password"   ? "Falsches Passwort." :
          "Login fehlgeschlagen."
        );
      }
    }

    // --- Logout (leert Formulare & springt zu #login)
    const logoutBtn = $("#logoutBtn");
    if (logoutBtn && !logoutBtn._wired) {
      logoutBtn._wired = true;
      logoutBtn.addEventListener("click", (e)=>{
        e.preventDefault();
        try { logout(); } catch {}

        if (forms) forms.style.display = "block";
        if (dash)  dash.style.display  = "none";

        clearAuthForms(); // <<< Felder leeren
        try { history.replaceState({}, "", "konto.html#login"); } catch {}

        document.documentElement.dataset.auth = "out";
        applyHeaderAccountLink();
        window.dispatchEvent(new CustomEvent("auth:change", { detail:{ isLoggedIn:false, user:null } }));
      });
    }

    // --- Profil speichern
    $("#saveProfileBtn")?.addEventListener("click", ()=>{
      try{
        updateProfile({
          first: $("#accFirst")?.value, last: $("#accLast")?.value,
          email: $("#accEmail")?.value, phone: $("#accPhone")?.value,
          newsletter: $("#accNewsletter")?.checked
        });
        $("#profileMsg") && ($("#profileMsg").textContent = "Profil gespeichert.");
        renderHeader();
        applyHeaderAccountLink();
      }catch(err){
        $("#profileMsg") && ($("#profileMsg").textContent = err.message==="invalid_email" ? "Ungültige E-Mail." : "Speichern fehlgeschlagen.");
      }
    });

    // --- Passwort ändern
    $("#changePwdBtn")?.addEventListener("click", async ()=>{
      const m = $("#pwdMsg");
      try{
        await changePassword($("#oldPwd")?.value, $("#newPwd")?.value);
        m && (m.textContent = "Passwort aktualisiert.");
      }catch(err){
        m && (m.textContent =
          err?.message==="weak_password" ? "Neues Passwort min. 6 Zeichen." :
          err?.message==="bad_password"  ? "Altes Passwort falsch." :
          "Änderung fehlgeschlagen."
        );
      }
    });

    // --- Adressen
    $("#addrSaveBtn")?.addEventListener("click", ()=>{
      addAddress({
        label: $("#addrLabel")?.value, street: $("#addrStreet")?.value,
        zip: $("#addrZip")?.value, city: $("#addrCity")?.value,
        info: $("#addrInfo")?.value, isDefault: $("#addrDefault")?.checked
      });
      ["addrLabel","addrStreet","addrZip","addrCity","addrInfo","addrDefault"].forEach(id=>{
        const el = $("#"+id); if(!el) return; if(el.type==="checkbox") el.checked=false; else el.value="";
      });
      const u = Auth.getUser() || {};
      hydrateProfileFields(u);
      renderAddresses();
    });

    $("#addrList")?.addEventListener("click", (e)=>{
      const b = e.target.closest("button"); if(!b) return;
      const id = b.dataset.id, act = b.dataset.act;
      if (act==="del"){ deleteAddress(id); }
      if (act==="default"){ setDefaultAddress(id); }
      if (act==="edit"){
        const a = getAddress(id); if(!a) return;
        $("#addrLabel") && ($("#addrLabel").value=a.label||"");
        $("#addrStreet") && ($("#addrStreet").value=a.street||"");
        $("#addrZip") && ($("#addrZip").value=a.zip||"");
        $("#addrCity") && ($("#addrCity").value=a.city||"");
        $("#addrInfo") && ($("#addrInfo").value=a.info||"");
        $("#addrDefault") && ($("#addrDefault").checked=!!a.isDefault);
        const btn = $("#addrSaveBtn");
        const orig = btn?.onclick || null;
        if (btn) btn.onclick = ()=>{ updateAddress(id,{
          label:$("#addrLabel")?.value, street:$("#addrStreet")?.value,
          zip:$("#addrZip")?.value, city:$("#addrCity")?.value,
          info:$("#addrInfo")?.value, isDefault:$("#addrDefault")?.checked
        }); if (btn) btn.onclick = orig; const u = Auth.getUser() || {}; hydrateProfileFields(u); renderAddresses(); };
      }
    });

    // Initial
    refresh();
  });

  // ---- Header-Link „Konto (Name)“ ----
  function applyHeaderAccountLink(){
    const isIn = Auth.isLoggedIn();
    const u = isIn ? Auth.getUser() : null;
    const a = document.querySelector('[data-auth="account"]');
    if (a) a.textContent = isIn ? `Konto (${u.first || u.email || 'Ich'})` : 'Konto';
  }
  document.addEventListener('DOMContentLoaded', applyHeaderAccountLink);

  // Bei jedem Auth-Wechsel: dataset.auth & Header-Text aktualisieren
  window.addEventListener('auth:change', () => {
    document.documentElement.dataset.auth = (window.Auth?.isLoggedIn?.()) ? 'in' : 'out';
    applyHeaderAccountLink();
  });

  // Globaler Logout-Fallback via Delegation (#logoutBtn oder [data-act="logout"])
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#logoutBtn,[data-act="logout"]');
    if (!btn) return;
    e.preventDefault();
    try { if (window.Auth?.logout) Auth.logout(); } catch {}
    const forms = document.getElementById('authForms');
    const dash  = document.getElementById('accountDashboard');
    if (forms) forms.style.display = 'block';
    if (dash)  dash.style.display  = 'none';
    const headerLink = document.querySelector('[data-auth="account"]');
    if (headerLink) headerLink.textContent = 'Konto';
    document.documentElement.dataset.auth = 'out';
    // Hinweis: Hier keine Feld-Löschung (die macht der gezielte Logout-Handler oben).
    window.dispatchEvent(new CustomEvent('auth:change', { detail: { isLoggedIn: false, user: null }}));
  });

})();
