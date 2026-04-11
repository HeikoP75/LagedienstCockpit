/* ============================================================
   personal-data.js – Cockpit OS Personalmodul
   CRUD · SharePoint-Sync via spStorage · localStorage-Cache
   Foto-Komprimierung: max 200×200px, JPEG 80 %
   ============================================================ */

const PersonalData = (() => {
  const LOCAL_KEY = 'pers_data_cache';  // localStorage-Cache
  const SP_KEY    = 'personal';         // Dateiname in SharePoint (personal.json)

  // ── ID-Generator ──────────────────────────────────────────
  function _uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
  }

  // ── Leer-Mitarbeiter-Template ─────────────────────────────
  function _emptyMa() {
    return {
      id:   _uid('ma'),
      foto: null,
      stammdaten: {
        vorname: '', nachname: '', geburtsdatum: '', geburtsort: '',
        familienstand: '',
        kinder: [],
        notfallkontakt1: { name: '', beziehung: '', telefon: '' },
        notfallkontakt2: { name: '', beziehung: '', telefon: '' },
        funktion: '', dienstgrad: '', schicht: '',
        eintrittUnternehmen: '', eintrittFeuerwehr: '',
        beschaeftigungsart: '', diensttelefon: '', privattelefon: '', email: ''
      },
      feuerwehr: {
        atemschutztauglich: false,
        maschinistStatus:   'kein',      // kein | teil | voll | sonder
        rtwQualifikation:   'keine'      // keine | RS | RA | NFS
      },
      eintraege:    [],
      eigeneFelder: [],
      meta: {
        erstelltAm:  new Date().toISOString(),
        geaendertAm: new Date().toISOString()
      }
    };
  }

  // ── Leer-Eintrag-Template ─────────────────────────────────
  function _emptyEintrag() {
    return {
      id:        _uid('e'),
      kategorie: 'Notiz',
      datum:     new Date().toISOString().slice(0,10),
      titel:     '',
      inhalt:    '',
      tags:      [],
      erstelltAm: new Date().toISOString()
    };
  }

  // ── Root-Objekt ───────────────────────────────────────────
  function _emptyRoot() {
    return { version: 1, exportedAt: new Date().toISOString(), mitarbeiter: [] };
  }

  // ── localStorage ──────────────────────────────────────────
  function _readCache() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const d   = raw ? JSON.parse(raw) : null;
      return (d && Array.isArray(d.mitarbeiter)) ? d : _emptyRoot();
    } catch { return _emptyRoot(); }
  }

  function _writeCache(root) {
    root.exportedAt = new Date().toISOString();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(root));
  }

  // ── SharePoint laden ──────────────────────────────────────
  async function _loadFromSP() {
    try {
      if (!spStorage.isConfigured()) return null;
      const data = await spStorage.readData(SP_KEY);
      if (data && Array.isArray(data.mitarbeiter)) {
        _writeCache(data);
        return data;
      }
      return null;
    } catch (e) {
      console.warn('SP-Laden fehlgeschlagen:', e.message);
      return null;
    }
  }

  // ── SharePoint speichern ──────────────────────────────────
  async function _saveToSP(root) {
    try {
      if (!spStorage.isConfigured()) return false;
      await spStorage.writeData(SP_KEY, root);
      return true;
    } catch (e) {
      console.warn('SP-Speichern fehlgeschlagen:', e.message);
      return false;
    }
  }

  // ── Foto komprimieren: max 200×200, JPEG 80 % ─────────────
  async function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = 200;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
          else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Öffentliche API ───────────────────────────────────────

  /** Alle Daten laden (SP bevorzugt, Fallback Cache) */
  async function load() {
    const sp = await _loadFromSP();
    return sp || _readCache();
  }

  /** Gesamten Datensatz speichern (Cache + SP) */
  async function save(root) {
    _writeCache(root);
    await _saveToSP(root);
  }

  /** Alle Mitarbeiter */
  async function listAll() {
    const root = await load();
    return root.mitarbeiter;
  }

  /** Einzelner Mitarbeiter per ID */
  async function getById(id) {
    const root = await load();
    return root.mitarbeiter.find(m => m.id === id) || null;
  }

  /** Neuen Mitarbeiter anlegen */
  async function create(data = {}) {
    const root = await load();
    const ma   = Object.assign(_emptyMa(), data);
    ma.meta.erstelltAm = ma.meta.geaendertAm = new Date().toISOString();
    root.mitarbeiter.push(ma);
    await save(root);
    return ma;
  }

  /** Mitarbeiter aktualisieren (partiell via patch-Objekt) */
  async function update(id, patch) {
    const root = await load();
    const idx  = root.mitarbeiter.findIndex(m => m.id === id);
    if (idx === -1) throw new Error(`Mitarbeiter ${id} nicht gefunden.`);
    const ma = root.mitarbeiter[idx];
    // Tiefes Merge auf Top-Level-Objekte
    for (const [k, v] of Object.entries(patch)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && typeof ma[k] === 'object') {
        Object.assign(ma[k], v);
      } else {
        ma[k] = v;
      }
    }
    ma.meta.geaendertAm = new Date().toISOString();
    root.mitarbeiter[idx] = ma;
    await save(root);
    return ma;
  }

  /** Mitarbeiter löschen */
  async function remove(id) {
    const root = await load();
    const before = root.mitarbeiter.length;
    root.mitarbeiter = root.mitarbeiter.filter(m => m.id !== id);
    if (root.mitarbeiter.length === before) throw new Error(`Mitarbeiter ${id} nicht gefunden.`);
    await save(root);
  }

  // ── Einträge ──────────────────────────────────────────────

  /** Eintrag hinzufügen */
  async function addEintrag(maId, eintrag = {}) {
    const root = await load();
    const ma   = root.mitarbeiter.find(m => m.id === maId);
    if (!ma) throw new Error(`Mitarbeiter ${maId} nicht gefunden.`);
    const e = Object.assign(_emptyEintrag(), eintrag);
    e.id = _uid('e');
    e.erstelltAm = new Date().toISOString();
    ma.eintraege.unshift(e);  // neueste zuerst
    ma.meta.geaendertAm = new Date().toISOString();
    await save(root);
    return e;
  }

  /** Eintrag aktualisieren */
  async function updateEintrag(maId, eintragId, patch) {
    const root = await load();
    const ma   = root.mitarbeiter.find(m => m.id === maId);
    if (!ma) throw new Error('Mitarbeiter nicht gefunden.');
    const idx  = ma.eintraege.findIndex(e => e.id === eintragId);
    if (idx === -1) throw new Error('Eintrag nicht gefunden.');
    Object.assign(ma.eintraege[idx], patch);
    ma.meta.geaendertAm = new Date().toISOString();
    await save(root);
    return ma.eintraege[idx];
  }

  /** Eintrag löschen */
  async function removeEintrag(maId, eintragId) {
    const root = await load();
    const ma   = root.mitarbeiter.find(m => m.id === maId);
    if (!ma) throw new Error('Mitarbeiter nicht gefunden.');
    ma.eintraege = ma.eintraege.filter(e => e.id !== eintragId);
    ma.meta.geaendertAm = new Date().toISOString();
    await save(root);
  }

  // ── Eigene Felder ─────────────────────────────────────────

  async function setEigeneFelder(maId, felder) {
    return update(maId, { eigeneFelder: felder });
  }

  // ── Suche ─────────────────────────────────────────────────

  /**
   * Volltext-Suche über Name, Funktion, Dienstgrad, Eintragsinhalt
   * @param {string} q Suchbegriff
   * @param {object[]} liste Mitarbeiter-Array
   */
  function search(q, liste) {
    if (!q || !q.trim()) return liste;
    const lower = q.toLowerCase().trim();
    return liste.filter(ma => {
      const sd = ma.stammdaten;
      const fields = [
        sd.vorname, sd.nachname, sd.funktion, sd.dienstgrad, sd.schicht,
        sd.email, sd.diensttelefon
      ];
      if (fields.some(f => (f || '').toLowerCase().includes(lower))) return true;
      return ma.eintraege.some(e =>
        (e.titel + ' ' + e.inhalt + ' ' + (e.tags || []).join(' ')).toLowerCase().includes(lower)
      );
    });
  }

  return {
    load, save, listAll, getById,
    create, update, remove,
    addEintrag, updateEintrag, removeEintrag,
    setEigeneFelder,
    compressPhoto,
    search,
    newEintrag: () => ({
      id: '', kategorie: 'Notiz',
      datum: new Date().toISOString().slice(0,10),
      titel: '', inhalt: '', tags: [], erstelltAm: ''
    })
  };
})();
