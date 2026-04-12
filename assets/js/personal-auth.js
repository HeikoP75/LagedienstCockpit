(function attachPersonalAuth(global) {
  const SESSION_KEY = "personal.authenticated";
  const PIN_HASH_KEY = "personal.pinHash";
  const WEBAUTHN_CREDENTIALS_KEY = "personal.webauthn.credentials";
  const WEBAUTHN_USER_ID_KEY = "personal.webauthn.userId";

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function base64ToBuffer(value) {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return bytes.buffer;
  }

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function createRandomBuffer(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function getStoredCredentials() {
    try {
      return JSON.parse(localStorage.getItem(WEBAUTHN_CREDENTIALS_KEY) || "[]");
    } catch (error) {
      console.warn("WebAuthn credentials could not be parsed.", error);
      return [];
    }
  }

  function saveStoredCredentials(credentials) {
    localStorage.setItem(WEBAUTHN_CREDENTIALS_KEY, JSON.stringify(credentials));
  }

  function getOrCreateUserId() {
    const stored = localStorage.getItem(WEBAUTHN_USER_ID_KEY);
    if (stored) {
      return base64ToBuffer(stored);
    }
    const randomUserId = createRandomBuffer(32);
    localStorage.setItem(WEBAUTHN_USER_ID_KEY, bufferToBase64(randomUserId));
    return randomUserId.buffer;
  }

  function isPinSet() {
    return Boolean(localStorage.getItem(PIN_HASH_KEY));
  }

  function hasWebAuthnCredential() {
    return getStoredCredentials().length > 0;
  }

  function isFirstAccess() {
    return !isPinSet() && !hasWebAuthnCredential();
  }

  function isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  }

  function setAuthenticated(value) {
    if (value) {
      sessionStorage.setItem(SESSION_KEY, "true");
      return;
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

  function validatePin(pin) {
    return /^\d{6}$/.test(pin);
  }

  async function setPin(pin) {
    if (!validatePin(pin)) {
      throw new Error("Die PIN muss genau 6 Ziffern haben.");
    }
    const hash = await sha256(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
    setAuthenticated(true);
    return true;
  }

  async function verifyPin(pin) {
    if (!validatePin(pin)) {
      throw new Error("Die PIN muss genau 6 Ziffern haben.");
    }
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) {
      throw new Error("Es ist noch keine PIN hinterlegt.");
    }
    const providedHash = await sha256(pin);
    const isValid = storedHash === providedHash;
    setAuthenticated(isValid);
    return isValid;
  }

  async function registerWebAuthn(displayName = "CockpitOS Personal") {
    if (!("PublicKeyCredential" in global) || !navigator.credentials?.create) {
      throw new Error("WebAuthn wird in diesem Browser nicht unterstützt.");
    }

    const challenge = createRandomBuffer(32);
    const userId = getOrCreateUserId();
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "CockpitOS Personal" },
        user: {
          id: userId,
          name: "personal@cockpitos.local",
          displayName
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    if (!credential) {
      throw new Error("Die WebAuthn-Registrierung wurde abgebrochen.");
    }

    const existingCredentials = getStoredCredentials();
    existingCredentials.push({
      id: credential.id,
      rawId: bufferToBase64(credential.rawId),
      type: credential.type
    });
    saveStoredCredentials(existingCredentials);
    setAuthenticated(true);
    return credential;
  }

  async function authenticateWithWebAuthn() {
    if (!("PublicKeyCredential" in global) || !navigator.credentials?.get) {
      throw new Error("WebAuthn wird in diesem Browser nicht unterstützt.");
    }

    const storedCredentials = getStoredCredentials();
    if (!storedCredentials.length) {
      throw new Error("Es ist noch kein WebAuthn-Zugang registriert.");
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: createRandomBuffer(32),
        allowCredentials: storedCredentials.map((credential) => ({
          id: base64ToBuffer(credential.rawId),
          type: "public-key"
        })),
        userVerification: "preferred",
        timeout: 60000
      }
    });

    const isKnownCredential = Boolean(
      assertion?.id && storedCredentials.some((credential) => credential.id === assertion.id)
    );

    setAuthenticated(isKnownCredential);
    if (!isKnownCredential) {
      throw new Error("Der WebAuthn-Nachweis konnte nicht zugeordnet werden.");
    }
    return true;
  }

  function logout() {
    setAuthenticated(false);
  }

  global.personalAuth = {
    SESSION_KEY,
    isAuthenticated,
    isFirstAccess,
    isPinSet,
    hasWebAuthnCredential,
    validatePin,
    setPin,
    verifyPin,
    registerWebAuthn,
    authenticateWithWebAuthn,
    logout
  };
})(window);
