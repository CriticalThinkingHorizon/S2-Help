import { el, slugify, setHash, copyToClipboard, fetchJSON } from "./utils.js";

function setupFaqAccordion(faqList, onOpen) {
  const items = Array.prototype.slice.call(faqList.querySelectorAll("details.faq-item"));

  function animateOpen(details, content) {
    details.setAttribute("open", "");
    details.dataset.animating = "true";
    const endHeight = content.scrollHeight;
    content.style.overflow = "hidden";
    const anim = content.animate(
      [
        { height: "0px", opacity: 0 },
        { height: endHeight + "px", opacity: 1 }
      ],
      { duration: 280, easing: "ease-out" }
    );
    anim.onfinish = function () {
      content.style.overflow = "";
      content.style.height = "";
      delete details.dataset.animating;
    };
  }

  function animateClose(details, content) {
    details.dataset.animating = "true";
    const startHeight = content.scrollHeight;
    content.style.overflow = "hidden";
    const anim = content.animate(
      [
        { height: startHeight + "px", opacity: 1 },
        { height: "0px", opacity: 0 }
      ],
      { duration: 220, easing: "ease-in" }
    );
    anim.onfinish = function () {
      details.removeAttribute("open");
      content.style.overflow = "";
      content.style.height = "";
      delete details.dataset.animating;
    };
  }

  function openItem(details) {
    if (details.hasAttribute("open") || details.dataset.animating) return;
    const content = details.querySelector(".faq-content");
    items.forEach(function (other) {
      if (other !== details && other.hasAttribute("open") && !other.dataset.animating) {
        animateClose(other, other.querySelector(".faq-content"));
      }
    });
    animateOpen(details, content);
    if (details.id) {
      setHash(details.id);
      if (typeof onOpen === "function") onOpen(details.id);
    }
  }

  items.forEach(function (details) {
    const summary = details.querySelector("summary");
    const content = details.querySelector(".faq-content");

    summary.addEventListener("click", function (event) {
      event.preventDefault();
      if (details.dataset.animating) return;

      if (details.hasAttribute("open")) {
        animateClose(details, content);
        setHash("faq");
        return;
      }

      openItem(details);
    });

    const linkBtn = details.querySelector(".faq-permalink");
    if (linkBtn) {
      const defaultGlyph = linkBtn.textContent;
      linkBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openItem(details);
        const url = location.origin + location.pathname + "#" + details.id;
        copyToClipboard(url);
        linkBtn.classList.add("copied");
        linkBtn.textContent = "\u2713";
        linkBtn.setAttribute("title", "Link copied!");
        clearTimeout(linkBtn._copyTimer);
        linkBtn._copyTimer = setTimeout(function () {
          linkBtn.classList.remove("copied");
          linkBtn.textContent = defaultGlyph;
          linkBtn.setAttribute("title", "Copy direct link to this question");
        }, 1400);
      });
    }
  });

  return {
    openById(id) {
      const details = document.getElementById(id);
      if (details) openItem(details);
    }
  };
}

export async function initFaq({ onOpen }) {
  const faqData = await fetchJSON("data/faq.json");
  const faqList = document.getElementById("faq-list");
  const usedFaqIds = {};

  faqData.forEach(function (item) {
    const baseId = item.id || "faq-" + slugify(item.q);
    let id = baseId;
    let n = 2;
    while (usedFaqIds[id]) {
      id = baseId + "-" + n;
      n++;
    }
    usedFaqIds[id] = true;

    const details = el("details", { class: "faq-item", id: id });
    const qText = el("span", { class: "faq-q" }, [item.q]);
    const linkBtn = el("button", {
      class: "faq-permalink",
      type: "button",
      "aria-label": "Copy direct link to this question",
      title: "Copy direct link to this question"
    }, ["\uD83D\uDD17"]);
    const summary = el("summary", {}, [qText, linkBtn]);
    const content = el("div", { class: "faq-content" });
    const blocks = Array.isArray(item.a) ? item.a : [item.a];
    blocks.forEach(function (block) {
      content.appendChild(el("p", { html: block }));
    });
    details.appendChild(summary);
    details.appendChild(content);

    const plainAnswer = blocks.join(" ").replace(/<[^>]*>/g, " ");
    details.dataset.searchText = (item.q + " " + plainAnswer).toLowerCase();
    faqList.appendChild(details);
  });

  const accordion = setupFaqAccordion(faqList, onOpen);

  const faqSearchInput = document.getElementById("faq-search-input");
  const faqSearchClear = document.getElementById("faq-search-clear");
  const faqEmpty = document.getElementById("faq-empty");
  const faqSortNote = document.getElementById("faq-sort-note");

  function applyFaqSearch() {
    const query = faqSearchInput.value.trim().toLowerCase();
    faqSearchClear.classList.toggle("visible", query.length > 0);
    const items = Array.prototype.slice.call(faqList.querySelectorAll("details.faq-item"));
    let visibleCount = 0;
    items.forEach(function (details) {
      const matches = !query || (details.dataset.searchText || "").indexOf(query) !== -1;
      details.hidden = !matches;
      if (matches) visibleCount++;
    });
    if (faqEmpty) faqEmpty.hidden = visibleCount > 0;
  }

  if (faqSearchInput) {
    faqSearchInput.addEventListener("input", applyFaqSearch);
    faqSearchClear.addEventListener("click", function () {
      faqSearchInput.value = "";
      applyFaqSearch();
      faqSearchInput.focus();
    });
  }

  function reorderByPopularity(stats) {
    const items = Array.prototype.slice.call(faqList.querySelectorAll("details.faq-item"));
    items.sort(function (a, b) {
      const countA = stats[a.id] || 0;
      const countB = stats[b.id] || 0;
      return countB - countA;
    });
    items.forEach(function (details) {
      faqList.appendChild(details);
    });
    if (faqSortNote) faqSortNote.hidden = false;
  }

  function clearSearch() {
    if (faqSearchInput && faqSearchInput.value) {
      faqSearchInput.value = "";
      applyFaqSearch();
    }
  }

  return {
    openById: accordion.openById,
    reorderByPopularity,
    clearSearch
  };
}
