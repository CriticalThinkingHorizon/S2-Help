import { el, fetchJSON, setHash } from "./utils.js";

function buildStep(step) {
  const item = el("li", { class: "tutorial-step" });
  item.appendChild(el("div", { class: "tutorial-step-text", html: step.text }));
  if (step.code) {
    const pre = el("pre", { class: "tutorial-code" });
    pre.appendChild(el("code", {}, [step.code]));
    item.appendChild(pre);
  }
  return item;
}

function buildSection(section) {
  const wrapper = el("div", { class: "tutorial-section" });
  if (section.title) {
    wrapper.appendChild(el("h4", { class: "tutorial-section-title" }, [section.title]));
  }
  const list = el("ol", { class: "tutorial-steps" });
  (section.steps || []).forEach(function (step) {
    list.appendChild(buildStep(step));
  });
  wrapper.appendChild(list);
  return wrapper;
}

function setupAccordion(tutorialsList) {
  const items = Array.prototype.slice.call(
    tutorialsList.querySelectorAll("details.tutorial-item")
  );

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
    const content = details.querySelector(".tutorial-body");
    items.forEach(function (other) {
      if (other !== details && other.hasAttribute("open") && !other.dataset.animating) {
        animateClose(other, other.querySelector(".tutorial-body"));
      }
    });
    animateOpen(details, content);
    if (details.id) setHash(details.id);
  }

  items.forEach(function (details) {
    const summary = details.querySelector("summary");
    const content = details.querySelector(".tutorial-body");

    summary.addEventListener("click", function (event) {
      event.preventDefault();
      if (details.dataset.animating) return;

      if (details.hasAttribute("open")) {
        animateClose(details, content);
        setHash("tutorials");
        return;
      }

      openItem(details);
    });
  });

  return {
    openById(id) {
      const details = document.getElementById(id);
      if (details) openItem(details);
    }
  };
}

export async function initTutorials() {
  const tutorials = await fetchJSON("data/tutorials.json");
  const tutorialsList = document.getElementById("tutorials-list");

  tutorials.forEach(function (tutorial) {
    const item = el("details", { class: "tutorial-item", id: tutorial.id });
    const heading = el("span", { class: "tutorial-heading" }, [
      el("span", { class: "tutorial-name" }, [tutorial.title])
    ]);
    if (tutorial.tag) {
      heading.appendChild(el("span", { class: "tutorial-tag" }, [tutorial.tag]));
    }
    item.appendChild(el("summary", { class: "tutorial-summary" }, [heading]));

    const body = el("div", { class: "tutorial-body" });
    if (tutorial.intro) {
      body.appendChild(el("p", { class: "tutorial-intro" }, [tutorial.intro]));
    }

    (tutorial.sections || []).forEach(function (section) {
      body.appendChild(buildSection(section));
    });

    if (tutorial.note) {
      body.appendChild(el("p", { class: "tutorial-note", html: tutorial.note }));
    }

    item.appendChild(body);
    tutorialsList.appendChild(item);
  });

  return setupAccordion(tutorialsList);
}
