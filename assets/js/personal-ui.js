(function attachPersonalUi(global) {
  const state = {
    dataset: global.personalData.createDefaultDataset(),
    filteredEmployees: [],
    currentEmployeeId: null,
    searchTerm: "",
    selectedFilter: "alle",
    editMode: false
  };

  const SELECT_OPTIONS = {
    schicht: ["WA 1", "WA 2"],
    schichtart: ["TD", "4'er Turn", "24 Std."],
    beschaeftigungsart: ["Vollzeit", "TZ 95%", "TZ 90%", "TZ 75%", "TZ 50%"],
    rtwQualifikation: ["keine", "RS", "NotSan", "RettSan"],
    maschinistStatus: ["Teilmaschinist", "Vollmaschinist"],
    xBand: ["", "1", "2", "3", "4", "5"],
    xBandZusatz: ["", "UB", "MB", "OB"],
    gespraechKategorie: [
      "Mitarbeitergespräch",
      "Jahresgespräch",
      "Feedback",
      "Vereinbarung",
      "Entwicklung",
      "Hinweis"
    ]
  };

  const FIELD_LABELS = {
    vorname: "Vorname",
    nachname: "Nachname",
    geburtsdatum: "Geburtsdatum",
    geburtsort: "Geburtsort",
    familienstand: "Familienstand",
    kinder: "Kinder",
    notfallkontakt1: "Notfallkontakt 1",
    notfallkontakt2: "Notfallkontakt 2",
    funktion: "Funktion",
    dienstgrad: "Dienstgrad",
    schicht: "Schicht",
    schichtart: "Schichtart",
    eintrittUnternehmen: "Eintritt ins Unternehmen",
    eintrittFeuerwehr: "Eintritt in die Feuerwehr",
    beschaeftigungsart: "Beschäftigungsart",
    entgelt: "Entgelt",
    diensttelefon: "Diensttelefon",
    privattelefon: "Privattelefon",
    email: "E-Mail",
    atemschutztauglich: "Atemschutztauglich",
    maschinistStatus: "Maschinisten-Status",
    rtwQualifikation: "RTW-Qualifikation",
    xBand: "X-Band",
    xBandZusatz: "X-Band Zusatz",
    archiviertAm: "Archiviert am",
    archiviertGrund: "Archivierungsgrund",
    gehaltsentwicklung: "Gehaltsentwicklung",
    leistungszahlungen: "Leistungszahlungen"
  };

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    if (!root) {
      return [];
    }
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function formatDate(value) {
    if (!value) {
      return "Nicht hinterlegt";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) {
      return "Nicht hinterlegt";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
      return "Nicht hinterlegt";
    }
    const normalized = Number(String(value).replace(",", "."));
    if (Number.isNaN(normalized)) {
      return `${value} EUR`;
    }
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR"
    }).format(normalized);
  }

  function buildOptions(options, selectedValue) {
    return options
      .map((option) => `<option value="${escapeHtml(option)}" ${option === selectedValue ? "selected" : ""}>${escapeHtml(option || "Bitte wählen")}</option>`)
      .join("");
  }

  function parseLines(value, mapper) {
    return String(value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(mapper)
      .filter(Boolean);
  }

  function formatHistoryLines(entries, formatter) {
    if (!entries?.length) {
      return "Keine Eintraege vorhanden.";
    }
    return entries.map(formatter).join("\n");
  }

  function formatChildren(value) {
    if (!Array.isArray(value) || !value.length) {
      return "Nicht hinterlegt";
    }
    if (value.length === 1 && /^\d+$/.test(value[0])) {
      return `${value[0]} Kind(er)`;
    }
    return value.join(", ");
  }

  function getEmployeeName(employee) {
    const firstName = employee?.stammdaten?.vorname || "";
    const lastName = employee?.stammdaten?.nachname || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || "Unbenannter Eintrag";
  }

  function initials(employee) {
    return getEmployeeName(employee)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function setStatus(message, variant = "info", root = document) {
    const banner = qs("[data-status]", root);
    if (!banner) {
      return;
    }
    banner.textContent = message || "";
    banner.className = `status-banner ${variant}`;
    banner.classList.toggle("hidden", !message);
  }

  function getCurrentEmployee() {
    return global.personalData.getEmployeeById(state.dataset, state.currentEmployeeId);
  }

  function getEmployeeByUrl() {
    const url = new URL(window.location.href);
    return url.searchParams.get("id");
  }

  function updateDetailLink(employeeId) {
    const detailLink = qs("[data-open-datasheet]");
    if (detailLink) {
      detailLink.href = `./personal-datenblatt.html?id=${encodeURIComponent(employeeId)}`;
    }
  }

  function toggleAuthSections(isAuthenticated) {
    qsa("[data-auth-guard]").forEach((element) => {
      element.classList.toggle("hidden", !isAuthenticated);
    });
    qsa("[data-auth-only]").forEach((element) => {
      element.classList.toggle("hidden", isAuthenticated);
    });
  }

  function buildAuthCard() {
    return `
      <div class="auth-layout">
        <section class="auth-card">
          <h1 class="page-title">Personalmodul</h1>
          <p class="page-subtitle">
            Zugriff nur nach erfolgreicher Authentifizierung. Beim Erstzugang kann ein WebAuthn-Zugang
            registriert oder alternativ eine 6-stellige PIN gesetzt werden.
          </p>
          <div data-status class="status-banner info hidden"></div>
          <div class="grid">
            <div class="field-group">
              <label for="pin-input">PIN</label>
              <input id="pin-input" name="pin" type="password" inputmode="numeric" maxlength="6" placeholder="6-stellige PIN">
            </div>
          </div>
          <div class="auth-actions" style="margin-top: 18px;">
            <button class="btn btn-primary" type="button" data-action="auth-webauthn-login">Mit WebAuthn anmelden</button>
            <button class="btn btn-secondary" type="button" data-action="auth-pin-login">Mit PIN anmelden</button>
            <button class="btn btn-ghost" type="button" data-action="auth-register-webauthn">WebAuthn registrieren</button>
            <button class="btn btn-ghost" type="button" data-action="auth-set-pin">PIN setzen</button>
          </div>
        </section>
      </div>
    `;
  }

  async function handleAuthAction(action) {
    const pinInput = qs("#pin-input");
    const pin = pinInput?.value?.trim() || "";
    try {
      if (action === "auth-pin-login") {
        const isValid = await global.personalAuth.verifyPin(pin);
        if (!isValid) {
          throw new Error("PIN stimmt nicht.");
        }
        window.location.reload();
        return;
      }

      if (action === "auth-set-pin") {
        await global.personalAuth.setPin(pin);
        setStatus("PIN wurde erfolgreich gesetzt.", "success");
        window.location.reload();
        return;
      }

      if (action === "auth-register-webauthn") {
        await global.personalAuth.registerWebAuthn();
        setStatus("WebAuthn wurde erfolgreich registriert.", "success");
        window.location.reload();
        return;
      }

      if (action === "auth-webauthn-login") {
        await global.personalAuth.authenticateWithWebAuthn();
        window.location.reload();
      }
    } catch (error) {
      setStatus(error.message || "Authentifizierung fehlgeschlagen.", "error");
    }
  }

  function mountAuthGate() {
    const authRoot = qs("[data-auth-root]");
    if (!authRoot) {
      return;
    }
    authRoot.innerHTML = buildAuthCard();
    authRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }
      handleAuthAction(button.dataset.action);
    });

    if (global.personalAuth.isFirstAccess()) {
      setStatus("Erstzugang erkannt: Bitte WebAuthn registrieren oder eine PIN setzen.", "info", authRoot);
    } else if (!global.personalAuth.isPinSet() && !global.personalAuth.hasWebAuthnCredential()) {
      setStatus("Es ist noch keine Authentifizierung eingerichtet.", "info", authRoot);
    }
  }

  async function ensureAuthenticated() {
    const authenticated = global.personalAuth.isAuthenticated();
    toggleAuthSections(authenticated);
    if (!authenticated) {
      mountAuthGate();
      return false;
    }
    return true;
  }

  async function refreshDataset() {
    state.dataset = await global.personalData.loadDataset();
    state.filteredEmployees = state.dataset.mitarbeiter.slice();
    return state.dataset;
  }

  function buildEmployeeCard(employee) {
    const hasPhoto = Boolean(employee.foto);
    const recentEntry = employee.eintraege[0];
    return `
      <article class="employee-card">
        ${hasPhoto
          ? `<img class="employee-avatar" src="${employee.foto}" alt="Foto von ${escapeHtml(getEmployeeName(employee))}">`
          : `<div class="employee-avatar-placeholder">${escapeHtml(initials(employee))}</div>`}
        <div>
          <h3 class="employee-name">${escapeHtml(getEmployeeName(employee))}</h3>
          <p class="employee-meta">
            ${escapeHtml(employee.stammdaten.funktion || "Funktion offen")} ·
            ${escapeHtml(employee.stammdaten.dienstgrad || "Dienstgrad offen")} ·
            ${escapeHtml(employee.stammdaten.schicht || "Schicht offen")}
          </p>
          <div class="pill-row">
            <span class="pill">${escapeHtml(employee.feuerwehr.atemschutztauglich || "Atemschutz offen")}</span>
            <span class="pill">${escapeHtml(employee.feuerwehr.maschinistStatus || "Maschinist offen")}</span>
            <span class="pill">${escapeHtml(employee.feuerwehr.rtwQualifikation || "RTW offen")}</span>
          </div>
          <p class="meta-text">
            Letzter Eintrag: ${recentEntry ? `${formatDate(recentEntry.datum || recentEntry.erstelltAm)} · ${escapeHtml(recentEntry.titel || recentEntry.kategorie || "Ohne Titel")}` : "Noch keine Einträge"}
          </p>
        </div>
        <div class="list-actions">
          <a class="btn btn-primary" href="./personal-datenblatt.html?id=${encodeURIComponent(employee.id)}">Datenblatt</a>
        </div>
      </article>
    `;
  }

  function renderSummary() {
    const employees = state.dataset.mitarbeiter;
    const summaryRoot = qs("[data-summary]");
    if (!summaryRoot) {
      return;
    }
    const totalEntries = employees.reduce((sum, employee) => sum + employee.eintraege.length, 0);
    const readyBreathing = employees.filter((employee) => employee.feuerwehr.atemschutztauglich).length;
    summaryRoot.innerHTML = `
      <article class="summary-card"><span class="muted">Mitarbeitende</span><strong>${employees.length}</strong></article>
      <article class="summary-card"><span class="muted">Einträge gesamt</span><strong>${totalEntries}</strong></article>
      <article class="summary-card"><span class="muted">Atemschutz gepflegt</span><strong>${readyBreathing}</strong></article>
    `;
  }

  function renderEmployeeList() {
    const listRoot = qs("[data-employee-list]");
    if (!listRoot) {
      return;
    }

    if (!state.filteredEmployees.length) {
      listRoot.innerHTML = `
        <div class="panel empty-state">
          <h2>Keine Treffer</h2>
          <p>Die aktuelle Suche oder Filterung liefert keine Mitarbeitenden.</p>
        </div>
      `;
      return;
    }

    listRoot.innerHTML = state.filteredEmployees.map(buildEmployeeCard).join("");
  }

  function applyFilters() {
    let employees = global.personalData.filterEmployees(state.dataset, state.searchTerm);
    if (state.selectedFilter === "atemschutz") {
      employees = employees.filter((employee) => employee.feuerwehr.atemschutztauglich);
    }
    if (state.selectedFilter === "maschinist") {
      employees = employees.filter((employee) => employee.feuerwehr.maschinistStatus);
    }
    if (state.selectedFilter === "rtw") {
      employees = employees.filter((employee) => employee.feuerwehr.rtwQualifikation);
    }
    state.filteredEmployees = employees;
    renderEmployeeList();
  }

  async function exportFilteredEmployeesPdf() {
    if (!state.filteredEmployees.length) {
      setStatus("Keine gefilterten Einträge für den PDF-Export vorhanden.", "error");
      return;
    }
    const container = document.createElement("section");
    container.className = "panel";
    container.innerHTML = `
      <h1>Personalfilter Export</h1>
      <p>Erstellt am ${formatDateTime(new Date().toISOString())}</p>
      ${state.filteredEmployees
        .map(
          (employee) => `
            <article style="padding:16px 0;border-bottom:1px solid rgba(124,138,151,0.18);">
              <h2>${escapeHtml(getEmployeeName(employee))}</h2>
              <p>${escapeHtml(employee.stammdaten.funktion || "Funktion offen")} · ${escapeHtml(employee.stammdaten.dienstgrad || "Dienstgrad offen")}</p>
              <p>${escapeHtml(employee.eintraege.map((entry) => [entry.kategorie, entry.titel, entry.inhalt].filter(Boolean).join(" - ")).join(" | ") || "Keine Eintraege")}</p>
            </article>
          `
        )
        .join("")}
    `;
    await html2pdf().set({
      margin: 10,
      filename: "personal-gefiltert.pdf",
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(container).save();
  }

  function openModal(content) {
    const modalRoot = qs("[data-modal-root]");
    if (!modalRoot) {
      return;
    }
    modalRoot.innerHTML = `<div class="modal">${content}</div>`;
    modalRoot.classList.add("is-open");
  }

  function closeModal() {
    const modalRoot = qs("[data-modal-root]");
    if (!modalRoot) {
      return;
    }
    modalRoot.classList.remove("is-open");
    modalRoot.innerHTML = "";
  }

  async function exportEmployeeSheetModal(employee) {
    openModal(`
      <h2>PDF-Datenblatt</h2>
      <p class="muted">Wählen Sie die Bereiche für das Datenblatt von ${escapeHtml(getEmployeeName(employee))}.</p>
      <form id="pdf-selection-form" class="grid">
        <label><input type="checkbox" name="section" value="stammdaten" checked> Stammdaten</label>
        <label><input type="checkbox" name="section" value="feuerwehr" checked> Feuerwehrspezifisches</label>
        <label><input type="checkbox" name="section" value="eintraege" checked> Mitarbeitergespräche</label>
        <label><input type="checkbox" name="section" value="felder" checked> Eigene Felder</label>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">PDF erzeugen</button>
          <button type="button" class="btn btn-secondary" data-action="close-modal">Abbrechen</button>
        </div>
      </form>
    `);

    const form = qs("#pdf-selection-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const sections = Array.from(new FormData(form).getAll("section"));
      await exportEmployeeSheetPdf(employee, sections);
      closeModal();
    });
  }

  async function exportEmployeeSheetPdf(employee, sections) {
    const include = new Set(sections);
    const container = document.createElement("section");
    container.className = "panel";
    const stammdatenRows = Object.entries(employee.stammdaten)
      .map(([key, value]) => `<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(Array.isArray(value) ? value.join(", ") : value || "Nicht hinterlegt")}</div>`)
      .join("");
    const feuerwehrRows = Object.entries(employee.feuerwehr)
      .map(([key, value]) => `<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value || "Nicht hinterlegt")}</div>`)
      .join("");
    const entryRows = employee.eintraege
      .map(
        (entry) => `
          <article style="padding: 12px 0; border-bottom: 1px solid rgba(124,138,151,0.18);">
            <h3>${escapeHtml(entry.titel || entry.kategorie || "Eintrag")}</h3>
            <p>${escapeHtml(entry.kategorie)} · ${formatDate(entry.datum || entry.erstelltAm)}</p>
            <p>${nl2br(entry.inhalt || "")}</p>
          </article>
        `
      )
      .join("");
    const fieldRows = employee.eigeneFelder
      .map((field) => `<div><strong>${escapeHtml(field.label || field.schluessel)}</strong>: ${escapeHtml(field.wert || "")}</div>`)
      .join("");

    container.innerHTML = `
      <h1>${escapeHtml(getEmployeeName(employee))}</h1>
      <p>Exportiert am ${formatDateTime(new Date().toISOString())}</p>
      ${include.has("stammdaten") ? `<section><h2>Stammdaten</h2>${stammdatenRows}</section>` : ""}
      ${include.has("feuerwehr") ? `<section><h2>Feuerwehrspezifisches</h2>${feuerwehrRows}</section>` : ""}
      ${include.has("eintraege") ? `<section><h2>Mitarbeitergespräche</h2>${entryRows || "<p>Keine Einträge vorhanden.</p>"}</section>` : ""}
      ${include.has("felder") ? `<section><h2>Eigene Felder</h2>${fieldRows || "<p>Keine Felder vorhanden.</p>"}</section>` : ""}
    `;

    await html2pdf().set({
      margin: 10,
      filename: `${getEmployeeName(employee)}-datenblatt.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(container).save();
  }

  async function exportSingleEntryPdf(employee, entryId) {
    const employeeEntry = employee.eintraege.find((entry) => entry.id === entryId);
    if (!employeeEntry) {
      setStatus("Eintrag für den PDF-Export nicht gefunden.", "error");
      return;
    }
    const container = document.createElement("section");
    container.className = "panel";
    container.innerHTML = `
      <h1>${escapeHtml(employeeEntry.titel || employeeEntry.kategorie || "Eintrag")}</h1>
      <p>${escapeHtml(getEmployeeName(employee))} · ${formatDate(employeeEntry.datum || employeeEntry.erstelltAm)}</p>
      <p><strong>Kategorie:</strong> ${escapeHtml(employeeEntry.kategorie || "Nicht hinterlegt")}</p>
      <p><strong>Tags:</strong> ${escapeHtml((employeeEntry.tags || []).join(", ") || "Keine Tags")}</p>
      <div>${nl2br(employeeEntry.inhalt || "")}</div>
    `;
    await html2pdf().set({
      margin: 10,
      filename: `${getEmployeeName(employee)}-eintrag.pdf`,
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(container).save();
  }

  function serializeEmployeeForm(form, existingEmployee) {
    const formData = new FormData(form);
    const entriesContainer = qs("[data-entry-editor-list]");
    const fieldsContainer = qs("[data-custom-field-list]");
    const baseEmployee = existingEmployee || global.personalData.createEmptyEmployee();
    const employee = global.personalData.normalizeEmployee({
      ...baseEmployee,
      stammdaten: {
        ...baseEmployee.stammdaten,
        vorname: formData.get("vorname") || "",
        nachname: formData.get("nachname") || "",
        geburtsdatum: formData.get("geburtsdatum") || "",
        geburtsort: formData.get("geburtsort") || "",
        familienstand: formData.get("familienstand") || "",
        kinder: String(formData.get("kinder") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        notfallkontakt1: formData.get("notfallkontakt1") || "",
        notfallkontakt2: formData.get("notfallkontakt2") || "",
        funktion: formData.get("funktion") || "",
        dienstgrad: formData.get("dienstgrad") || "",
        schicht: formData.get("schicht") || "",
        schichtart: formData.get("schichtart") || "",
        eintrittUnternehmen: formData.get("eintrittUnternehmen") || "",
        eintrittFeuerwehr: formData.get("eintrittFeuerwehr") || "",
        beschaeftigungsart: formData.get("beschaeftigungsart") || "",
        entgelt: formData.get("entgelt") || "",
        diensttelefon: formData.get("diensttelefon") || "",
        privattelefon: formData.get("privattelefon") || "",
        email: formData.get("email") || ""
      },
      feuerwehr: {
        ...baseEmployee.feuerwehr,
        atemschutztauglich: formData.get("atemschutztauglich") || "",
        maschinistStatus: formData.get("maschinistStatus") || "",
        rtwQualifikation: formData.get("rtwQualifikation") || "",
        xBand: formData.get("xBand") || "",
        xBandZusatz: formData.get("xBandZusatz") || ""
      },
      entwicklung: {
        ...baseEmployee.entwicklung,
        gehaltsentwicklung: parseLines(formData.get("gehaltsentwicklung"), (line) => {
          const [jahr = "", betrag = "", planung = ""] = line.split("|").map((item) => item.trim());
          if (!jahr && !betrag && !planung) {
            return null;
          }
          return { jahr, betrag, planung };
        }),
        leistungszahlungen: parseLines(formData.get("leistungszahlungen"), (line) => {
          const [jahr = "", betrag = "", grund = ""] = line.split("|").map((item) => item.trim());
          if (!jahr && !betrag && !grund) {
            return null;
          }
          return { jahr, betrag, grund };
        })
      },
      eintraege: qsa("[data-entry-editor-item]", entriesContainer).map((item) => ({
        id: item.dataset.entryId || "",
        kategorie: qs('[name="eintrag-kategorie"]', item)?.value || "",
        datum: qs('[name="eintrag-datum"]', item)?.value || "",
        titel: qs('[name="eintrag-titel"]', item)?.value || "",
        inhalt: qs('[name="eintrag-inhalt"]', item)?.value || "",
        tags: (qs('[name="eintrag-tags"]', item)?.value || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        erstelltAm: item.dataset.createdAt || new Date().toISOString()
      })),
      eigeneFelder: qsa("[data-custom-field-item]", fieldsContainer).map((item) => ({
        schluessel: item.dataset.fieldKey || "",
        label: qs('[name="feld-label"]', item)?.value || "",
        wert: qs('[name="feld-wert"]', item)?.value || ""
      }))
    });

    return employee;
  }

  function buildReadOnlyDefinitionRows(data) {
    return Object.entries(data)
      .map(([key, value]) => {
        let printable = Array.isArray(value) ? value.join(", ") : value;
        if (key === "kinder") {
          printable = formatChildren(value);
        }
        if (key === "entgelt") {
          printable = formatCurrency(value);
        }
        return `
          <div class="definition-row">
            <div class="meta-label">${escapeHtml(FIELD_LABELS[key] || key)}</div>
            <div>${escapeHtml(printable || "Nicht hinterlegt")}</div>
          </div>
        `;
      })
      .join("");
  }

  function buildEntryEditor(entry) {
    return `
      <article class="entry-card" data-entry-editor-item data-entry-id="${escapeHtml(entry.id)}" data-created-at="${escapeHtml(entry.erstelltAm || "")}">
        <div class="grid two-col">
          <div class="field-group">
            <label>Gesprächsart</label>
            <select name="eintrag-kategorie">${buildOptions(SELECT_OPTIONS.gespraechKategorie, entry.kategorie || "Mitarbeitergespräch")}</select>
          </div>
          <div class="field-group">
            <label>Datum</label>
            <input name="eintrag-datum" type="date" value="${escapeHtml(entry.datum || "")}">
          </div>
          <div class="field-group">
            <label>Titel des Gesprächs</label>
            <input name="eintrag-titel" value="${escapeHtml(entry.titel || "")}" placeholder="z. B. Jahresgespräch 2026">
          </div>
          <div class="field-group">
            <label>Tags</label>
            <input name="eintrag-tags" value="${escapeHtml((entry.tags || []).join(", "))}" placeholder="z. B. Zielvereinbarung, Entwicklung">
          </div>
        </div>
        <div class="field-group">
          <label>Dokumentation</label>
          <textarea name="eintrag-inhalt" placeholder="Verlauf, Inhalte, Absprachen und nächste Schritte dokumentieren">${escapeHtml(entry.inhalt || "")}</textarea>
        </div>
        <div class="entry-actions">
          <button type="button" class="btn btn-secondary" data-action="remove-entry-editor" data-entry-id="${escapeHtml(entry.id)}">Eintrag entfernen</button>
        </div>
      </article>
    `;
  }

  function buildFieldEditor(field) {
    return `
      <article class="entry-card" data-custom-field-item data-field-key="${escapeHtml(field.schluessel)}">
        <div class="grid two-col">
          <div class="field-group">
            <label>Label</label>
            <input name="feld-label" value="${escapeHtml(field.label || "")}">
          </div>
          <div class="field-group">
            <label>Wert</label>
            <input name="feld-wert" value="${escapeHtml(field.wert || "")}">
          </div>
        </div>
        <div class="entry-actions">
          <button type="button" class="btn btn-secondary" data-action="remove-custom-field" data-field-key="${escapeHtml(field.schluessel)}">Feld entfernen</button>
        </div>
      </article>
    `;
  }

  function buildHistoryRows(title, entries, formatter) {
    return `
      <section class="panel section-card">
        <h2>${title}</h2>
        <div class="definition-list">
          ${entries.length
            ? entries
                .map(
                  (entry) => `
                    <div class="definition-row">
                      <div class="meta-label">${escapeHtml(entry.jahr || "Ohne Jahr")}</div>
                      <div>${formatter(entry)}</div>
                    </div>
                  `
                )
                .join("")
            : "<p>Keine Eintraege vorhanden.</p>"}
        </div>
      </section>
    `;
  }

  function buildArchiveModal(employee) {
    const isArchived = employee.meta?.aktiv === false;
    if (isArchived) {
      return `
      <h2>Datenblatt reaktivieren</h2>
        <p class="muted">${escapeHtml(getEmployeeName(employee))} ist archiviert und kann wieder in die aktive Mitarbeiterliste aufgenommen werden.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" data-action="confirm-restore">Reaktivieren</button>
          <button class="btn btn-secondary" type="button" data-action="close-modal">Abbrechen</button>
        </div>
      `;
    }

    return `
      <h2>Datenblatt archivieren</h2>
      <p class="muted">Das Datenblatt bleibt erhalten, wird aber aus der aktiven Mitarbeiterliste entfernt.</p>
      <div class="field-group">
        <label for="archive-reason">Grund</label>
        <textarea id="archive-reason" name="archiveReason" placeholder="z. B. Mitarbeiter hat das Unternehmen verlassen"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger" type="button" data-action="confirm-archive">Archivieren</button>
        <button class="btn btn-secondary" type="button" data-action="close-modal">Abbrechen</button>
      </div>
    `;
  }

  function renderDetailPage() {
    const root = qs("[data-datasheet-root]");
    const employee = getCurrentEmployee();
    if (!root || !employee) {
      return;
    }

    const readOnlyEntries = employee.eintraege
      .map((entry) => {
        const collapsed = (entry.inhalt || "").length > 240;
        return `
          <article class="entry-card">
            <div class="entry-header">
              <div>
                <h3>${escapeHtml(entry.titel || entry.kategorie || "Eintrag")}</h3>
                <p class="muted">${escapeHtml(entry.kategorie || "Ohne Kategorie")} · ${formatDate(entry.datum || entry.erstelltAm)}</p>
              </div>
              <div class="entry-actions">
                <button type="button" class="btn btn-ghost" data-action="export-entry-pdf" data-entry-id="${escapeHtml(entry.id)}">Eintrag als PDF</button>
              </div>
            </div>
            <div class="pill-row">${(entry.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</div>
            <p class="entry-content ${collapsed ? "is-collapsed" : ""}" data-entry-content>${nl2br(entry.inhalt || "")}</p>
            ${collapsed ? `<button class="entry-toggle" type="button" data-action="toggle-entry">Mehr anzeigen</button>` : ""}
          </article>
        `;
      })
      .join("");

    const compensationRows = {
      entgelt: employee.stammdaten.entgelt,
      gehaltsentwicklung: formatHistoryLines(
        employee.entwicklung?.gehaltsentwicklung,
        (entry) => `${entry.jahr || "o. J."}: ${formatCurrency(entry.betrag)}${entry.planung ? ` - Planung: ${entry.planung}` : ""}`
      ),
      leistungszahlungen: formatHistoryLines(
        employee.entwicklung?.leistungszahlungen,
        (entry) => `${entry.jahr || "o. J."}: ${formatCurrency(entry.betrag)} - Grund: ${entry.grund || "Nicht hinterlegt"}`
      )
    };

    root.innerHTML = `
      <div class="details-layout">
        <aside class="panel profile-card">
          ${employee.foto
            ? `<img class="profile-photo" src="${employee.foto}" alt="Foto von ${escapeHtml(getEmployeeName(employee))}">`
            : `<div class="profile-photo-placeholder">${escapeHtml(initials(employee))}</div>`}
          <h2>${escapeHtml(getEmployeeName(employee))}</h2>
          <p class="muted">${escapeHtml(employee.stammdaten.funktion || "Funktion offen")}</p>
          <div class="pill-row">
            <span class="pill">${escapeHtml(employee.stammdaten.dienstgrad || "Dienstgrad offen")}</span>
            <span class="pill">${escapeHtml(employee.stammdaten.schicht || "Schicht offen")}</span>
            <span class="pill">${escapeHtml(employee.stammdaten.schichtart || "Schichtart offen")}</span>
          </div>
          <div class="stack" style="margin-top: 18px;">
            <a class="btn btn-secondary" href="./personal.html">Zur Liste</a>
            <button type="button" class="btn btn-primary" data-action="toggle-edit-mode">${state.editMode ? "Lesemodus aktivieren" : "Bearbeitungsmodus"}</button>
            <button type="button" class="btn btn-ghost" data-action="export-sheet-pdf">Datenblatt als PDF</button>
            <button type="button" class="btn ${employee.meta?.aktiv === false ? "btn-secondary" : "btn-danger"}" data-action="toggle-archive">${employee.meta?.aktiv === false ? "Datenblatt reaktivieren" : "Datenblatt archivieren"}</button>
          </div>
        </aside>
        <section class="stack">
          <div data-status class="status-banner info hidden"></div>
          ${employee.meta?.aktiv === false ? `
            <section class="panel section-card">
              <h2>Archivstatus</h2>
              <div class="definition-list">
                ${buildReadOnlyDefinitionRows({
                  archiviertAm: formatDateTime(employee.meta?.archiviertAm),
                  archiviertGrund: employee.meta?.archiviertGrund || "Nicht hinterlegt"
                })}
              </div>
            </section>
          ` : ""}
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Stammdaten</h2>
            <div class="definition-list">${buildReadOnlyDefinitionRows(employee.stammdaten)}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Feuerwehrspezifisches</h2>
            <div class="definition-list">${buildReadOnlyDefinitionRows(employee.feuerwehr)}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Beschaeftigung und Verguetung</h2>
            <div class="definition-list">${buildReadOnlyDefinitionRows({
              schicht: employee.stammdaten.schicht,
              schichtart: employee.stammdaten.schichtart,
              beschaeftigungsart: employee.stammdaten.beschaeftigungsart,
              entgelt: compensationRows.entgelt
            })}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Gehaltsentwicklung und Planung</h2>
            <div class="definition-list">${buildReadOnlyDefinitionRows({
              gehaltsentwicklung: compensationRows.gehaltsentwicklung,
              leistungszahlungen: compensationRows.leistungszahlungen
            })}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Mitarbeitergespräche</h2>
            <div class="entry-list">${readOnlyEntries || "<p>Keine dokumentierten Gespräche vorhanden.</p>"}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "hidden" : ""}" data-read-view>
            <h2>Eigene Felder</h2>
            <div class="definition-list">${employee.eigeneFelder.length ? buildReadOnlyDefinitionRows(Object.fromEntries(employee.eigeneFelder.map((field) => [field.label || field.schluessel, field.wert]))) : "<p>Keine eigenen Felder vorhanden.</p>"}</div>
          </section>
          <section class="panel section-card ${state.editMode ? "" : "hidden"}" data-edit-view>
            <h2>Datenblatt bearbeiten</h2>
            <form id="employee-edit-form" class="stack">
              <div class="grid two-col">
                <div class="field-group"><label>Vorname</label><input name="vorname" value="${escapeHtml(employee.stammdaten.vorname)}"></div>
                <div class="field-group"><label>Nachname</label><input name="nachname" value="${escapeHtml(employee.stammdaten.nachname)}"></div>
                <div class="field-group"><label>Geburtsdatum</label><input name="geburtsdatum" type="date" value="${escapeHtml(employee.stammdaten.geburtsdatum)}"></div>
                <div class="field-group"><label>Geburtsort</label><input name="geburtsort" value="${escapeHtml(employee.stammdaten.geburtsort)}"></div>
                <div class="field-group"><label>Familienstand</label><input name="familienstand" value="${escapeHtml(employee.stammdaten.familienstand)}"></div>
                <div class="field-group"><label>Kinder (Anzahl oder Namen, kommagetrennt)</label><input name="kinder" value="${escapeHtml((employee.stammdaten.kinder || []).join(", "))}"></div>
                <div class="field-group"><label>Notfallkontakt 1</label><input name="notfallkontakt1" value="${escapeHtml(employee.stammdaten.notfallkontakt1)}"></div>
                <div class="field-group"><label>Notfallkontakt 2</label><input name="notfallkontakt2" value="${escapeHtml(employee.stammdaten.notfallkontakt2)}"></div>
                <div class="field-group"><label>Funktion</label><input name="funktion" value="${escapeHtml(employee.stammdaten.funktion)}"></div>
                <div class="field-group"><label>Dienstgrad</label><input name="dienstgrad" value="${escapeHtml(employee.stammdaten.dienstgrad)}"></div>
                <div class="field-group"><label>Schicht</label><select name="schicht">${buildOptions(SELECT_OPTIONS.schicht, employee.stammdaten.schicht)}</select></div>
                <div class="field-group"><label>Schichtart</label><select name="schichtart">${buildOptions(SELECT_OPTIONS.schichtart, employee.stammdaten.schichtart)}</select></div>
                <div class="field-group"><label>Eintritt Unternehmen</label><input name="eintrittUnternehmen" type="date" value="${escapeHtml(employee.stammdaten.eintrittUnternehmen)}"></div>
                <div class="field-group"><label>Eintritt Feuerwehr</label><input name="eintrittFeuerwehr" type="date" value="${escapeHtml(employee.stammdaten.eintrittFeuerwehr)}"></div>
                <div class="field-group"><label>Beschaeftigungsart</label><select name="beschaeftigungsart">${buildOptions(SELECT_OPTIONS.beschaeftigungsart, employee.stammdaten.beschaeftigungsart)}</select></div>
                <div class="field-group"><label>Entgelt in EUR</label><input name="entgelt" inputmode="decimal" value="${escapeHtml(employee.stammdaten.entgelt)}"></div>
                <div class="field-group"><label>Diensttelefon</label><input name="diensttelefon" value="${escapeHtml(employee.stammdaten.diensttelefon)}"></div>
                <div class="field-group"><label>Privattelefon</label><input name="privattelefon" value="${escapeHtml(employee.stammdaten.privattelefon)}"></div>
                <div class="field-group"><label>E-Mail</label><input name="email" type="email" value="${escapeHtml(employee.stammdaten.email)}"></div>
                <div class="field-group"><label>Atemschutztauglich</label><input name="atemschutztauglich" value="${escapeHtml(employee.feuerwehr.atemschutztauglich)}"></div>
                <div class="field-group"><label>Maschinist-Status</label><select name="maschinistStatus">${buildOptions(SELECT_OPTIONS.maschinistStatus, employee.feuerwehr.maschinistStatus)}</select></div>
                <div class="field-group"><label>RTW-Qualifikation</label><select name="rtwQualifikation">${buildOptions(SELECT_OPTIONS.rtwQualifikation, employee.feuerwehr.rtwQualifikation)}</select></div>
                <div class="field-group"><label>X-Band</label><select name="xBand">${buildOptions(SELECT_OPTIONS.xBand, employee.feuerwehr.xBand)}</select></div>
                <div class="field-group"><label>X-Band Zusatz</label><select name="xBandZusatz">${buildOptions(SELECT_OPTIONS.xBandZusatz, employee.feuerwehr.xBandZusatz)}</select></div>
              </div>
              <div class="field-group">
                <label>Foto aktualisieren</label>
                <input name="foto" type="file" accept="image/*">
              </div>
              <section>
                <div class="page-header">
                  <div>
                    <h3>Gehaltsentwicklung und Planung</h3>
                    <p class="muted">Pro Zeile: Jahr | Betrag | Planung</p>
                  </div>
                </div>
                <div class="field-group">
                  <textarea name="gehaltsentwicklung" placeholder="2024 | 3200 | Zielstufe erreicht&#10;2025 | 3400 | Höhergruppierung vorgesehen">${escapeHtml(formatHistoryLines(employee.entwicklung?.gehaltsentwicklung, (entry) => `${entry.jahr} | ${entry.betrag} | ${entry.planung}`))}</textarea>
                </div>
              </section>
              <section>
                <div class="page-header">
                  <div>
                    <h3>Leistungszahlung</h3>
                    <p class="muted">Pro Zeile: Jahr | Betrag | Grund</p>
                  </div>
                </div>
                <div class="field-group">
                  <textarea name="leistungszahlungen" placeholder="2024 | 450 | Sonderprojekt erfolgreich umgesetzt">${escapeHtml(formatHistoryLines(employee.entwicklung?.leistungszahlungen, (entry) => `${entry.jahr} | ${entry.betrag} | ${entry.grund}`))}</textarea>
                </div>
              </section>
              <section>
                <div class="page-header">
                  <div>
                    <h3>Mitarbeitergespräche</h3>
                    <p class="muted">Jedes Gespräch wird einzeln mit Datum, Titel, Inhalt und Tags dokumentiert.</p>
                  </div>
                  <button class="btn btn-secondary" type="button" data-action="add-entry-editor">Gespräch hinzufügen</button>
                </div>
                <div class="entry-list" data-entry-editor-list>${employee.eintraege.map(buildEntryEditor).join("")}</div>
              </section>
              <section>
                <div class="page-header">
                  <div>
                    <h3>Eigene Felder</h3>
                    <p class="muted">Freie Zusatzfelder fuer lokale Anforderungen.</p>
                  </div>
                  <button class="btn btn-secondary" type="button" data-action="add-custom-field">Feld hinzufügen</button>
                </div>
                <div class="entry-list" data-custom-field-list>${employee.eigeneFelder.map(buildFieldEditor).join("")}</div>
              </section>
              <div class="modal-actions">
                <button class="btn btn-primary" type="submit">Speichern</button>
                <button class="btn btn-secondary" type="button" data-action="toggle-edit-mode">Abbrechen</button>
              </div>
            </form>
          </section>
        </section>
      </div>
    `;

    bindDetailEvents();
  }

  function bindDetailEvents() {
    const root = qs("[data-datasheet-root]");
    const form = qs("#employee-edit-form");

    root?.addEventListener("click", async (event) => {
      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget) {
        return;
      }
      const action = actionTarget.dataset.action;
      const employee = getCurrentEmployee();
      if (!employee) {
        return;
      }

      if (action === "toggle-edit-mode") {
        state.editMode = !state.editMode;
        renderDetailPage();
        return;
      }

      if (action === "toggle-entry") {
        const content = actionTarget.previousElementSibling;
        content?.classList.toggle("is-collapsed");
        actionTarget.textContent = content?.classList.contains("is-collapsed") ? "Mehr anzeigen" : "Weniger anzeigen";
        return;
      }

      if (action === "export-entry-pdf") {
        await exportSingleEntryPdf(employee, actionTarget.dataset.entryId);
        return;
      }

      if (action === "export-sheet-pdf") {
        await exportEmployeeSheetModal(employee);
        return;
      }

      if (action === "toggle-archive") {
        openModal(buildArchiveModal(employee));
        return;
      }

      if (action === "confirm-archive") {
        const reason = qs("#archive-reason")?.value?.trim() || "";
        await global.personalData.archiveEmployee(employee.id, reason);
        await refreshDataset();
        closeModal();
        window.location.href = "./personal.html";
        return;
      }

      if (action === "confirm-restore") {
        await global.personalData.restoreEmployee(employee.id);
        await refreshDataset();
        closeModal();
        renderDetailPage();
        setStatus("Datenblatt wurde reaktiviert.", "success");
        return;
      }

      if (action === "add-entry-editor") {
        const list = qs("[data-entry-editor-list]");
        list?.insertAdjacentHTML(
          "beforeend",
          buildEntryEditor({
            id: `eintrag-${Date.now()}`,
            kategorie: "",
            datum: "",
            titel: "",
            inhalt: "",
            tags: [],
            erstelltAm: new Date().toISOString()
          })
        );
        return;
      }

      if (action === "remove-entry-editor") {
        actionTarget.closest("[data-entry-editor-item]")?.remove();
        return;
      }

      if (action === "add-custom-field") {
        const list = qs("[data-custom-field-list]");
        list?.insertAdjacentHTML(
          "beforeend",
          buildFieldEditor({
            schluessel: `feld-${Date.now()}`,
            label: "",
            wert: ""
          })
        );
        return;
      }

      if (action === "remove-custom-field") {
        actionTarget.closest("[data-custom-field-item]")?.remove();
      }
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const employee = getCurrentEmployee();
      if (!employee) {
        return;
      }

      try {
        const updatedEmployee = serializeEmployeeForm(form, employee);
        const photoInput = form.elements.namedItem("foto");
        if (photoInput?.files?.[0]) {
          updatedEmployee.foto = await global.personalData.compressPhoto(photoInput.files[0]);
        }
        await global.personalData.upsertEmployee(updatedEmployee);
        await refreshDataset();
        state.currentEmployeeId = updatedEmployee.id;
        state.editMode = false;
        renderDetailPage();
        setStatus("Datenblatt erfolgreich gespeichert.", "success");
      } catch (error) {
        setStatus(error.message || "Speichern fehlgeschlagen.", "error");
      }
    });
  }

  function buildEmployeeModalForm(employee) {
    return `
      <h2>${employee ? "Mitarbeiter bearbeiten" : "Mitarbeiter anlegen"}</h2>
      <form id="employee-modal-form" class="stack">
        <div class="grid two-col">
          <div class="field-group"><label>Vorname</label><input name="vorname" value="${escapeHtml(employee?.stammdaten?.vorname || "")}" required></div>
          <div class="field-group"><label>Nachname</label><input name="nachname" value="${escapeHtml(employee?.stammdaten?.nachname || "")}" required></div>
          <div class="field-group"><label>Funktion</label><input name="funktion" value="${escapeHtml(employee?.stammdaten?.funktion || "")}"></div>
          <div class="field-group"><label>Dienstgrad</label><input name="dienstgrad" value="${escapeHtml(employee?.stammdaten?.dienstgrad || "")}"></div>
          <div class="field-group"><label>Schicht</label><select name="schicht">${buildOptions(SELECT_OPTIONS.schicht, employee?.stammdaten?.schicht || "")}</select></div>
          <div class="field-group"><label>Schichtart</label><select name="schichtart">${buildOptions(SELECT_OPTIONS.schichtart, employee?.stammdaten?.schichtart || "")}</select></div>
          <div class="field-group"><label>Beschaeftigungsart</label><select name="beschaeftigungsart">${buildOptions(SELECT_OPTIONS.beschaeftigungsart, employee?.stammdaten?.beschaeftigungsart || "")}</select></div>
          <div class="field-group"><label>E-Mail</label><input name="email" type="email" value="${escapeHtml(employee?.stammdaten?.email || "")}"></div>
          <div class="field-group"><label>Atemschutztauglich</label><input name="atemschutztauglich" value="${escapeHtml(employee?.feuerwehr?.atemschutztauglich || "")}"></div>
          <div class="field-group"><label>Maschinist-Status</label><select name="maschinistStatus">${buildOptions(SELECT_OPTIONS.maschinistStatus, employee?.feuerwehr?.maschinistStatus || "")}</select></div>
          <div class="field-group"><label>RTW-Qualifikation</label><select name="rtwQualifikation">${buildOptions(SELECT_OPTIONS.rtwQualifikation, employee?.feuerwehr?.rtwQualifikation || "")}</select></div>
          <div class="field-group"><label>Foto</label><input name="foto" type="file" accept="image/*"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" type="submit">Speichern</button>
          <button class="btn btn-secondary" type="button" data-action="close-modal">Abbrechen</button>
        </div>
      </form>
    `;
  }

  function bindListEvents() {
    qs("[data-search]")?.addEventListener("input", (event) => {
      state.searchTerm = event.target.value || "";
      applyFilters();
    });

    qs("[data-filter]")?.addEventListener("change", (event) => {
      state.selectedFilter = event.target.value || "alle";
      applyFilters();
    });

    qs("[data-create-employee]")?.addEventListener("click", () => {
      openModal(buildEmployeeModalForm());
      bindEmployeeModalSubmit();
    });

    qs("[data-export-filtered]")?.addEventListener("click", exportFilteredEmployeesPdf);

    qs("[data-logout]")?.addEventListener("click", () => {
      global.personalAuth.logout();
      window.location.reload();
    });

    qs("[data-modal-root]")?.addEventListener("click", (event) => {
      if (event.target.matches("[data-modal-root]") || event.target.closest('[data-action="close-modal"]')) {
        closeModal();
      }
    });
  }

  function bindEmployeeModalSubmit(existingEmployee) {
    const form = qs("#employee-modal-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const employee = serializeEmployeeForm(form, existingEmployee || global.personalData.createEmptyEmployee());
        const photoInput = form.elements.namedItem("foto");
        if (photoInput?.files?.[0]) {
          employee.foto = await global.personalData.compressPhoto(photoInput.files[0]);
        }
        await global.personalData.upsertEmployee(employee);
        await refreshDataset();
        renderSummary();
        applyFilters();
        closeModal();
        setStatus("Mitarbeiter erfolgreich gespeichert.", "success");
      } catch (error) {
        setStatus(error.message || "Mitarbeiter konnte nicht gespeichert werden.", "error");
      }
    });
  }

  async function initListPage() {
    if (!(await ensureAuthenticated())) {
      return;
    }
    await refreshDataset();
    renderSummary();
    applyFilters();
    bindListEvents();
    toggleAuthSections(true);
  }

  async function initDetailPage() {
    if (!(await ensureAuthenticated())) {
      return;
    }
    await refreshDataset();
    state.currentEmployeeId = getEmployeeByUrl();
    if (!state.currentEmployeeId || !getCurrentEmployee()) {
      const newEmployee = global.personalData.createEmptyEmployee();
      await global.personalData.upsertEmployee(newEmployee);
      await refreshDataset();
      state.currentEmployeeId = newEmployee.id;
      history.replaceState({}, "", `./personal-datenblatt.html?id=${encodeURIComponent(newEmployee.id)}`);
    }
    updateDetailLink(state.currentEmployeeId);
    renderDetailPage();
    qs("[data-modal-root]")?.addEventListener("click", (event) => {
      if (event.target.matches("[data-modal-root]") || event.target.closest('[data-action="close-modal"]')) {
        closeModal();
      }
    });
    qs("[data-logout]")?.addEventListener("click", () => {
      global.personalAuth.logout();
      window.location.href = "./personal.html";
    });
    toggleAuthSections(true);
  }

  function init() {
    const page = document.body.dataset.page;
    if (page === "personal-list") {
      initListPage().catch((error) => setStatus(error.message || "Seite konnte nicht geladen werden.", "error"));
    }
    if (page === "personal-datasheet") {
      initDetailPage().catch((error) => setStatus(error.message || "Datenblatt konnte nicht geladen werden.", "error"));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
