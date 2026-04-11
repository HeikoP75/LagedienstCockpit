// engine.js – Cockpit OS / HEIKO-OS
// Gemeinsame JS-Logik aller 7 Checklisten-Seiten.
// Voraussetzung: EINSATZ_ID, EINSATZART_LABEL und massnahmen-Array
// müssen vom einbindenden HTML vor diesem Script definiert werden.

const LESSONS_STORAGE_KEY = "bibliothek_lessons_learned";
const ADMIN_MASSNAHMEN_STORAGE_KEY = "admin_massnahmen_v1";

/* ----------------------------------------------------
   Hilfsfunktionen
---------------------------------------------------- */
function isFuture(dtString) {
    if (!dtString) return false;
    return new Date(dtString).getTime() > Date.now();
}

function formatDate(dtString) {
    if (!dtString) return "";
    const d = new Date(dtString);
    const t = n => String(n).padStart(2,"0");
    return t(d.getDate())+"."+t(d.getMonth()+1)+"."+d.getFullYear()+" "+t(d.getHours())+":"+t(d.getMinutes())+" Uhr";
}

function buildPdfFilename() {
    const nr = document.getElementById("einsatznummer").value.trim() || "Unbekannt";
    const d  = new Date();
    const t  = n => String(n).padStart(2,"0");
    return d.getFullYear()+"-"+t(d.getMonth()+1)+"-"+t(d.getDate())+"_"+nr+".pdf";
}

function openLessonLearnedModal() {
    document.getElementById("lessonLearnedModal").style.display = "block";
}

function closeLessonLearnedModal() {
    document.getElementById("lessonLearnedModal").style.display = "none";
}

function saveLessonLearned() {
    const title = document.getElementById("ll_title").value.trim();
    const description = document.getElementById("ll_description").value.trim();
    const tags = document.getElementById("ll_tags").value.split(",").map(x => x.trim()).filter(Boolean);

    if (!title || !description) {
        alert("Bitte Titel und Beschreibung fuer das Lesson Learned eintragen.");
        return;
    }

    let lessons = [];
    try {
        const raw = localStorage.getItem(LESSONS_STORAGE_KEY);
        lessons = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(lessons)) lessons = [];
    } catch (_) {
        lessons = [];
    }

    const einsatznummer = document.getElementById("einsatznummer").value.trim() || "ohne Einsatznummer";
    const einsatzstichwort = document.getElementById("einsatzstichwort").value.trim();

    lessons.unshift({
        id: "ll_"+Date.now(),
        title,
        description,
        tags,
        source: EINSATZART_LABEL+(einsatzstichwort ? " – "+einsatzstichwort : "")+" ("+einsatznummer+")",
        createdAt: new Date().toISOString()
    });

    localStorage.setItem(LESSONS_STORAGE_KEY, JSON.stringify(lessons));
    localStorage.setItem("ll_"+EINSATZ_ID, "true");

    document.getElementById("ll_title").value = "";
    document.getElementById("ll_description").value = "";
    document.getElementById("ll_tags").value = "";

    const llLink = document.getElementById("flagLL");
    if (llLink) llLink.classList.add("einsatz-aktiv");

    closeLessonLearnedModal();
    alert("Lesson Learned wurde in der Bibliothek gespeichert.");
}

function initLessonLearnedActions() {
    const openBtn = document.getElementById("openLessonLearned");
    const saveBtn = document.getElementById("ll_save");
    const cancelBtn = document.getElementById("ll_cancel");

    if (openBtn) openBtn.addEventListener("click", openLessonLearnedModal);
    if (saveBtn) saveBtn.addEventListener("click", saveLessonLearned);
    if (cancelBtn) cancelBtn.addEventListener("click", closeLessonLearnedModal);
}

/* ----------------------------------------------------
   Bereiche fuer Masnahmen
---------------------------------------------------- */
const BEREICHE = [
    { id: "sofort",     label: "Sofort" },
    { id: "eintreffen", label: "Beim Eintreffen" },
    { id: "t+5",        label: "Nach 5 Minuten" },
    { id: "t+10",       label: "Nach 10 / 20 / 30 Minuten" },
    { id: "t+30",       label: "Nach 30 / 45 / 60 Minuten" },
    { id: "t+60",       label: "Nach 60+ Minuten" },
    { id: "ende",       label: "Nach Einsatzende" }
];

function getBereichLabel(id) {
    const b = BEREICHE.find(x => x.id === id);
    return b ? b.label : "";
}

