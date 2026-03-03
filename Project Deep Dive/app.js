(() => {
  "use strict";

  const REQUIRED_HEADERS = [
    "Name",
    "Council",
    "Ward",
    "Headline",
    "Description",
    "DatePublished",
    "Url",
    "MediaOutlet",
    "Descriptor"
  ];

  const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const state = {
    stories: [],
    skippedRows: 0,
    filters: {
      name: "",
      ward: "",
      council: ""
    }
  };

  const elements = {
    summary: document.getElementById("results-summary"),
    stories: document.getElementById("stories"),
    errorBanner: document.getElementById("error-banner"),
    nameFilter: document.getElementById("name-filter"),
    wardFilter: document.getElementById("ward-filter"),
    councilFilter: document.getElementById("council-filter"),
    clearFilters: document.getElementById("clear-filters"),
    cardTemplate: document.getElementById("story-card-template")
  };

  async function init() {
    bindEvents();

    try {
      const response = await fetch("data/stories.csv", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const csvText = await response.text();
      const rawRows = parseCsv(csvText);
      validateHeaders(rawRows.headers);

      const stories = [];
      let skipped = 0;

      rawRows.rows.forEach((raw, index) => {
        if (raw.__malformed) {
          skipped += 1;
          return;
        }

        const story = normalizeRow(raw, index);
        if (!story) {
          skipped += 1;
          return;
        }

        stories.push(story);
      });

      state.stories = stories;
      state.skippedRows = skipped;

      if (skipped > 0) {
        console.warn(`Skipped ${skipped} malformed row(s).`);
      }

      render();
    } catch (error) {
      console.error("Dataset load failure", error);
      showError("Could not load dataset.");
      updateSummary(0, true);
    }
  }

  function bindEvents() {
    const onFilterInput = () => {
      state.filters.name = elements.nameFilter.value.trim();
      state.filters.ward = elements.wardFilter.value.trim();
      state.filters.council = elements.councilFilter.value.trim();
      render();
    };

    elements.nameFilter.addEventListener("input", onFilterInput);
    elements.wardFilter.addEventListener("input", onFilterInput);
    elements.councilFilter.addEventListener("input", onFilterInput);

    elements.clearFilters.addEventListener("click", () => {
      elements.nameFilter.value = "";
      elements.wardFilter.value = "";
      elements.councilFilter.value = "";

      state.filters.name = "";
      state.filters.ward = "";
      state.filters.council = "";

      render();
      elements.nameFilter.focus();
    });
  }

  function parseCsv(text) {
    const rows = [];
    const records = [];

    let current = "";
    let record = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        record.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          i += 1;
        }

        record.push(current);
        current = "";

        if (!(record.length === 1 && record[0].trim() === "")) {
          records.push(record);
        }

        record = [];
      } else {
        current += char;
      }
    }

    if (current.length > 0 || record.length > 0) {
      record.push(current);
      if (!(record.length === 1 && record[0].trim() === "")) {
        records.push(record);
      }
    }

    if (records.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = records[0].map((header) => header.trim());

    for (let i = 1; i < records.length; i += 1) {
      const values = records[i];
      const malformed = values.length !== headers.length;
      const row = {};

      headers.forEach((header, index) => {
        row[header] = (values[index] || "").trim();
      });

      row.__malformed = malformed;
      rows.push(row);
    }

    return { headers, rows };
  }

  function validateHeaders(headers) {
    const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(", ")}`);
    }
  }

  function normalizeRow(raw, index) {
    if (!raw.Name && !raw.Council && !raw.Ward && !raw.Headline) {
      return null;
    }

    return {
      index,
      name: raw.Name || "Name unavailable",
      council: raw.Council || "Council unavailable",
      ward: raw.Ward || "Ward unavailable",
      headline: raw.Headline || "Headline unavailable",
      description: raw.Description || "Description unavailable",
      dateRaw: raw.DatePublished || "",
      dateParsed: parseDate(raw.DatePublished, new Date()),
      url: raw.Url || "",
      mediaOutlet: raw.MediaOutlet || "",
      descriptor: raw.Descriptor || "Descriptor unavailable"
    };
  }

  function parseDate(dateString, now = new Date()) {
    if (!dateString) {
      return null;
    }

    const value = dateString.trim();
    if (!value || value === "########") {
      return null;
    }

    const relativeMatch = value.match(/^(\d+)\s+days?\s+ago$/i);
    if (relativeMatch) {
      const days = Number(relativeMatch[1]);
      if (Number.isNaN(days)) {
        return null;
      }
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - days);
      return d;
    }

    const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) {
      const [_, year, month, day] = isoLike;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return isValidDate(date) ? date : null;
    }

    const dmyShort = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (dmyShort) {
      const day = Number(dmyShort[1]);
      const monthToken = dmyShort[2].toLowerCase();
      const yy = Number(dmyShort[3]);
      const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthToken);
      if (monthIndex === -1) {
        return null;
      }
      const fullYear = yy >= 70 ? 1900 + yy : 2000 + yy;
      const date = new Date(fullYear, monthIndex, day);
      return isValidDate(date) ? date : null;
    }

    const parsed = new Date(Date.parse(value));
    return isValidDate(parsed) ? parsed : null;
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function filterStories(stories, filters) {
    const nameNeedle = filters.name.toLowerCase();
    const wardNeedle = filters.ward.toLowerCase();
    const councilNeedle = filters.council.toLowerCase();

    return stories.filter((story) => {
      const nameOk = story.name.toLowerCase().includes(nameNeedle);
      const wardOk = story.ward.toLowerCase().includes(wardNeedle);
      const councilOk = story.council.toLowerCase().includes(councilNeedle);
      return nameOk && wardOk && councilOk;
    });
  }

  function sortStories(stories) {
    return [...stories].sort((a, b) => {
      const aHasDate = a.dateParsed instanceof Date;
      const bHasDate = b.dateParsed instanceof Date;

      if (aHasDate && bHasDate) {
        const delta = b.dateParsed.getTime() - a.dateParsed.getTime();
        if (delta !== 0) {
          return delta;
        }
      } else if (aHasDate !== bHasDate) {
        return aHasDate ? -1 : 1;
      }

      return a.index - b.index;
    });
  }

  function renderStories(stories) {
    elements.stories.innerHTML = "";

    if (stories.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No stories match these filters.";
      elements.stories.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    stories.forEach((story) => {
      const clone = elements.cardTemplate.content.cloneNode(true);

      const titleNode = clone.querySelector(".story-title");
      const descriptionNode = clone.querySelector(".story-description");
      const nameNode = clone.querySelector(".meta-name");
      const wardNode = clone.querySelector(".meta-ward");
      const councilNode = clone.querySelector(".meta-council");
      const dateNode = clone.querySelector(".story-date");
      const descriptorNode = clone.querySelector(".story-descriptor");
      const sourceNode = clone.querySelector(".story-source");

      if (isHttpUrl(story.url)) {
        const link = document.createElement("a");
        link.href = story.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = story.headline;
        titleNode.appendChild(link);

        const sourceLink = document.createElement("a");
        sourceLink.href = story.url;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = "Read source";
        sourceNode.appendChild(sourceLink);
      } else {
        titleNode.textContent = story.headline;
        sourceNode.textContent = "Source unavailable";
      }

      descriptionNode.textContent = story.description;
      nameNode.textContent = story.name;
      wardNode.textContent = story.ward;
      councilNode.textContent = story.council;
      descriptorNode.textContent = story.descriptor;
      dateNode.textContent = `Published: ${formatDate(story.dateParsed)}`;

      fragment.appendChild(clone);
    });

    elements.stories.appendChild(fragment);
  }

  function isHttpUrl(url) {
    return /^https?:\/\//i.test(url.trim());
  }

  function formatDate(date) {
    if (!(date instanceof Date)) {
      return "Date unavailable";
    }

    return DATE_FORMATTER.format(date);
  }

  function updateSummary(count, hasError = false) {
    if (hasError) {
      elements.summary.textContent = "0 stories shown.";
      return;
    }

    const skippedText = state.skippedRows > 0 ? ` ${state.skippedRows} malformed row(s) skipped.` : "";
    elements.summary.textContent = `${count} stor${count === 1 ? "y" : "ies"} shown.${skippedText}`;
  }

  function showError(message) {
    elements.errorBanner.textContent = message;
    elements.errorBanner.hidden = false;
  }

  function clearError() {
    elements.errorBanner.hidden = true;
    elements.errorBanner.textContent = "";
  }

  function render() {
    clearError();
    const filtered = filterStories(state.stories, state.filters);
    const sorted = sortStories(filtered);
    renderStories(sorted);
    updateSummary(sorted.length);
  }

  window.parseCsv = parseCsv;
  window.normalizeRow = normalizeRow;
  window.parseDate = parseDate;
  window.filterStories = filterStories;
  window.sortStories = sortStories;
  window.renderStories = renderStories;

  init();
})();
