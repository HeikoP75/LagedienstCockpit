# Cockpit OS – Projektbeschreibung für Claude

## Was ist Cockpit OS?

Cockpit OS (früher: Lagedienst Cockpit) ist ein **offlinefähiges PWA-Führungstool** für den Feuerwehr-Lagedienst (Werkfeuerwehr Chempark Leverkusen). Es unterstützt den Lagedienst-Koordinator (LdK) bei der strukturierten Abarbeitung von Einsätzen anhand von Checklisten, Maßnahmen und Dokumentation.

**Tech-Stack:** Vanilla JS + HTML + CSS, kein Framework, kein Build-Tool. Service Worker v2 für Offline-Betrieb.

---

## Repo-Struktur

```
/
├── index.html                   # Startseite / Dashboard
├── einsatz.html                 # Universelle Checklisten-Seite (?art=feuer|gefahrgut|...)
├── feuer.html                   # Legacy – wird nach Test durch einsatz.html ersetzt
├── gefahrgut.html               # Legacy
├── hilfeleistung.html           # Legacy
├── rettung.html                 # Legacy
├── stoerung.html                # Legacy
├── tuis.html                    # Legacy
├── sonstiges.html               # Legacy
├── erweiterte-lagebild.html     # Erweitertes Lagebild (wird durch m-027 getriggert)
├── admin.html                   # Admin-Übersicht
├── admin-massnahmen.html        # Maßnahmen-Katalog verwalten
├── admin-bibliothek.html        # Bibliothek verwalten
├── admin-settings.html          # SharePoint-Konfiguration
├── bibliothek.html              # Lessons Learned / Wissensbank
├── lexikon.html                 # Fachbegriffe
├── manifest.json                # PWA-Manifest (Name: "Cockpit OS")
├── sw.js                        # Service Worker v2
├── CLAUDE.md                    # Diese Datei
├── PROJEKTDOKU.md               # Ausführliche Projektdokumentation
└── assets/
    ├── css/
    │   └── main.css             # Gemeinsames CSS für alle 7 Checklisten
    ├── js/
    │   ├── engine.js            # Gemeinsame JS-Logik (~1.050 Zeilen)
    │   └── sharepoint-service.js # SharePoint REST API Integration
    ├── data/
    │   └── massnahmen.json      # 38 Basis-Maßnahmen (m-001…m-038)
    └── icons/
        ├── icon-16.png
        ├── icon-32.png
        ├── icon-192.png
        ├── icon-512.png
        └── apple-touch-icon-180.png
```

---

## Einsatzarten

| URL-Parameter      | Label        | Gruppe | Maßnahmen-Quelle    |
|--------------------|--------------|--------|---------------------|
| `?art=feuer`       | Feuer        | A      | massnahmen.json     |
| `?art=brand`       | Feuer        | A      | massnahmen.json     |
| `?art=gefahrgut`   | Gefahrgut    | A      | massnahmen.json     |
| `?art=hilfeleistung`| Hilfeleistung| A     | massnahmen.json     |
| `?art=rettung`     | Rettung      | B      | leer (Admin)        |
| `?art=stoerung`    | Störung      | B      | leer (Admin)        |
| `?art=tuis`        | TUIS         | B      | leer (Admin)        |
| `?art=sonstiges`   | Sonstiges    | B      | leer (Admin)        |

---

## Architektur: engine.js

`assets/js/engine.js` enthält die gesamte geteilte Logik. Das einbindende HTML muss **vor** engine.js folgende Globals definieren:

```js
const EINSATZ_ID       = "feuer_aktueller_einsatz"; // page-spezifisch
const EINSATZART_LABEL = "Feuer";                   // page-spezifisch
let massnahmeCounter   = 1;
let massnahmen         = [];
// Optional – triggert async JSON-Loading:
const MASSNAHMEN_JSON_URL = "assets/data/massnahmen.json";
```

### Wichtige Funktionen in engine.js