/* ----------------------------------------------------
   Admin-Massnahmen-Logik
---------------------------------------------------- */
function getAktiveEinsatzart() {
    return (EINSATZ_ID || "").split("_")[0];
}

function loadAdminMassnahmen() {
    try {
        const raw = localStorage.getItem(ADMIN_MASSNAHMEN_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(item => Array.isArray(item.einsatzarten) && item.einsatzarten.includes(getAktiveEinsatzart()))
            .map(item => ({
                id: item.id || "admin_"+Date.now(),
                titel: item.titel || "Admin-Massnahme",
                bereich: item.bereich || "eintreffen",
                type: item.type || "optional",
                intervallMinutes: item.type === "intervall" ? Number(item.intervallMinutes || 0) || null : null,
                status: "offen",
                nextDue: item.type === "intervall" && Number(item.intervallMinutes) > 0 ? Date.now() + Number(item.intervallMinutes) * 60000 : null,
                dueState: "neutral",
                infoText: item.infoText || "",
                infoLinks: Array.isArray(item.infoLinks) ? item.infoLinks.join(", ") : (item.infoLinks || ""),
                infoOpen: false,
                attachments: Array.isArray(item.attachments) ? item.attachments : [],
                source: "admin"
            }));
    } catch (error) {
        console.warn("Admin-Massnahmen konnten nicht geladen werden", error);
        return [];
    }
}

function mergeAdminMassnahmen() {
    const adminMassnahmen = loadAdminMassnahmen();
    if (!adminMassnahmen.length) return;

    // Admin ist Source of Truth: ueberschreibt hardkodierte Massnahmen per ID
    const adminById = new Map(adminMassnahmen.map(m => [m.id, m]));
    massnahmen = massnahmen.map(m => adminById.has(m.id) ? adminById.get(m.id) : m);
    const hardIds = new Set(massnahmen.map(m => m.id));
    massnahmen = massnahmen.concat(adminMassnahmen.filter(m => !hardIds.has(m.id)));
}

function saveMassnahmeToAdminCatalog(m) {
    try {
        const raw = localStorage.getItem(ADMIN_MASSNAHMEN_STORAGE_KEY);
        const catalog = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(catalog) ? catalog : [];

        list.unshift({
            id: "admin_massnahme_"+Date.now()+"_"+Math.random().toString(16).slice(2, 8),
            titel: m.titel,
            bereich: m.bereich,
            type: m.type,
            intervallMinutes: m.intervallMinutes || null,
            infoText: m.infoText || "",
            infoLinks: m.infoLinks ? m.infoLinks.split(",").map(x => x.trim()).filter(Boolean) : [],
            attachments: [],
            einsatzarten: [getAktiveEinsatzart()],
            source: "einsatzseite",
            createdAt: new Date().toISOString()
        });

        localStorage.setItem(ADMIN_MASSNAHMEN_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
        console.warn("Massnahme konnte nicht in den Adminkatalog gespeichert werden", error);
    }
}

/* ----------------------------------------------------
   CSS-Klassen für Maßnahmen
---------------------------------------------------- */
function getMassClass(m) {
    let cls = "massnahme ";
    if (m.type === "pflicht") cls += "mass-pflicht ";
    else if (m.type === "optional") cls += "mass-optional ";
    else if (m.type === "intervall") {
        cls += "mass-intervall ";
        if (m.dueState === "due") cls += "mass-pflicht ";
    }
    if (m.status === "erledigt") cls += "mass-done ";
    return cls.trim();
}

/* ----------------------------------------------------
   Maßnahmenlogik
---------------------------------------------------- */
function handleMassnahmeClick(m) {
    if (m.status === "erledigt") return;

    const nowIso = new Date().toISOString();

    if (m.type === "intervall" && m.intervallMinutes) {
        m.status   = "erledigt";
        m.dueState = "neutral";
        m.nextDue  = Date.now() + m.intervallMinutes * 60000;
    } else {
        m.status = "erledigt";
    }

    // KMvD-Abhängigkeit: m27/m-027 -> m38/m-038 aktivieren
    if (m.id === "m27" || m.id === "m-027") {
        const lage = massnahmen.find(x => x.id === "m38" || x.id === "m-038");
        if (lage) {
            lage.hidden = false;
            lage.type = "pflicht";
            lage.status = "offen";
            lage.nextDue = null;
            lage.dueState = "neutral";
            document.getElementById("lagebildModal").style.display = "flex";
        }
    }
    m.erledigtAm = nowIso;

    renderMassnahmen();
}

function reaktivierenMassnahme(m, ev) {
    ev.stopPropagation();
    m.status = "offen";
    m.erledigtAm = null;
    m.dueState = "neutral";

    if (m.type === "intervall" && m.intervallMinutes) {
        m.nextDue = Date.now() + m.intervallMinutes * 60000;
    } else {
        m.nextDue = null;
    }
    renderMassnahmen();
}

/* --- Bearbeiten-Dialog (Modal) --- */
let editCurrent = null;

function openEditModal(m, ev) {
    ev.stopPropagation();
    editCurrent = m;
    document.getElementById("edit_title").value = m.titel;
    document.getElementById("edit_type").value  = m.type;
    document.getElementById("edit_intervall").value = m.intervallMinutes || "";
    document.getElementById("editModal").style.display = "block";
}

/* ----------------------------------------------------
   Info-Box Umschalten
---------------------------------------------------- */
function toggleInfo(m, ev) {
    ev.stopPropagation();
    m.infoOpen = !m.infoOpen;
    renderMassnahmen();
}

/* ----------------------------------------------------
   Rendering der Maßnahmen
---------------------------------------------------- */
function renderMassnahmen() {
    const container = document.getElementById("massnahmenContainer");
    container.innerHTML = "";

    const sichtbar = massnahmen.filter(m => !m.hidden);
    if (sichtbar.length === 0) {
        container.innerHTML =
            '<p style="color:#888;font-size:14px;padding:12px 0;">' +
            'Keine Maßnahmen konfiguriert. Bitte zuerst den ' +
            '<a href="admin-massnahmen.html">Admin-Bereich</a> öffnen.' +
            '</p>';
        return;
    }

    BEREICHE.forEach(b => {
        const blockDiv = document.createElement("div");
        const blockTitle = document.createElement("h3");
        blockTitle.textContent = getBereichLabel(b.id);
        blockDiv.appendChild(blockTitle);

        const items = massnahmen.filter(m => m.bereich === b.id && !m.hidden);
        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "Keine Maßnahmen.";
            empty.style.fontSize = "13px";
            empty.style.opacity = "0.7";
            blockDiv.appendChild(empty);
        } else {
            items.forEach(m => {
                const outer = document.createElement("div");

                const row = document.createElement("div");
                row.className = getMassClass(m);
                row.onclick = () => handleMassnahmeClick(m);

                const left = document.createElement("div");
                left.className = "mass-left";
                left.textContent = m.titel;

                const right = document.createElement("div");
                right.className = "mass-icons";

                const editIcon = document.createElement("span");
                editIcon.textContent = "✏️";
                editIcon.title = "Bearbeiten";
                editIcon.onclick = (ev) => openEditModal(m, ev);

                const reactIcon = document.createElement("span");
                reactIcon.textContent = "↻";
                reactIcon.title = "Reaktivieren";
                reactIcon.onclick = (ev) => reaktivierenMassnahme(m, ev);

                const infoIcon = document.createElement("span");
                infoIcon.textContent = "ℹ️";
                infoIcon.title = "Info anzeigen";
                infoIcon.onclick = (ev) => toggleInfo(m, ev);

                right.appendChild(editIcon);
                right.appendChild(reactIcon);
                right.appendChild(infoIcon);

                row.appendChild(left);
                row.appendChild(right);
                outer.appendChild(row);

                if (m.infoOpen) {
                    const info = document.createElement("div");
                    info.className = "infoBox";

                    const h = document.createElement("h4");
                    h.textContent = "Anleitung: " + m.titel;
                    info.appendChild(h);

                    const p = document.createElement("p");
                    p.textContent =
                        m.infoText && m.infoText.trim() !== ""
                            ? m.infoText
                            : "Platzhalter: Hier kannst du später Text, Bilder oder PDFs zur Durchführung der Maßnahme hinterlegen.";
                    info.appendChild(p);

                    if (m.infoLinks) {
                        const links = m.infoLinks.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
                        links.forEach(l => {
                            const div = document.createElement("div");
                            const a   = document.createElement("a");
                            a.href = l;
                            a.target = "_blank";
                            a.textContent = l;
                            div.textContent = "📎 ";
                            div.appendChild(a);
                            info.appendChild(div);
                        });
                    }

                    const btnDone = document.createElement("button");
                    btnDone.className = "primary-btn";
                    btnDone.textContent = "Maßnahme erledigen";
                    btnDone.onclick = (ev) => {
                        ev.stopPropagation();
                        handleMassnahmeClick(m);
                        m.infoOpen = false;
                        renderMassnahmen();
                    };
                    info.appendChild(btnDone);

                    const btnClose = document.createElement("button");
                    btnClose.className = "secondary-btn";
                    btnClose.style.marginLeft = "8px";
                    btnClose.textContent = "Info schließen";
                    btnClose.onclick = (ev) => {
                        ev.stopPropagation();
                        m.infoOpen = false;
                        renderMassnahmen();
                    };
                    info.appendChild(btnClose);

                    outer.appendChild(info);
                }

                blockDiv.appendChild(outer);
            });
        }

        container.appendChild(blockDiv);
        const divLine = document.createElement("div");
        divLine.className = "block-divider";
        container.appendChild(divLine);
    });

    renderKommentarAuswahl();
}

/* ----------------------------------------------------
   Maßnahmen hinzufügen
---------------------------------------------------- */
function toggleMassnahmeForm() {
    const f = document.getElementById("massnahmeForm");
    f.style.display = (f.style.display === "none" || !f.style.display) ? "block" : "none";
}

function addMassnahmeNeu() {
    const titel   = document.getElementById("neu_massnahme_titel").value.trim();
    const bereich = document.getElementById("neu_massnahme_bereich").value;
    const typEl   = document.querySelector("input[name='neu_massnahme_typ']:checked");
    const interv  = document.getElementById("neu_massnahme_intervall").value.trim();

    if (!titel)   return alert("Bitte einen Titel eingeben.");
    if (!bereich) return alert("Bitte einen Bereich wählen.");
    if (!typEl)   return alert("Bitte einen Typ auswählen.");

    const typ = typEl.value;
    let intervallMinutes = null;

    if (typ === "intervall") {
        if (!interv) return alert("Bitte Intervall in Minuten angeben.");
        const v = parseInt(interv, 10);
        if (isNaN(v) || v <= 0) return alert("Ungültiges Intervall.");
        intervallMinutes = v;
    }

    const m = {
        id: "m" + (massnahmeCounter++),
        titel,
        bereich,
        type: typ,
        intervallMinutes,
        status: "offen",
        nextDue: (typ === "intervall" && intervallMinutes) ? Date.now() + intervallMinutes * 60000 : null,
        dueState: "neutral",
        infoText: "",
        infoLinks: "",
        infoOpen: false
    };

    massnahmen.push(m);

    const storeInAdmin = document.getElementById("neu_massnahme_in_db");
    if (storeInAdmin && storeInAdmin.checked) {
        saveMassnahmeToAdminCatalog(m);
    }

    document.getElementById("neu_massnahme_titel").value = "";
    document.getElementById("neu_massnahme_bereich").value = "";
    document.getElementById("neu_massnahme_intervall").value = "";
    document.querySelectorAll("input[name='neu_massnahme_typ']").forEach(r => r.checked = false);
    const storeInAdminReset = document.getElementById("neu_massnahme_in_db");
    if (storeInAdminReset) storeInAdminReset.checked = false;

    renderMassnahmen();
}

/* ----------------------------------------------------
   Intervall-Timer
---------------------------------------------------- */
function tickIntervalMassnahmen() {
    const now = Date.now();
    let changed = false;

    massnahmen.forEach(m => {
        if (m.type === "intervall" && m.intervallMinutes) {
            if (m.status === "offen" && m.nextDue && now >= m.nextDue) {
                m.dueState = "due";
                m.nextDue  = null;
                changed = true;
            }
            if (m.status === "erledigt" && m.nextDue && now >= m.nextDue) {
                m.status   = "offen";
                m.dueState = "due";
                m.nextDue  = null;
                changed = true;
            }
        }
    });

    if (changed) renderMassnahmen();
}

/* ----------------------------------------------------
   Kommentare
---------------------------------------------------- */
let kommentare = [];

function getMassnahmeTitel(id) {
    const m = massnahmen.find(x => x.id === id);
    return m ? m.titel : "(gelöscht)";
}

function renderKommentarAuswahl() {
    const sel = document.getElementById("kommentar_massnahme");
    if (!sel) return;

    const old = sel.value;
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Bitte Maßnahme wählen …";
    sel.appendChild(opt0);

    BEREICHE.forEach(b => {
        massnahmen.filter(m => m.bereich === b.id).forEach(m => {
            const o = document.createElement("option");
            o.value = m.id;
            o.textContent = getBereichLabel(m.bereich) + " – " + m.titel;
            sel.appendChild(o);
        });
    });

    sel.value = old;
}

function renderKommentare() {
    const ul = document.getElementById("kommentarListe");
    ul.innerHTML = "";
    if (kommentare.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Noch keine Kommentare.";
        ul.appendChild(li);
        return;
    }
    kommentare.forEach(k => {
        const li = document.createElement("li");
        li.textContent = getMassnahmeTitel(k.massnahmeId) + ": " + k.text;
        ul.appendChild(li);
    });
}

function addKommentar() {
    const mid  = document.getElementById("kommentar_massnahme").value;
    const text = document.getElementById("kommentar_text").value.trim();

    if (!mid)  return alert("Bitte eine Maßnahme auswählen.");
    if (!text) return alert("Bitte Kommentar eingeben.");

    kommentare.push({ massnahmeId: mid, text });
    document.getElementById("kommentar_text").value = "";
    renderKommentare();
}

/* ----------------------------------------------------
   Behördenmeldungen
---------------------------------------------------- */
let meldungen = [];

function toggleMeldungFields() {
    const art  = document.getElementById("meldung_art").value;
    const zeit = document.getElementById("meldung_zeit");
    const feldNormal = document.getElementById("field_bemerkung_normal");
    const feldKeine  = document.getElementById("field_bemerkung_keine");

    if (art === "keine") {
        zeit.disabled = true;
        zeit.value = "";
        feldNormal.style.display = "none";
        feldKeine.style.display  = "block";
    } else {
        zeit.disabled = false;
        feldNormal.style.display = "block";
        feldKeine.style.display  = "none";
    }
}

function addMeldung() {
    const art      = document.getElementById("meldung_art").value;
    const zeit     = document.getElementById("meldung_zeit").value;
    const bemText  = document.getElementById("meldung_bemerkung").value.trim();
    const grundSel = document.getElementById("meldung_begruendung").value;
    const grundTxt = document.getElementById("meldung_begruendung_text_input").value.trim();

    if (art === "keine") {
        if (!grundSel) return alert("Bitte einen Grund auswählen.");
        let bem;
        if (grundSel === "Sonstiges") {
            if (!grundTxt) return alert("Bitte Grund ausführen.");
            bem = "Sonstiges: " + grundTxt;
        } else {
            bem = grundSel;
        }
        meldungen.push({ art, zeit:"", bemerkung:bem });
        renderMeldungen();
        return;
    }

    if (!zeit) return alert("Bitte einen Zeitpunkt eintragen.");
    if (isFuture(zeit)) return alert("Zeit darf nicht in der Zukunft liegen.");

    meldungen.push({ art, zeit, bemerkung: bemText });
    renderMeldungen();
}

function renderMeldungen() {
    const tbody = document.querySelector("#meldungenListe tbody");
    tbody.innerHTML = "";
    meldungen.forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + m.art + "</td>" +
            "<td>" + (m.zeit ? formatDate(m.zeit) : "—") + "</td>" +
            "<td>" + m.bemerkung + "</td>" +
            "<td><button class=\"secondary-btn\" onclick=\"deleteMeldung(" + idx + ")\">X</button></td>";
        tbody.appendChild(tr);
    });
}

