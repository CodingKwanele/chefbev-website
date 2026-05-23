// public/js/gallery.js
(() => {
  const tabs = document.querySelectorAll(".tab[data-cat]");
  const cards = document.querySelectorAll(".gcard");
  const search = document.getElementById("gallerySearch");
  const empty = document.getElementById("galleryEmpty");
  const count = document.getElementById("galleryCount");

  const modal = document.getElementById("galleryModal");
  const modalImg = document.getElementById("modalImg");
  const modalTitle = document.getElementById("modalTitle");
  const modalOrderBtn = document.getElementById("modalOrderBtn");

  let activeCat = document.querySelector(".tab.is-active")?.dataset.cat || "all";
  let lastFocusedElement = null;

  function setUrl(cat) {
    const url = new URL(window.location.href);
    url.searchParams.set("cat", cat);
    window.history.replaceState({}, "", url);
  }

  function applyFilters() {
    const q = (search?.value || "").trim().toLowerCase();
    let shown = 0;

    cards.forEach((card) => {
      const cat = card.dataset.cat;
      const title = card.dataset.title || "";

      const catOk = activeCat === "all" ? true : cat === activeCat;
      const qOk = q.length === 0 ? true : title.includes(q);

      const visible = catOk && qOk;
      card.style.display = visible ? "" : "none";
      if (visible) shown += 1;
    });

    if (empty) {
      empty.hidden = shown !== 0;
    }

    if (count) {
      count.textContent = `${shown} design${shown === 1 ? "" : "s"} shown`;
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      activeCat = tab.dataset.cat || "all";

      setUrl(activeCat);
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener("input", applyFilters);
  }

  // Quick view modal
  document.querySelectorAll(".gcard__preview, .gcard__preview-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      lastFocusedElement = btn;

      const img = btn.dataset.img;
      const title = btn.dataset.title;

      modalImg.src = img;
      modalImg.alt = title ? `${title} cake preview` : "Cake preview";
      modalTitle.textContent = title || "Cake preview";
      modalOrderBtn.href = `/orders?style=${encodeURIComponent(title || "")}&img=${encodeURIComponent(img || "")}`;

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      // Focus the modal panel for accessibility
      const modalPanel = modal.querySelector(".modal__panel");
      if (modalPanel) {
        modalPanel.focus();
      }
    });
  });

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    // Restore focus to the button that opened the modal
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // Close modal on backdrop/button click
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "true") {
        closeModal();
      }
    });

    // Keyboard support for backdrop
    modal.addEventListener("keydown", (e) => {
      const isBackdrop = e.target?.dataset?.close === "true";
      if (isBackdrop && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  // Global escape key handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      closeModal();
    }
  });

  // Initial filter application
  applyFilters();
})();
