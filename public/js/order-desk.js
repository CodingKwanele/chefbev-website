const filterButtons = document.querySelectorAll("[data-filter-type]");
const clearButton = document.querySelector("[data-clear-desk-filter]");
const filterSummary = document.querySelector("[data-filter-summary]");
const filterResults = document.querySelector("[data-filter-results]");
const filterCount = document.querySelector("[data-filter-count]");
const filterEmpty = document.querySelector("[data-filter-empty]");
const defaultSections = document.querySelectorAll("[data-default-section]");
const records = document.querySelectorAll(".desk-filter-record");

function setSummary(text) {
  if (!filterSummary) return;
  filterSummary.hidden = !text;
  filterSummary.textContent = text || "";
}

function clearActiveButtons() {
  filterButtons.forEach((button) => {
    button.classList.remove("is-active");
    button.removeAttribute("aria-pressed");
  });
}

function showAllRecords() {
  records.forEach((record) => {
    record.hidden = true;
  });
  defaultSections.forEach((section) => {
    section.hidden = false;
  });
  if (filterResults) filterResults.hidden = true;
  if (filterEmpty) filterEmpty.hidden = true;
  if (filterCount) filterCount.textContent = "0 shown";
  clearActiveButtons();
  setSummary("");
  if (clearButton) clearButton.hidden = true;
}

function recordMatches(record, type, value) {
  if (type === "status") return record.dataset.recordStatus === value;
  if (type === "date") return record.dataset.recordDate === value;
  if (type === "email") return record.dataset.recordEmail === value;
  if (type === "scope" && value === "upcoming") return record.dataset.recordUpcoming === "true";
  if (type === "scope" && value === "active") return record.dataset.recordActive === "true";
  return true;
}

function applyFilter(type, value, label, activeButton) {
  let shown = 0;

  records.forEach((record) => {
    const matches = recordMatches(record, type, value);
    record.hidden = !matches;
    if (matches) shown += 1;
  });

  defaultSections.forEach((section) => {
    section.hidden = true;
  });
  if (filterResults) filterResults.hidden = false;
  if (filterEmpty) filterEmpty.hidden = shown > 0;
  if (filterCount) filterCount.textContent = `${shown} shown`;
  clearActiveButtons();
  activeButton.classList.add("is-active");
  activeButton.setAttribute("aria-pressed", "true");
  setSummary(`${shown} item${shown === 1 ? "" : "s"} shown for ${label}`);
  if (clearButton) clearButton.hidden = false;
  filterResults?.scrollIntoView({ behavior: "smooth", block: "start" });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyFilter(
      button.dataset.filterType,
      button.dataset.filterValue,
      button.dataset.filterLabel || button.textContent.trim().replace(/\s+/g, " "),
      button
    );
  });
});

clearButton?.addEventListener("click", showAllRecords);