function deleteMeldung(i) {
    meldungen.splice(i,1);
    renderMeldungen();
}

/* ----------------------------------------------------
   Alarmierung REL / Krisenstab
---------------------------------------------------- */
function toggleRel(v) {
    const f = document.getElementById("rel_zeit");
    f.disabled = (v === "Nein");
    if (v === "Nein") f.value = "";
}

function toggleKst(v) {
    const f = document.getElementById("kst_zeit");
    f.disabled = (v === "Nein");
    if (v === "Nein") f.value = "";
}

/* ----------------------------------------------------
   Hausalarm
---------------------------------------------------- */
let hausalarme = [];

function addHausalarm() {
    const gruppe = document.getElementById("hausalarm_gruppe").value.trim();
    const zeit   = document.getElementById("hausalarm_zeit").value;
    const bem    = document.getElementById("hausalarm_bemerkung").value.trim();

    if (!gruppe) return alert("Bitte eine Gruppe angeben.");
    if (!zeit)   return alert("Bitte einen Zeitpunkt angeben.");
    if (isFuture(zeit)) return alert("Zeit darf nicht in der Zukunft liegen.");

    hausalarme.push({ gruppe, zeit, bemerkung: bem });
    renderHausalarme();
}

function renderHausalarme() {
    const tbody = document.querySelector("#hausalarmListe tbody");
    tbody.innerHTML = "";
    hausalarme.forEach((h, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + h.gruppe + "</td>" +
            "<td>" + formatDate(h.zeit) + "</td>" +
            "<td>" + h.bemerkung + "</td>" +
            "<td><button class=\"secondary-btn\" onclick=\"deleteHausalarm(" + idx + ")\">X</button></td>";
        tbody.appendChild(tr);
    });
}

