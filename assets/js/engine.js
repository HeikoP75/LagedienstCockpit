// ENGINE 2.1 – Maßnahmensteuerung für Lagedienst Cockpit

let actions = [];
let actionsById = {};
let uiContainer = null;

// ---- Lade Maßnahmen aus JSON ----

async function loadActions(jsonPath) {
    const response = await fetch(jsonPath);
    actions = await response.json();

    // Index anlegen für schnellen Zugriff
    actions.forEach(a => {
        actionsById[a.id] = a;
    });

    renderActions();
}


// ---- Maßnahmen anzeigen ----

function renderActions() {
    uiContainer = document.getElementById("actions");

    uiContainer.innerHTML = "";

    actions.forEach(action => {
        if (action.hidden === true) return; // versteckte Maßnahmen erst später

        const div = document.createElement("div");
        div.className = "actionCard " + action.status;

        div.innerHTML = `
            <div class="title">${action.title}</div>
            <div class="controls">
                <button onclick="toggleDone('${action.id}')">Erledigt</button>
                <button onclick="editAction('${action.id}')">✎</button>
            </div>
        `;

        uiContainer.appendChild(div);
    });
}


// ---- Status ändern (optional ↔ required ↔ interval) ----

function editAction(id) {
    const a = actionsById[id];

    const choices = ["optional", "required", "interval"];
    const newStatus = prompt("Status wählen (optional / required / interval):", a.status);

    if (!choices.includes(newStatus)) return;

    // Pflichtschutz
    if (a.statusLock === true && newStatus !== "required") {
        alert("Diese Maßnahme ist systemseitig zwingend und kann nicht gelockert werden.");
        return;
    }

    // Warnung: Von zwingend → optional
    if (a.status === "required" && newStatus === "optional") {
        const confirmChange = confirm(
            "WARNUNG!\nDiese Maßnahme ist aktuell zwingend.\nSoll sie wirklich auf optional gesetzt werden?"
        );
        if (!confirmChange) return;
    }

    a.status = newStatus;
    renderActions();
}


// ---- Abhängigkeiten: KMvD → erweitertes Lagebild ----

function toggleDone(id) {
    const a = actionsById[id];

    // erledigt markieren (hier noch keine Speicherung)
    a.completed = true;

    // Abhängigkeiten prüfen
    if (a.onComplete) {
        a.onComplete.forEach(rule => {
            const target = actionsById[rule.target];

            // Status ändern
            if (rule.setStatus) target.status = rule.setStatus;

            // sichtbar machen
            if (rule.reveal) target.hidden = false;

            // spezielle Aktionen
            if (rule.action === "promptLagebild") {
                alert("Erweitertes Lagebild erforderlich.\nBitte Lagebild ausfüllen und versenden.");
                // Hier könnte FEUER.html das Formular öffnen
            }
        });
    }

    renderActions();
}
