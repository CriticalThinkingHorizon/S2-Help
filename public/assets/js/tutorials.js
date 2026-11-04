import { el, fetchJSON } from "./utils.js";

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
}