function deleteHausalarm(i) {
    hausalarme.splice(i,1);
    renderHausalarme();
}

/* ----------------------------------------------------
   Externe Kräfte
---------------------------------------------------- */
let externeKraefte = [];

function addExtern() {
    const org  = document.getElementById("ext_org").value.trim();
    const zeit = document.getElementById("ext_zeit").value;
    const bem  = document.getElementById("ext_bemerkung").value.trim();

    if (!org)  return alert("Bitte eine Organisation angeben.");
    if (!zeit) return alert("Bitte einen Zeitpunkt angeben.");
    if (isFuture(zeit)) return alert("Zeit darf nicht in der Zukunft liegen.");

    externeKraefte.push({ org, zeit, bemerkung: bem });
    renderExterne();
}

function renderExterne() {
    const tbody = document.querySelector("#extListe tbody");
    tbody.innerHTML = "";
    externeKraefte.forEach((e, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + e.org + "</td>" +
            "<td>" + formatDate(e.zeit) + "</td>" +
            "<td>" + e.bemerkung + "</td>" +
            "<td><button class=\"secondary-btn\" onclick=\"deleteExtern(" + idx + ")\">X</button></td>";
        tbody.appendChild(tr);
    });
}

function deleteExtern(i) {
    externeKraefte.splice(i,1);
    renderExterne();
}

