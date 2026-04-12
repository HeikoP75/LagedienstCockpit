(function attachPersonalData(global) {
  const STORAGE_KEY = "personal";
  const CACHE_KEY = "personal.cache";
  const IMAGE_SIZE = 200;
  const IMAGE_QUALITY = 0.8;

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createEmptyEmployee() {
    const createdAt = nowIso();
    return {
      id: createId("mitarbeiter"),
      foto: "",
      stammdaten: {
        vorname: "",
        nachname: "",
        geburtsdatum: "",
        geburtsort: "",
        familienstand: "",
        kinder: [],
        notfallkontakt1: "",
        notfallkontakt2: "",
        funktion: "",
        dienstgrad: "",
        schicht: "",
        eintrittUnternehmen: "",
        eintrittFeuerwehr: "",
        beschaeftigungsart: "",
        diensttelefon: "",
        privattelefon: "",
        email: ""
      },
      feuerwehr: {
        atemschutztauglich: "",
        maschinistStatus: "",
        rtwQualifikation: ""
      },
      eintraege: [],
      eigeneFelder: [],
      meta: {
        erstelltAm: createdAt,
        geaendertAm: createdAt
      }
    };
  }

  function createDefaultDataset() {
    return {
      version: 1,
      exportedAt: "",
      mitarbeiter: []
    };
  }

  function normalizeEmployee(employee = {}) {
    const base = createEmptyEmployee();
    const merged = {
      ...base,
      ...employee,
      stammdaten: {
        ...base.stammdaten,
        ...(employee.stammdaten || {})
      },
      feuerwehr: {
        ...base.feuerwehr,
        ...(employee.feuerwehr || {})
      },
      eintraege: Array.isArray(employee.eintraege)
        ? employee.eintraege
            .map((entry) => ({
              id: entry.id || createId("eintrag"),
              kategorie: entry.kategorie || "",
              datum: entry.datum || "",
              titel: entry.titel || "",
              inhalt: entry.inhalt || "",
              tags: Array.isArray(entry.tags) ? entry.tags : [],
              erstelltAm: entry.erstelltAm || nowIso()
            }))
            .sort((left, right) => new Date(right.datum || right.erstelltAm) - new Date(left.datum || left.erstelltAm))
        : [],
      eigeneFelder: Array.isArray(employee.eigeneFelder)
        ? employee.eigeneFelder.map((field) => ({
            schluessel: field.schluessel || createId("feld"),
            label: field.label || "",
            wert: field.wert || ""
          }))
        : [],
      meta: {
        ...base.meta,
        ...(employee.meta || {})
      }
    };

    if (!Array.isArray(merged.stammdaten.kinder)) {
      merged.stammdaten.kinder = [];
    }

    return merged;
  }

  function normalizeDataset(dataset = {}) {
    const base = createDefaultDataset();
    return {
      ...base,
      ...dataset,
      mitarbeiter: Array.isArray(dataset.mitarbeiter)
        ? dataset.mitarbeiter.map(normalizeEmployee)
        : []
    };
  }

  function cacheDataset(dataset) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataset));
  }

  function readCachedDataset() {
    try {
      return normalizeDataset(JSON.parse(localStorage.getItem(CACHE_KEY) || "null") || createDefaultDataset());
    } catch (error) {
      console.warn("Offline cache could not be parsed.", error);
      return createDefaultDataset();
    }
  }

  async function readRemoteDataset() {
    if (!global.spStorage?.readData) {
      throw new Error("spStorage.readData ist nicht verfuegbar.");
    }
    const remoteData = await global.spStorage.readData(STORAGE_KEY);
    return normalizeDataset(remoteData || createDefaultDataset());
  }

  async function writeRemoteDataset(dataset) {
    if (!global.spStorage?.writeData) {
      throw new Error("spStorage.writeData ist nicht verfuegbar.");
    }
    await global.spStorage.writeData(STORAGE_KEY, dataset);
  }

  async function loadDataset() {
    try {
      const remoteDataset = await readRemoteDataset();
      cacheDataset(remoteDataset);
      return remoteDataset;
    } catch (error) {
      console.warn("SharePoint read failed, using offline cache.", error);
      return readCachedDataset();
    }
  }

  async function saveDataset(dataset) {
    const normalized = normalizeDataset({
      ...dataset,
      exportedAt: nowIso()
    });

    cacheDataset(normalized);
    try {
      await writeRemoteDataset(normalized);
      return { data: normalized, source: "sharepoint" };
    } catch (error) {
      console.warn("SharePoint write failed, offline cache updated.", error);
      return { data: normalized, source: "cache", offline: true, error };
    }
  }

  function updateEmployeeTimestamp(employee) {
    return {
      ...employee,
      meta: {
        ...employee.meta,
        geaendertAm: nowIso(),
        erstelltAm: employee.meta?.erstelltAm || nowIso()
      }
    };
  }

  async function upsertEmployee(employeeInput) {
    const dataset = await loadDataset();
    const normalizedEmployee = updateEmployeeTimestamp(normalizeEmployee(employeeInput));
    const employeeIndex = dataset.mitarbeiter.findIndex((employee) => employee.id === normalizedEmployee.id);

    if (employeeIndex >= 0) {
      dataset.mitarbeiter[employeeIndex] = normalizedEmployee;
    } else {
      dataset.mitarbeiter.unshift(normalizedEmployee);
    }

    return saveDataset(dataset);
  }

  async function deleteEmployee(employeeId) {
    const dataset = await loadDataset();
    dataset.mitarbeiter = dataset.mitarbeiter.filter((employee) => employee.id !== employeeId);
    return saveDataset(dataset);
  }

  async function addEntry(employeeId, entryInput) {
    const dataset = await loadDataset();
    const employee = dataset.mitarbeiter.find((item) => item.id === employeeId);
    if (!employee) {
      throw new Error("Mitarbeiter nicht gefunden.");
    }

    employee.eintraege.unshift({
      id: entryInput.id || createId("eintrag"),
      kategorie: entryInput.kategorie || "",
      datum: entryInput.datum || "",
      titel: entryInput.titel || "",
      inhalt: entryInput.inhalt || "",
      tags: Array.isArray(entryInput.tags) ? entryInput.tags : [],
      erstelltAm: entryInput.erstelltAm || nowIso()
    });
    employee.meta.geaendertAm = nowIso();
    employee.eintraege.sort(
      (left, right) => new Date(right.datum || right.erstelltAm) - new Date(left.datum || left.erstelltAm)
    );

    return saveDataset(dataset);
  }

  async function deleteEntry(employeeId, entryId) {
    const dataset = await loadDataset();
    const employee = dataset.mitarbeiter.find((item) => item.id === employeeId);
    if (!employee) {
      throw new Error("Mitarbeiter nicht gefunden.");
    }
    employee.eintraege = employee.eintraege.filter((entry) => entry.id !== entryId);
    employee.meta.geaendertAm = nowIso();
    return saveDataset(dataset);
  }

  async function updateCustomFields(employeeId, fields) {
    const dataset = await loadDataset();
    const employee = dataset.mitarbeiter.find((item) => item.id === employeeId);
    if (!employee) {
      throw new Error("Mitarbeiter nicht gefunden.");
    }
    employee.eigeneFelder = Array.isArray(fields)
      ? fields.map((field) => ({
          schluessel: field.schluessel || createId("feld"),
          label: field.label || "",
          wert: field.wert || ""
        }))
      : [];
    employee.meta.geaendertAm = nowIso();
    return saveDataset(dataset);
  }

  function getEmployeeById(dataset, employeeId) {
    return dataset.mitarbeiter.find((employee) => employee.id === employeeId) || null;
  }

  function filterEmployees(dataset, term) {
    const searchTerm = (term || "").trim().toLowerCase();
    if (!searchTerm) {
      return dataset.mitarbeiter;
    }

    return dataset.mitarbeiter.filter((employee) => {
      const textChunks = [
        employee.stammdaten.vorname,
        employee.stammdaten.nachname,
        employee.stammdaten.funktion,
        employee.stammdaten.dienstgrad,
        employee.stammdaten.schicht,
        employee.stammdaten.email,
        employee.feuerwehr.atemschutztauglich,
        employee.feuerwehr.maschinistStatus,
        employee.feuerwehr.rtwQualifikation,
        ...employee.eintraege.flatMap((entry) => [entry.kategorie, entry.titel, entry.inhalt, ...(entry.tags || [])]),
        ...employee.eigeneFelder.flatMap((field) => [field.label, field.wert])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return textChunks.includes(searchTerm);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      image.src = src;
    });
  }

  async function compressPhoto(fileOrDataUrl) {
    const source = typeof fileOrDataUrl === "string" ? fileOrDataUrl : await readFileAsDataUrl(fileOrDataUrl);
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas-Kontext konnte nicht erstellt werden.");
    }

    const scale = Math.min(IMAGE_SIZE / image.width, IMAGE_SIZE / image.height, 1);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  }

  global.personalData = {
    STORAGE_KEY,
    CACHE_KEY,
    createDefaultDataset,
    createEmptyEmployee,
    normalizeDataset,
    normalizeEmployee,
    loadDataset,
    saveDataset,
    upsertEmployee,
    deleteEmployee,
    addEntry,
    deleteEntry,
    updateCustomFields,
    getEmployeeById,
    filterEmployees,
    compressPhoto,
    deepClone
  };
})(window);
