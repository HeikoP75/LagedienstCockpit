# Lagedienst Cockpit – Vollständige Projektdokumentation

> **Zweck dieser Datei:** Technische Bestandsaufnahme für KI-gestützte Weiterentwicklung.  
> **Stand:** April 2026 · Branch: `claude/review-website-improvements-77Z97`

---

## 1. Was ist das Lagedienst Cockpit?

Offlinefähige **Progressive Web App (PWA)** für die strukturierte Einsatzbearbeitung im Chempark Leverkusen (Werkfeuerwehr / Lagedienst). Kein Backend, kein Build-Tool – reines Vanilla HTML/CSS/JS.

**Kernfunktionen heute:**
- Checklisten-basierte Einsatzbearbeitung für 7 Einsatzarten
- Pflicht / Optional / Intervall-Maßnahmen mit automatischem Timer
- Admin-Bereich zur zentralen Maßnahmen- und Bibliothekspflege
- Einsatzstand als JSON exportieren/importieren + PDF-Druck
- Lesson Learned erfassen und in Bibliothek ablegen
- Durchsuchbare Wissensbibliothek
- SharePoint-Sync (optional, session-basiert, kein OAuth)
- Vollständig offline via Service Worker

**Noch nicht fertig:**
- `uebergabe.html` – Seite existiert nicht (Link deaktiviert)
- `lexikon.html` – nur Platzhalter (30 Bytes)
- `erweiterte-lagebild.html` – Formular vorhanden, Sende-Logik fehlt
- Rettung / Störung / TUIS / Sonstiges – keine hardkodierten Basis-Maßnahmen

---

## 2. Projektstruktur – Alle Dateien

```
LagedienstCockpit/
├── index.html                  (16 KB)  Startseite / Dashboard
├── feuer.html                  (76 KB)  Checkliste Feuer – 38 hardkodierte Maßnahmen
├── gefahrgut.html              (76 KB)  Checkliste Gefahrgut – identisch zu feuer.html
├── hilfeleistung.html          (76 KB)  Checkliste Hilfeleistung – identisch zu feuer.html
├── rettung.html                (60 KB)  Checkliste Rettung – leere Maßnahmen (nur Admin)
├── stoerung.html               (60 KB)  Checkliste Störung – leere Maßnahmen (nur Admin)
├── tuis.html                   (60 KB)  Checkliste TUIS – leere Maßnahmen (nur Admin)
├── sonstiges.html              (60 KB)  Checkliste Sonstiges – leere Maßnahmen (nur Admin)
├── bibliothek.html             (20 KB)  Wissens- und Dokumentenbibliothek, durchsuchbar
├── erweiterte-lagebild.html    (12 KB)  KMvD-Lagebild-Formular (ausgelöst durch m27→m38)
├── admin.html                  ( 4 KB)  Admin-Hub mit Links zu den 3 Verwaltungsmodulen
├── admin-massnahmen.html       (16 KB)  Maßnahmen anlegen/bearbeiten (für alle 7 Einsatzarten)
├── admin-bibliothek.html       (12 KB)  Bibliothekseinträge anlegen/bearbeiten
├── admin-settings.html         (16 KB)  SharePoint-Konfiguration + Sync
├── lexikon.html                ( 0 KB)  Platzhalter "Seite in Arbeit"
├── manifest.json               ( 4 KB)  PWA-Manifest
├── service-worker.js           ( 4 KB)  Offline-Cache v2, alle Seiten gecacht
└── assets/
    ├── js/
    │   ├── sharepoint-service.js   SharePoint REST API Client (Klasse SharePointStorage)
    │   └── engine.js               Alte Maßnahmen-Engine v2.1 – NICHT aktiv genutzt (toter Code)
    ├── data/
    │   └── actions.feuer.json      Altes Maßnahmen-Format – NICHT mehr genutzt (toter Code)
    ├── icons/                      icon-16/32/192/512 + apple-touch-icon-180
    └── logo-chempark.png
```

**Wichtig – keine Dokumentation vorhanden:** Keine README, keine CLAUDE.md.