/* ----------------------------------------------------
   PDF-Erzeugung (HTML)
   EINSATZART_LABEL muss vom einbindenden Script gesetzt sein.
---------------------------------------------------- */
function buildPrintHtml() {
    const val = id => (document.getElementById(id)?.value || "").trim();
    const selText = id => {
        const el = document.getElementById(id);
        if (!el) return "";
        const opt = el.options[el.selectedIndex];
        return opt ? opt.text : "";
    };

    const rel = document.querySelector("input[name='rel_choice']:checked")?.value || "Nein";
    const kst = document.querySelector("input[name='kst_choice']:checked")?.value || "Nein";

    let html = "";

    html += "<h1>Einsatzdokumentation \u2013 " + EINSATZART_LABEL.toUpperCase() + "</h1>\n    <h2>Einsatzdaten</h2>\n    <table><tbody>";
    [
        ["Einsatznummer", val("einsatznummer")],
        ["Standort",      selText("standort")],
        ["Einsatzstichwort", val("einsatzstichwort")],
        ["Einsatzleiter", val("einsatzleiter")],
        ["Beginn",        formatDate(val("einsatzbeginn"))],
        ["CP-Partner",    val("cppartner")],
        ["Alarmstufe",    selText("asstufe")],
        ["Windrichtung",  selText("windrichtung")],
        ["Windgeschwindigkeit", val("windgeschwindigkeit") + " m/s"]
    ].forEach(r => {
        html += "<tr><th>" + r[0] + "</th><td style=\"text-align:right;\">" + r[1] + "</td></tr>";
    });
    html += "</tbody></table>";

    html += "<h2>Erledigte Ma\u00dfnahmen</h2>\n    <table><thead><tr><th>Bereich</th><th>Ma\u00dfnahme</th><th>Abschluss</th></tr></thead><tbody>";
    massnahmen
        .filter(m => m.status === "erledigt" && m.erledigtAm)
        .forEach(m => {
            html += "<tr><td>" + getBereichLabel(m.bereich) + "</td><td>" + m.titel + "</td><td style=\"text-align:right;\">" + formatDate(m.erledigtAm) + "</td></tr>";
        });
    html += "</tbody></table>";

    if (kommentare.length > 0) {
        html += "<h2>Kommentare</h2><table><tbody>";
        kommentare.forEach(k => {
            html += "<tr><th>" + getMassnahmeTitel(k.massnahmeId) + "</th><td>" + k.text + "</td></tr>";
        });
        html += "</tbody></table>";
    }

    html += "<h2>Beh\u00f6rdenmeldungen</h2>\n    <table><thead><tr><th>Art</th><th>Zeitpunkt</th><th>Bemerkung</th></tr></thead><tbody>";
    meldungen.forEach(m => {
        html += "<tr><td>" + m.art + "</td><td>" + (m.zeit ? formatDate(m.zeit) : "—") + "</td><td>" + m.bemerkung + "</td></tr>";
    });
    html += "</tbody></table>";

    html += "<h2>Alarmierung weiterer Kr\u00e4fte</h2>\n    <table><tbody>\n        <tr><th>REL einberufen?</th><td style=\"text-align:right;\">" + rel + "</td></tr>\n        <tr><th>REL Zeitpunkt</th><td style=\"text-align:right;\">" + formatDate(val("rel_zeit")) + "</td></tr>\n        <tr><th>Krisenstab einberufen?</th><td style=\"text-align:right;\">" + kst + "</td></tr>\n        <tr><th>Krisenstab Zeitpunkt</th><td style=\"text-align:right;\">" + formatDate(val("kst_zeit")) + "</td></tr>\n    </tbody></table>";

    html += "<h3>Hausalarm</h3>\n    <table><thead><tr><th>Gruppe</th><th>Zeitpunkt</th><th>Bemerkung</th></tr></thead><tbody>";
    hausalarme.forEach(h => {
        html += "<tr><td>" + h.gruppe + "</td><td>" + formatDate(h.zeit) + "</td><td>" + h.bemerkung + "</td></tr>";
    });
    html += "</tbody></table>";

    html += "<h3>Externe Kr\u00e4fte</h3>\n    <table><thead><tr><th>Organisation</th><th>Zeitpunkt</th><th>Bemerkung</th></tr></thead><tbody>";
    externeKraefte.forEach(e => {
        html += "<tr><td>" + e.org + "</td><td>" + formatDate(e.zeit) + "</td><td>" + e.bemerkung + "</td></tr>";
    });
    html += "</tbody></table>";

    return html;
}

