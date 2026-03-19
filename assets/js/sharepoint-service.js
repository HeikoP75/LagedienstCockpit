/**
 * SharePoint Storage Service – Lagedienst Cockpit
 * Version: 1.0
 *
 * Speichert Daten als JSON-Dateien in einer SharePoint-Dokumentenbibliothek.
 * Nutzt die SharePoint REST API mit sitzungsbasierter Authentifizierung –
 * kein Azure AD / OAuth erforderlich, solange die App im selben SharePoint-Tenant läuft.
 *
 * Einrichtung (einmalig, ohne IT-Berechtigungen):
 *  1. In SharePoint eine Dokumentenbibliothek oder einen Ordner erstellen,
 *     z. B. "Freigegebene Dokumente / LDC_Daten"
 *  2. Den serverrelativen Pfad notieren (Beispiel: /sites/Lagedienst/Freigegebene Dokumente/LDC_Daten)
 *  3. In der App unter Admin → SharePoint-Einstellungen konfigurieren
 */

const LDC_SP_CONFIG_KEY = 'ldc_sp_config';

class SharePointStorage {
  constructor() {
    this._reload();
  }

  /** Konfiguration aus localStorage laden (wird auch nach Änderungen aufgerufen) */
  _reload() {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(LDC_SP_CONFIG_KEY) || '{}'); } catch { /* ignore */ }
    this.siteUrl    = (cfg.siteUrl    || '').replace(/\/$/, '');
    this.folderPath = (cfg.folderPath || '').replace(/\/$/, '');
    this.enabled    = !!(this.siteUrl && this.folderPath);
  }

  /** Gibt zurück, ob SharePoint konfiguriert ist */
  isConfigured() {
    this._reload();
    return this.enabled;
  }

  /**
   * Verbindungstest – gibt { ok, title } oder { ok: false, error } zurück
   */
  async testConnection() {
    this._reload();
    if (!this.siteUrl) return { ok: false, error: 'Keine Site-URL konfiguriert.' };
    try {
      const res = await fetch(`${this.siteUrl}/_api/web?$select=Title`, {
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'include'
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status} – bitte prüfen, ob du auf SharePoint eingeloggt bist.` };
      const data = await res.json();
      return { ok: true, title: data.d.Title };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Prüft, ob der konfigurierte Ordner in SharePoint existiert.
   */
  async testFolder() {
    this._reload();
    if (!this.folderPath) return { ok: false, error: 'Kein Ordnerpfad konfiguriert.' };
    try {
      const encoded = encodeURIComponent(this.folderPath);
      const res = await fetch(
        `${this.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encoded}')?$select=Name`,
        { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' }
      );
      if (res.status === 404) return { ok: false, error: 'Ordner nicht gefunden. Bitte Pfad prüfen.' };
      if (!res.ok)            return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, name: data.d.Name };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /** Request-Digest für Schreiboperationen holen */
  async _getDigest() {
    const res = await fetch(`${this.siteUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: { 'Accept': 'application/json;odata=verbose' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Digest-Fehler: HTTP ${res.status}`);
    const data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
  }

  /**
   * JSON-Datei aus SharePoint lesen.
   * @param {string} key  - Dateiname ohne Endung (z. B. 'massnahmen')
   * @returns {any|null}  - geparste JSON-Daten oder null (Datei nicht vorhanden)
   */
  async readData(key) {
    this._reload();
    if (!this.enabled) throw new Error('SharePoint nicht konfiguriert.');

    // Direkte Datei-URL: SharePoint liefert statische Dateien ohne API
    const origin   = new URL(this.siteUrl).origin;
    const fileUrl  = `${origin}${this.folderPath}/${key}.json`;
    const res = await fetch(fileUrl, { credentials: 'include' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lesen fehlgeschlagen: HTTP ${res.status}`);
    return await res.json();
  }

  /**
   * JSON-Datei in SharePoint speichern (erstellen oder überschreiben).
   * @param {string} key  - Dateiname ohne Endung (z. B. 'massnahmen')
   * @param {any}    data - Zu speichernde Daten (werden als JSON serialisiert)
   */
  async writeData(key, data) {
    this._reload();
    if (!this.enabled) throw new Error('SharePoint nicht konfiguriert.');

    const digest    = await this._getDigest();
    const encoded   = encodeURIComponent(this.folderPath);
    const uploadUrl = `${this.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encoded}')/Files/Add(url='${key}.json',overwrite=true)`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept':         'application/json;odata=verbose',
        'X-RequestDigest': digest,
        'Content-Type':   'application/octet-stream'
      },
      credentials: 'include',
      body: JSON.stringify(data, null, 2)
    });
    if (!res.ok) throw new Error(`Schreiben fehlgeschlagen: HTTP ${res.status}`);
    return true;
  }

  /**
   * Hilfsfunktion: Alle LDC-Daten von localStorage nach SharePoint exportieren.
   * @returns {{ massnahmen: bool, bibliothek: bool }} Ergebnis pro Datei
   */
  async exportAllToSharePoint() {
    const results = {};
    const exports = [
      { key: 'massnahmen', localKey: 'admin_massnahmen_v1' },
      { key: 'bibliothek', localKey: 'bibliothek_custom_entries_v1' }
    ];
    for (const e of exports) {
      try {
        const raw  = localStorage.getItem(e.localKey);
        const data = raw ? JSON.parse(raw) : [];
        await this.writeData(e.key, data);
        results[e.key] = { ok: true };
      } catch (err) {
        results[e.key] = { ok: false, error: err.message };
      }
    }
    return results;
  }

  /**
   * Hilfsfunktion: Alle LDC-Daten von SharePoint in localStorage importieren.
   * @returns {{ massnahmen: bool, bibliothek: bool }} Ergebnis pro Datei
   */
  async importAllFromSharePoint() {
    const results = {};
    const imports = [
      { key: 'massnahmen', localKey: 'admin_massnahmen_v1' },
      { key: 'bibliothek', localKey: 'bibliothek_custom_entries_v1' }
    ];
    for (const i of imports) {
      try {
        const data = await this.readData(i.key);
        if (data !== null) {
          localStorage.setItem(i.localKey, JSON.stringify(data));
          results[i.key] = { ok: true, count: Array.isArray(data) ? data.length : 0 };
        } else {
          results[i.key] = { ok: true, count: 0, note: 'Keine Datei vorhanden' };
        }
      } catch (err) {
        results[i.key] = { ok: false, error: err.message };
      }
    }
    return results;
  }
}

// Singleton-Instanz für die gesamte App
const spStorage = new SharePointStorage();