| Funktion | Beschreibung |
|---|---|
| `renderMassnahmen()` | Rendert alle Maßnahmen nach BEREICHE gruppiert |
| `handleMassnahmeClick(m)` | Setzt Status auf "erledigt", triggert m-027→m-038 |
| `mergeAdminMassnahmen()` | Mergt Admin-Katalog (localStorage) in massnahmen[] |
| `buildPrintHtml()` | Erstellt HTML für PDF-Export |
| `exportStateJSON()` / `importStateJSON()` | Einsatzstand speichern/laden |
| `tickIntervalMassnahmen()` | Prüft alle 10s fällige Intervall-Maßnahmen |

### Sonderlogik: m-027 → m-038

Wenn Maßnahme `m-027` ("Information an KMvD") erledigt wird, wird automatisch Maßnahme `m-038` ("Erweitertes Lagebild ausfüllen & versenden") sichtbar und als Pflicht markiert. Ein Modal erscheint mit Link zu `erweiterte-lagebild.html`.

---

## Maßnahmen-Schema (massnahmen.json)

```json
{
  "id": "m-001",
  "titel": "AP10 einschalten",
  "type": "pflicht",
  "bereich": "eintreffen",
  "intervallMinutes": null,
  "einsatzarten": ["alle"],
  "infoText": "",
  "fwdv_referenz": "",
  "source": "basis",
  "hidden": false
}
```

### Bereich-IDs

| ID           | Label                       |
|--------------|-----------------------------|
| `sofort`     | Sofort                      |
| `eintreffen` | Beim Eintreffen             |
| `t+5`        | Nach 5 Minuten              |
| `t+10`       | Nach 10 / 20 / 30 Minuten  |
| `t+30`       | Nach 30 / 45 / 60 Minuten  |
| `t+60`       | Nach 60+ Minuten            |
| `ende`       | Nach Einsatzende            |

---

## localStorage-Keys

| Key | Inhalt |
|---|---|
| `admin_massnahmen_v1` | Admin-verwalteter Maßnahmen-Katalog (JSON-Array) |
| `bibliothek_lessons_learned` | Lessons Learned (JSON-Array) |
| `bibliothek_custom_entries_v1` | Bibliotheks-Einträge |
| `ldc_sp_config` | SharePoint-Konfiguration |
| `ll_<EINSATZ_ID>` | Flag: Lesson Learned für diesen Einsatz gespeichert |
| `uebergabe_<EINSATZ_ID>` | Flag: Übergabe für diesen Einsatz markiert |

---

## Offene Aufgaben / Nächste Schritte

- [ ] `Biene.svg` ins Repo einchecken → Icons aller PWA-Größen neu generieren
- [ ] Legacy-HTML-Dateien (feuer.html etc.) nach erfolgreichem Test von einsatz.html entfernen
- [ ] `einsatz.html` als `start_url` im manifest.json verlinken (nach Migration)
- [ ] Service Worker Cache-Version erhöhen wenn Assets geändert wurden
- [ ] `massnahmen.json` um einsatzarten-spezifische Filterung erweitern (Gruppe A ≠ Gruppe B)
- [ ] `sofort` und `t+60` Bereich mit Maßnahmen befüllen

---

## Git-Konventionen

- Branch-Prefix für Claude-Sessions: `claude/<beschreibung>-<session-id>`
- Commit-Messages auf Deutsch, mit Session-URL am Ende
- Keine Build-Tools, keine package.json – direkt deploybar via GitHub Pages

## Bekannte Besonderheiten

- `massnahmen[]` wird **nur im RAM gehalten** – kein automatisches Persist beim Reload
- Admin-Maßnahmen aus localStorage überschreiben Basis-Maßnahmen bei gleicher ID (Admin ist Source of Truth)
- `intervallMinutes: null` bei type="intervall" bedeutet: kein Auto-Reset-Timer, manuelle Reaktivierung
- Die alten HTML-Dateien (feuer.html etc.) haben noch eigene BEREICHE mit alten IDs als Fallback
