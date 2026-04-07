# Refactoring-Analyse: Die 7 Checklisten-HTMLs
# Grundlage für HEIKO-OS
# Stand: April 2026

---

## Frage 1: Sind die Script-Blöcke identisch bis auf EINSATZART_LABEL?

NEIN – aber fast. Es gibt zwei Gruppen:

  Gruppe A – "Vollständig" (38 hardkodierte Maßnahmen)
  → feuer.html, gefahrgut.html, hilfeleistung.html
  → ~98% identisch untereinander

  Gruppe B – "Leer" (nur Admin-Maßnahmen)
  → rettung.html, stoerung.html, tuis.html, sonstiges.html
  → ~99,7% identisch untereinander

---

## Frage 2: Welche Teile sind datei-spezifisch, welche generisch?

Exakt 8 Stellen unterscheiden sich – der Rest ist copy-paste identisch:

  Nr  Stelle                                        Art
  -------------------------------------------------------------------
  1   const EINSATZ_ID                              JS-Konstante
  2   const EINSATZART_LABEL                        JS-Konstante
  3   <title>                                       HTML
  4   "Einsatzbearbeitung – [X]" im Header          HTML
  5   ?einsatzart=feuer im Lagebild-Link            HTML
  6   <h1>Einsatzdokumentation – [X]</h1> im PDF   JS-String (1 Zeile)
  7   massnahmen-Array (38 Einträge vs. leer)       JS ~520 Zeilen
  8   Maßnahmen-Formular vs. Admin-Hinweis          HTML ~30 Zeilen

Alle anderen Konstanten (LESSONS_STORAGE_KEY, ADMIN_MASSNAHMEN_STORAGE_KEY),
alle Funktionen, das gesamte CSS und der HTML-Aufbau sind identisch in allen 7.

---

## Frage 3: Wie groß ist der identische Code-Block?

  Block                              Zeilen
  -----------------------------------------------
  CSS (Gruppe A)                     ~600
  HTML-Struktur (als Template)       ~400
  JS-Logik (generisch)               ~1.040
  JS-Maßnahmen-Array (nur Gruppe A)  ~520
  -----------------------------------------------
  Gesamt extrahierbar                ~2.040 Zeilen

---

## Zeilenzahlen der Dateien

  Datei               Zeilen  Gruppe
  ------------------------------------
  feuer.html          2459    A
  gefahrgut.html      2477    A
  hilfeleistung.html  2477    A
  rettung.html        1917    B
  stoerung.html       1917    B
  tuis.html           1917    B
  sonstiges.html      1917    B

  feuer.html Script-Block:     ~1595 Zeilen
  gefahrgut.html Script-Block: ~1613 Zeilen
  rettung.html Script-Block:   ~1067 Zeilen

Warum gefahrgut/hilfeleistung 18 Zeilen mehr als feuer.html haben: Sie haben
verwaiste Überreste aus einer früheren "Seite in Arbeit"-Version (s. Bugs).

---

## Unterschied zwischen Gruppe A und Gruppe B

Gruppe B hat gegenüber Gruppe A entfernt:
  1. Das massnahmen-Array (m1–m38) – ~520 Zeilen
  2. Das Maßnahmen-Hinzufügen-Formular im HTML – ~30 Zeilen
  3. Den saveMassnahmeToAdminCatalog()-Aufruf in addMassnahmeNeu() – 2 Zeilen

Alles andere (1.040 Zeilen JS-Logik, CSS, HTML-Struktur) ist identisch.

---

## Generischer Code – was extrahiert werden kann

Folgende ~1.040 Zeilen JS-Logik sind in ALLEN 7 Dateien identisch:

  Funktion/Block                  Zeilen (ca.)
  -----------------------------------------------
  loadAdminMassnahmen()           27
  mergeAdminMassnahmen()          9
  saveMassnahmeToAdminCatalog()   24
  getMassClass()                  10
  handleMassnahmeClick()          30
  reaktivierenMassnahme()         12
  openEditModal()                 15
  renderMassnahmen()              121
  toggleMassnahmeForm()           4
  addMassnahmeNeu()               49
  tickIntervalMassnahmen()        21
  Kommentar-System                60
  Meldungs-System                 120
  Hausalarm-System                60
  Externe Kräfte                  50
  Lesson Learned                  80
  JSON Export/Import              90
  PDF-Generierung                 90 (außer 1 Zeile Titel)
  window.onload Init              73
  -----------------------------------------------
  GESAMT                          ~1.040 Zeilen

---

## Bekannte Bugs / Altlasten (werden beim Refactoring bereinigt)

  Datei               Problem
  -----------------------------------------------------------------------
  feuer.html          Fehlendes Viewport-Meta-Tag
  gefahrgut.html      Doppeltes <title>-Tag ("Seite in Arbeit" Überrest)
                      + 14 Zeilen verwaistes Platzhalter-CSS
  hilfeleistung.html  Dasselbe wie gefahrgut.html (daher +18 Zeilen)
  rettung.html        Doppeltes <title>-Tag
  stoerung.html       Doppeltes <title>-Tag
  tuis.html           Doppeltes <title>-Tag
  sonstiges.html      Doppeltes <title>-Tag

---

## Alle datei-spezifischen Konstantenwerte (vollständige Tabelle)

  Datei               EINSATZ_ID                    EINSATZART_LABEL
  -----------------------------------------------------------------------
  feuer.html          feuer_aktueller_einsatz        Feuer
  gefahrgut.html      gefahrgut_aktueller_einsatz    Gefahrgut
  hilfeleistung.html  hilfeleistung_aktueller_einsatz  Hilfeleistung
  rettung.html        rettung_aktueller_einsatz      Rettung
  stoerung.html       stoerung_aktueller_einsatz     Störung
  tuis.html           tuis_aktueller_einsatz         TUIS
  sonstiges.html      sonstiges_aktueller_einsatz    Sonstiges

  Identisch in allen 7:
  LESSONS_STORAGE_KEY          = "bibliothek_lessons_learned"
  ADMIN_MASSNAHMEN_STORAGE_KEY = "admin_massnahmen_v1"

---

## Refactoring-Optionen für HEIKO-OS

Option A – URL-Parameter (einfachste Lösung)
  Eine einzelne checklist.html?einsatzart=feuer
  Die Seite liest den Parameter und setzt die 2 Konstanten dynamisch
  Maßnahmen-Array wird aus einer separaten JS-Datei geladen:
    data/massnahmen.feuer.js
    data/massnahmen.gefahrgut.js
    etc.

Option B – Dünne Wrapper-HTMLs (minimaler Umbau)
  7 schmale HTMLs à ~50 Zeilen (nur die 8 datei-spezifischen Stellen)
  Ein gemeinsames checklist-engine.js (~1.040 Zeilen)
  Ein gemeinsames checklist.css

Option C – Web Components
  <checklist-page einsatzart="feuer"> als Custom Element
  Sauberste Architektur, höchster Aufwand

Empfehlung: Option B ist der sicherste Einstieg – minimales Risiko,
gut testbar, und die bestehende Logik bleibt unverändert.

---

## Zusammenfassung

  ~2.040 Zeilen Code können als gemeinsame Basis extrahiert werden.
  Pro Datei bleiben nach dem Refactoring nur ~50 datei-spezifische Zeilen.
  Die 7 Altlasten-Bugs werden beim Refactoring automatisch bereinigt.
  Keine inhaltlichen Änderungen an der App-Logik nötig – reines Strukturproblem.