function savePDF() {
    const filename = buildPdfFilename();

    const htmlContent =
        "<div id=\"pdf-content\" style=\"font-family: 'Segoe UI', sans-serif; padding: 20px;\">" +
        "<div style=\"border: 2px solid #455a64; padding: 20px;\">" +
        buildPrintHtml() +
        "</div></div>";

    const temp = document.createElement("div");
    temp.innerHTML = htmlContent;
    document.body.appendChild(temp);

    const element = temp.querySelector("#pdf-content");

    const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(temp);
    });
}

/* ----------------------------------------------------
   JSON – Einsatzstand speichern / laden
---------------------------------------------------- */
function buildStateObject() {
    const val = id => (document.getElementById(id)?.value || "").trim();
    const rel = document.querySelector("input[name='rel_choice']:checked")?.value || "Nein";
    const kst = document.querySelector("input[name='kst_choice']:checked")?.value || "Nein";

    return {
        version: 32,
        einsatzdaten: {
            einsatznummer:       val("einsatznummer"),
            standort:            val("standort"),
            einsatzstichwort:    val("einsatzstichwort"),
            einsatzleiter:       val("einsatzleiter"),
            einsatzbeginn:       val("einsatzbeginn"),
            cppartner:           val("cppartner"),
            asstufe:             val("asstufe"),
            windrichtung:        val("windrichtung"),
            windgeschwindigkeit: val("windgeschwindigkeit")
        },
        behoerdenmeldungen: meldungen,
        alarmierung: {
            rel_choice: rel,
            rel_zeit:   val("rel_zeit"),
            kst_choice: kst,
            kst_zeit:   val("kst_zeit"),
            hausalarm:  hausalarme,
            externe:    externeKraefte
        },
        massnahmen,
        kommentare,
        massnahmeCounter
    };
}