---

## 3. Architekturprinzipien

- **Offline-First:** Service Worker cached alle Assets, localStorage als primärer Datenspeicher
- **Kein Framework, kein Build-Tool:** Vanilla JS, direkt im Browser ausführbar
- **Kein Template-System:** Alle 7 Checklisten sind Copy-Paste – Änderungen müssen 7× gemacht werden
- **SharePoint optional:** Ergänzende Cloud-Speicherung, localStorage-Fallback wenn nicht konfiguriert
- **Maßnahmen-Zustand nur im RAM:** Kein automatisches Speichern des Einsatzfortschritts (nur manueller JSON-Export)
- **Externe CDN-Abhängigkeit:** `html2pdf.js@0.10.1` für PDF-Export – nicht im Service-Worker-Cache

---

## 4. Maßnahmen-Datenstruktur

### 4.1 Vollständiges Objekt-Schema

```javascript
{
  // --- Stammdaten ---
  id:              "m1",         // Basis: "m1"–"m38" | Admin: "admin_massnahme_<timestamp>"
  titel:           "AP10 einschalten",
  bereich:         "eintreffen", // "eintreffen"|"5min"|"10_20_30"|"30_45_60"|"ende"
  type:            "pflicht",    // "pflicht"|"optional"|"intervall"
  intervallMinutes: null,        // number|null – nur bei type="intervall"

  // --- Runtime-Zustand (nur im RAM, geht bei Reload verloren) ---
  status:          "offen",      // "offen" | "erledigt"
  nextDue:         null,         // Unix-Timestamp: wann Intervall wieder fällig
  dueState:        "neutral",    // "neutral" | "due"  (due = abgelaufen, optisch rot)
  infoText:        "",           // Anleitung / Beschreibung
  infoLinks:       "",           // URLs – String in Basis, string[] in Admin (Inkonsistenz!)
  infoOpen:        false,        // Info-Box gerade aufgeklappt?
  hidden:          false,        // Nur m38: true; wird durch m27 auf false gesetzt
  erledigtAm:      null,         // ISO-Timestamp der Erledigung

  // --- Nur Admin-Maßnahmen zusätzlich ---
  einsatzarten:   ["feuer","rettung"],  // für welche Seiten sichtbar
  attachments:    [],
  source:         "admin",             // "basis" | "admin" | "einsatzseite"
  createdAt:      "2024-01-01T..."
}
```

### 4.2 Zeitphasen (BEREICHE)

| id | Anzeige-Label |
|----|--------------|
| `eintreffen` | Beim Eintreffen |
| `5min` | Nach 5 Minuten |
| `10_20_30` | Nach 10 / 20 / 30 Minuten |
| `30_45_60` | Nach 30 / 45 / 60 Minuten |
| `ende` | Nach Einsatzende |

### 4.3 localStorage-Keys

| Key | Inhalt |
|-----|--------|
| `admin_massnahmen_v1` | JSON-Array aller Admin-Maßnahmen |
| `bibliothek_custom_entries_v1` | JSON-Array der Bibliotheks-Einträge |
| `ldc_sp_config` | `{ siteUrl, folderPath }` für SharePoint |

### 4.4 Bekannte Dateninkonsistenz

`infoLinks` ist in **Basis-Maßnahmen** ein String (`"http://a.de, http://b.de"`), in **Admin-Maßnahmen** ein Array (`["http://a.de", "http://b.de"]`). `loadAdminMassnahmen()` normalisiert das beim Laden mit `.join(", ")`.

---

## 5. Alle 38 Basis-Maßnahmen

*(identisch in feuer.html, gefahrgut.html, hilfeleistung.html – rettung/stoerung/tuis/sonstiges haben leere Arrays)*

