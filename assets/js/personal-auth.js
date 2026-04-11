/* ============================================================
   personal-auth.js – Cockpit OS Personalmodul
   WebAuthn (Face ID / Windows Hello) + PIN-Fallback (SHA-256)
   ============================================================ */

const AUTH = (() => {
  const SESSION_KEY  = 'pers_session';      // sessionStorage: authentifiziert für diesen Tab
  const CRED_KEY     = 'pers_webauthn_id';  // localStorage:   Credential-ID (Base64)
  const PIN_KEY      = 'pers_pin_hash';     // localStorage:   SHA-256-Hash der PIN
  const SETUP_KEY    = 'pers_setup_done';   // localStorage:   Ersteinrichtung abgeschlossen

  // ── Hilfsfunktionen ───────────────────────────────────────
  function _b64ToUint8(b64) {
    const bin = atob(b64);
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  }
  function _uint8ToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  async function _sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  function _randomChallenge() {
    return crypto.getRandomValues(new Uint8Array(32));
  }
  function _isSetupDone()   { return !!localStorage.getItem(SETUP_KEY); }
  function _hasWebAuthn()   { return !!localStorage.getItem(CRED_KEY); }
  function _hasPin()        { return !!localStorage.getItem(PIN_KEY); }
  function _isSessionOk()   { return sessionStorage.getItem(SESSION_KEY) === 'ok'; }
  function _setSession()    { sessionStorage.setItem(SESSION_KEY, 'ok'); }
  function _clearSession()  { sessionStorage.removeItem(SESSION_KEY); }

  function webAuthnSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials);
  }

  // ── WebAuthn Registrierung ─────────────────────────────────
  async function registerWebAuthn() {
    if (!webAuthnSupported()) throw new Error('WebAuthn nicht unterstützt.');

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge:  _randomChallenge(),
        rp:         { name: 'Cockpit OS Personal' },
        user:       { id: new Uint8Array(16), name: 'LdK', displayName: 'Lagedienst-Koordinator' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          userVerification: 'required',   // erzwingt Biometrie / Geräte-PIN
          residentKey: 'discouraged'
        },
        timeout: 60000
      }
    });

    localStorage.setItem(CRED_KEY, _uint8ToB64(credential.rawId));
    return true;
  }

  // ── WebAuthn Authentifizierung ─────────────────────────────
  async function authenticateWebAuthn() {
    if (!webAuthnSupported()) throw new Error('WebAuthn nicht unterstützt.');
    const credId = localStorage.getItem(CRED_KEY);
    if (!credId) throw new Error('Kein Credential registriert.');

    await navigator.credentials.get({
      publicKey: {
        challenge:        _randomChallenge(),
        allowCredentials: [{ type: 'public-key', id: _b64ToUint8(credId) }],
        userVerification: 'required',
        timeout:          60000
      }
    });
    // Gerät hat Biometrie/PIN verifiziert → Session setzen
    _setSession();
    return true;
  }

  // ── PIN setzen ─────────────────────────────────────────────
  async function setPin(pin) {
    if (!/^\d{6}$/.test(pin)) throw new Error('PIN muss genau 6 Ziffern haben.');
    const hash = await _sha256(pin);
    localStorage.setItem(PIN_KEY, hash);
    return true;
  }

  // ── PIN prüfen ─────────────────────────────────────────────
  async function checkPin(pin) {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) throw new Error('Keine PIN gesetzt.');
    const hash = await _sha256(pin);
    if (hash !== stored) throw new Error('Falsche PIN.');
    _setSession();
    return true;
  }

  // ── PIN ändern (erfordert alte PIN) ───────────────────────
  async function changePin(oldPin, newPin) {
    await checkPin(oldPin);          // wirft bei Fehler
    _clearSession();                 // kurz zurücksetzen
    await setPin(newPin);
    _setSession();
    return true;
  }

  // ── Abmelden ──────────────────────────────────────────────
  function logout() { _clearSession(); }

  // ── Ersteinrichtung abschließen ───────────────────────────
  function completeSetup() { localStorage.setItem(SETUP_KEY, '1'); }

  // ── Öffentliche API ───────────────────────────────────────
  return {
    isSetupDone         : _isSetupDone,
    hasWebAuthn         : _hasWebAuthn,
    hasPin              : _hasPin,
    isAuthenticated     : _isSessionOk,
    webAuthnSupported,
    registerWebAuthn,
    authenticateWebAuthn,
    setPin,
    checkPin,
    changePin,
    logout,
    completeSetup
  };
})();