function exportStateJSON() {
    const state = buildStateObject();
    const nr    = document.getElementById("einsatznummer").value.trim() || "Unbekannt";
    const d     = new Date();
    const t     = n => String(n).padStart(2,"0");
    const date  = d.getFullYear()+"-"+t(d.getMonth()+1)+"-"+t(d.getDate());
    const name  = date+"_"+nr+"_state.json";

    const blob = new Blob([JSON.stringify(state,null,2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();

    URL.revokeObjectURL(url);
}

function importStateJSON(ev) {
    const file = ev.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const state = JSON.parse(e.target.result);

            const valSet = (id,v) => {
                const el = document.getElementById(id);
                if (el) el.value = v || "";
            };

            const ed = state.einsatzdaten || {};
            valSet("einsatznummer", ed.einsatznummer);
            valSet("standort",      ed.standort);
            valSet("einsatzstichwort", ed.einsatzstichwort);
            valSet("einsatzleiter", ed.einsatzleiter);
            valSet("einsatzbeginn", ed.einsatzbeginn);
            valSet("cppartner",     ed.cppartner);
            valSet("asstufe",       ed.asstufe);
            valSet("windrichtung",  ed.windrichtung);
            valSet("windgeschwindigkeit", ed.windgeschwindigkeit);

            meldungen = state.behoerdenmeldungen || [];

            const al = state.alarmierung || {};
            document.querySelectorAll("input[name='rel_choice']").forEach(r => r.checked = (r.value === al.rel_choice));
            toggleRel(al.rel_choice || "Nein");
            valSet("rel_zeit", al.rel_zeit);

            document.querySelectorAll("input[name='kst_choice']").forEach(r => r.checked = (r.value === al.kst_choice));
            toggleKst(al.kst_choice || "Nein");
            valSet("kst_zeit", al.kst_zeit);

            hausalarme      = al.hausalarm || [];
            externeKraefte  = al.externe   || [];
            massnahmen      = state.massnahmen || [];
            kommentare      = state.kommentare || [];
            massnahmeCounter = state.massnahmeCounter || 5;

            massnahmen.forEach(m => {
                if (!m.status) m.status = "offen";
                if (typeof m.dueState === "undefined") m.dueState = "neutral";
                if (typeof m.infoText === "undefined") m.infoText = "";
                if (typeof m.infoLinks === "undefined") m.infoLinks = "";
                if (typeof m.infoOpen === "undefined") m.infoOpen = false;
            });

            renderMassnahmen();
            renderKommentare();
            renderMeldungen();
            renderHausalarme();
            renderExterne();
            renderKommentarAuswahl();

            alert("Einsatzstand wurde geladen.");
        } catch (err) {
            alert("Fehler beim Einlesen der Datei.");
        }
        ev.target.value = "";
    };
    reader.readAsText(file,"utf-8");
}

/* ----------------------------------------------------
   Initialisierung
---------------------------------------------------- */
window.onload = async () => {
    // Maßnahmen kommen ausschließlich aus dem Admin-Katalog (localStorage).
    // massnahmen.json ist nur Seed-Quelle für admin-massnahmen.html.
    mergeAdminMassnahmen();
    renderMassnahmen();

    // Modal-Schließen: sichere Initialisierung
    const modalBtn = document.getElementById("lagebildModalClose");
    if (modalBtn) {
        modalBtn.addEventListener("click", () => {
            const m = document.getElementById("lagebildModal");
            if (m) m.style.display = "none";
        });
    }

    renderKommentare();
    renderMeldungen();
    renderHausalarme();
    renderExterne();
    renderKommentarAuswahl();
    toggleMeldungFields();

    document.getElementById("meldung_art").addEventListener("change", toggleMeldungFields);
    document.getElementById("meldung_begruendung").addEventListener("change", () => {
        const sel = document.getElementById("meldung_begruendung").value;
        document.getElementById("meldung_begruendung_text").style.display =
            (sel === "Sonstiges") ? "block" : "none";
    });

    // Modal-Buttons
    document.getElementById("edit_save").addEventListener("click", () => {
        if (!editCurrent) return;
        editCurrent.titel = document.getElementById("edit_title").value.trim();
        editCurrent.type  = document.getElementById("edit_type").value;

        const iv = document.getElementById("edit_intervall").value.trim();
        if (editCurrent.type === "intervall") {
            const v = parseInt(iv || "0", 10);
            editCurrent.intervallMinutes = (!isNaN(v) && v > 0) ? v : null;
            if (editCurrent.intervallMinutes) {
                editCurrent.nextDue = Date.now() + editCurrent.intervallMinutes * 60000;
            }
        } else {
            editCurrent.intervallMinutes = null;
            editCurrent.nextDue = null;
        }

        document.getElementById("editModal").style.display = "none";
        renderMassnahmen();
    });

    document.getElementById("edit_reset").addEventListener("click", () => {
        if (!editCurrent) return;
        editCurrent.status = "offen";
        editCurrent.erledigtAm = null;
        editCurrent.dueState = "neutral";

        if (editCurrent.type === "intervall" && editCurrent.intervallMinutes) {
            editCurrent.nextDue = Date.now() + editCurrent.intervallMinutes * 60000;
        } else {
            editCurrent.nextDue = null;
        }

        document.getElementById("editModal").style.display = "none";
        renderMassnahmen();
    });

    document.getElementById("edit_cancel").addEventListener("click", () => {
        document.getElementById("editModal").style.display = "none";
    });

    setInterval(tickIntervalMassnahmen, 10000);
    initLessonLearnedActions();
};

document.addEventListener("DOMContentLoaded", () => {
    const llLink = document.getElementById("flagLL");
    const keyL = "ll_" + EINSATZ_ID;

    if (llLink) {
        llLink.addEventListener("click", () => {
            localStorage.setItem(keyL, "true");
        });
    }

    if (llLink && localStorage.getItem(keyL)) {
        llLink.classList.add("einsatz-aktiv");
    }
});