| ID | Titel | Typ | Bereich |
|----|-------|-----|---------|
| m1 | AP10 einschalten | Pflicht | eintreffen |
| m2 | Lagetool öffnen | Pflicht | eintreffen |
| m3 | Einsatz an Lagetool übergeben | Optional | eintreffen |
| m4 | Lagebild mit DGL abgleichen | Optional | eintreffen |
| m5 | Einsatzart und Alarmstufe prüfen | Optional | eintreffen |
| m6 | Kräfte gemäß AAO überprüfen | Optional | eintreffen |
| m7 | Windrichtung und Umgebungsverhältnisse prüfen | Optional | eintreffen |
| m8 | Warnaktivitäten einschätzen | Optional | eintreffen |
| m9 | Erfordernis einer ZWA-Durchsage prüfen | Optional | eintreffen |
| m10 | Einsatz an externer Leitstelle melden (außerhalb Werk/Rhein) | Optional | eintreffen |
| m11 | Information an BF Leverkusen veranlassen (Bereich Bürrig) | Optional | eintreffen |
| m12 | DGL- und Videokonferenz bei bestätigter AS3 starten | Optional | eintreffen |
| m13 | Alarmierung externer Kräfte überprüfen | Optional | eintreffen |
| m14 | Einsatzort überprüfen | Pflicht | 5min |
| m15 | Alarmstufenbestätigung einholen | Pflicht | 5min |
| m16 | Erste Rückmeldung einholen | Pflicht | 5min |
| m17 | Erfordernis einer D-Meldung prüfen | Optional | 5min |
| m18 | Erfordernis einer Sofortmeldung prüfen | Optional | 5min |
| m19 | Informationsbedarf bei umliegenden BF/FF prüfen | Optional | 5min |
| m20 | Information an KMvD veranlassen | Optional | 5min |
| m21 | Presseinformation über KMvD abstimmen | Optional | 5min |
| m22 | Lagebild mit DGL abgleichen | Intervall | 10_20_30 |
| m23 | Lagebild mit Einsatzleiter abgleichen | Intervall | 10_20_30 |
| m24 | Warnaktivitäten einschätzen | Intervall | 10_20_30 |
| m25 | Angemessenheit der Alarmstufe prüfen | Intervall | 10_20_30 |
| m26 | Informationsbedarf bei umliegenden BF/FF prüfen | Intervall | 10_20_30 |
| m27 | Information an KMvD veranlassen | Intervall | 10_20_30 |
| m28 | Presseinformation über KMvD abstimmen | Intervall | 10_20_30 |
| m29 | DGL-Konferenz durchführen und Aufgaben delegieren | Intervall | 10_20_30 |
| m30 | Betroffene Betriebe feststellen | Intervall | 10_20_30 |
| m31 | Auswirkungen auf Versorgung anderer CPP feststellen | Intervall | 10_20_30 |
| m32 | Betroffenheit von Kanal- und Rückhaltesystemen prüfen | Intervall | 10_20_30 |
| m33 | Erfordernis eines Hausalarms für SiZe oder Werkfeuerwehr prüfen | Optional | 30_45_60 |
| m34 | Erfordernis einer Verpflegung an der Einsatzstelle prüfen | Optional | 30_45_60 |
| m35 | Einrücken aller Kräfte überprüfen | Pflicht | ende |
| m36 | Räumlichkeiten ordnungsgemäß verlassen | Pflicht | ende |
| m37 | Nachbereitung durchführen | Optional | ende |
| m38 | Erweitertes Lagebild ausfüllen & versenden | Pflicht | 10_20_30 |

**m38 Sonderregel:** Startet mit `hidden: true`. Wird erst sichtbar und zur Pflicht, wenn **m27** erledigt wird (hardkodierter Trigger in `handleMassnahmeClick()`).

---

## 6. Schlüsselfunktionen – Maßnahmen-Logik

Alle Funktionen befinden sich inline im `<script>`-Block jeder Checklisten-HTML. Alle 7 Dateien haben **identischen Code**, unterschieden nur durch die Konstante `EINSATZART_LABEL`.

```
window.onload (feuer.html:2349)
  ├── mergeAdminMassnahmen()        Admin-Maßnahmen einmischen (feuer.html:1531)
  │     └── loadAdminMassnahmen()   localStorage → normalisiertes Array (feuer.html:1502)
  ├── renderMassnahmen()            DOM komplett aufbauen (feuer.html:1656)
  └── setInterval(tick, 10000)      Intervall-Timer alle 10s (feuer.html:2417)

handleMassnahmeClick(m)             Klick → erledigt (feuer.html:1586)
  └── Trigger m27 → m38             m38.hidden=false + Modal öffnen (feuer.html:1600)

reaktivierenMassnahme(m)            erledigt → offen zurücksetzen (feuer.html:1618)
tickIntervalMassnahmen()            nextDue abgelaufen → dueState="due" (feuer.html:1841)
getMassClass(m)                     CSS-Klassen berechnen (feuer.html:1571)
openEditModal(m)                    Titel/Typ/Intervall bearbeiten (feuer.html:1635)
addMassnahmeNeu()                   Neue Maßnahme im laufenden Einsatz (feuer.html:1787)
saveMassnahmeToAdminCatalog(m)      In Admin-DB schreiben (feuer.html:1542)
buildStateObject()                  Gesamtzustand serialisieren (feuer.html:2228)
exportStateJSON()                   JSON-Download (feuer.html:2261)
importStateJSON(ev)                 JSON einlesen + Zustand wiederherstellen (feuer.html:2280)
```

### Admin-seitige Funktionen (admin-massnahmen.html)

```
loadData()               SharePoint → localStorage → Array (Zeile:166)
saveData(arr)            localStorage + SharePoint schreiben (Zeile:181)
loadBasisMassnahmen()    feuer/gefahrgut/hilfeleistung.html fetchen + Array extrahieren (Zeile:221)
ensureBasisMassnahmen()  Fehlende Basis-Maßnahmen in Admin-Katalog seeden (Zeile:246)
```

---

## 7. UI-Komponenten – Maßnahmen

### CSS-Klassen der Maßnahmen-Karten

| Zustand | CSS-Klassen | Farbe |
|---------|------------|-------|
| Pflicht offen | `massnahme mass-pflicht` | Rot `#c62828` |
| Optional offen | `massnahme mass-optional` | Grau `#b0bec5` |
| Intervall läuft | `massnahme mass-intervall` | Blau `#1565c0` |
| Intervall fällig | `massnahme mass-intervall mass-pflicht` | Rot |
| Erledigt | `massnahme mass-done` | Grün `#2e7d32` |

**Icons pro Maßnahme-Zeile:** `✏️` Bearbeiten · `↻` Reaktivieren · `ℹ️` Info/Anleitung

### Modal-Dialoge

| ID | Zweck |
|----|-------|
| `#editModal` | Maßnahme bearbeiten (Titel, Typ, Intervall) |
| `#lagebildModal` | Warnung m27→m38: Erweitertes Lagebild erforderlich |
| `#lessonLearnedModal` | Lesson Learned nach Einsatz erfassen |
| `#massnahmeForm` | Neue Maßnahme während laufendem Einsatz hinzufügen |

### Admin-Formular-Felder (admin-massnahmen.html)

| Feld | Typ | Pflicht |
|------|-----|---------|
| Titel | Text | Ja |
| Bereich | Select (5 Optionen) | Ja |
| Typ | Select: optional/pflicht/intervall | Ja |
| Intervall (Minuten) | Number | Nur bei Typ=intervall |
| Info-Text | Textarea | Nein |
| Links | Text (kommagetrennt) | Nein |
| Einsatzarten | 7 Checkboxen | Ja (≥1) |

---

## 8. SharePoint-Service (assets/js/sharepoint-service.js)

Globale Singleton-Instanz `spStorage` der Klasse `SharePointStorage`.  
Authentifizierung: **Session-basiert**, kein Azure AD / OAuth – funktioniert nur im selben SharePoint-Tenant.

```javascript
spStorage.isConfigured()              // → bool
spStorage.testConnection()            // → { ok, title } | { ok: false, error }
spStorage.testFolder()                // Ordner-Existenz prüfen
spStorage.readData('massnahmen')      // → parsed JSON oder null (404 = null)
spStorage.writeData('massnahmen', arr)// JSON via REST POST (braucht FormDigest)
spStorage.exportAllToSharePoint()     // massnahmen + bibliothek → SP
spStorage.importAllFromSharePoint()   // SP → massnahmen + bibliothek
```

**Gespeicherte Dateien in SharePoint:**
- `<folderPath>/massnahmen.json`
- `<folderPath>/bibliothek.json`

---

## 9. Design-System

```css
/* Hauptfarben */
--primary:     #004080   /* Blau – Bibliothek, Admin-Links */
--header-dark: #455a64   /* Dunkelgrau – Checklisten-Header */
--bg:          #f4f5f7   /* Seiten-Hintergrund */
--text:        #222
--muted:       #666
--border:      #d0d4dc
--radius:      8px

/* PWA */
theme_color:      #00C8C8  /* Cyan */
background_color: #1E1E22  /* Dunkelgrau */

/* Maßnahmen-Farben */
Pflicht/fällig:  #c62828   /* Rot */
Optional:        #b0bec5   /* Grau */
Intervall:       #1565c0   /* Blau */
Erledigt:        #2e7d32   /* Grün */
```

**Schrift:** `"Segoe UI", system-ui, sans-serif` · 14px Body · 24px Header  
**Buttons:** `border-radius: 999px` (Kapsel) bei Header-Buttons, `6px` bei Form-Buttons

---

## 10. Bekannte Lücken und Risiken

| # | Thema | Beschreibung | Priorität |
|---|-------|-------------|-----------|
| 1 | **Kein Template-System** | Alle 7 Checklisten sind Copy-Paste – Änderungen müssen 7× gemacht werden | Hoch |
| 2 | **Kein Zustand-Persist** | Maßnahmen-Status geht bei Seitenreload verloren (nur manueller JSON-Export) | Hoch |
| 3 | **4 leere Einsatzarten** | Rettung/Störung/TUIS/Sonstiges haben keine Basis-Maßnahmen | Mittel |
| 4 | **CDN-Abhängigkeit** | `html2pdf.js` von externem CDN, nicht im SW-Cache | Mittel |
| 5 | **`infoLinks`-Inkonsistenz** | String in Basis vs. Array in Admin | Niedrig |
| 6 | **Toter Code** | `engine.js` + `actions.feuer.json` werden nirgends eingebunden | Niedrig |
| 7 | **`uebergabe.html` fehlt** | Geplant, nicht implementiert | Niedrig |
| 8 | **Einmaliger m27→m38-Trigger** | Einzige hardkodierte Abhängigkeit – nicht erweiterbar ohne Code-Änderung | Niedrig |

---

## 11. PWA-Konfiguration (manifest.json)

```json
{
  "name": "Lagedienst Cockpit",
  "short_name": "Lagedienst",
  "start_url": "/LagedienstCockpit/index.html",
  "scope": "/LagedienstCockpit/",
  "display": "standalone",
  "background_color": "#1E1E22",
  "theme_color": "#00C8C8",
  "description": "Offlinefähiges Einsatz- und Lagedienst-Cockpit"
}
```

**Icons:** 16×16, 32×32, 192×192, 512×512 (PNG) + 180×180 Apple Touch Icon

---

## 12. Einsatzarten-Übersicht

| Einsatzart | Datei | Basis-Maßnahmen | Besonderheiten |
|------------|-------|-----------------|----------------|
| Feuer | feuer.html | 38 (m1–m38) | html2pdf, Lesson Learned, KMvD-Trigger |
| Gefahrgut | gefahrgut.html | 38 (identisch) | html2pdf |
| Hilfeleistung | hilfeleistung.html | 38 (identisch) | html2pdf |
| Rettung | rettung.html | 0 (leer) | nur Admin-Maßnahmen |
| Störung | stoerung.html | 0 (leer) | nur Admin-Maßnahmen |
| TUIS | tuis.html | 0 (leer) | nur Admin-Maßnahmen |
| Sonstiges | sonstiges.html | 0 (leer) | nur Admin-Maßnahmen |
