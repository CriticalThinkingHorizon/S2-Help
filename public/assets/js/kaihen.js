import { el, fetchJSON, buildResourceIndex, resolveResourceRef } from "./utils.js";

function renderOptions(container, options, onPick) {
  const wrap = el("div", { class: "options" });
  options.forEach(function (option) {
    const button = el("button", { class: "option-btn", type: "button" }, [option.label]);
    button.addEventListener("click", function () {
      onPick(option.value);
    });
    wrap.appendChild(button);
  });
  container.appendChild(wrap);
}

function renderResources(container, ids, resourceIndex) {
  const links = (ids || [])
    .map(function (id) {
      return resolveResourceRef(id, resourceIndex);
    })
    .filter(Boolean);
  if (!links.length) return;

  const box = el("div", { class: "related-resources" });
  box.appendChild(el("p", { class: "related-label" }, ["Resources"]));
  links.forEach(function (link) {
    const anchor = el("a", {
      class: "related-link",
      href: link.url,
      target: "_blank",
      rel: "noopener noreferrer"
    });
    anchor.appendChild(el("span", { class: "related-title" }, [link.title]));
    anchor.appendChild(el("span", { class: "related-url" }, [link.url]));
    if (link.notes) {
      anchor.appendChild(el("span", { class: "related-notes" }, [link.notes]));
    }
    box.appendChild(anchor);
  });
  container.appendChild(box);
}

function renderBack(container, label, onClick) {
  const row = el("div", { class: "nav-row" });
  const button = el("button", { class: "btn-secondary", type: "button" }, [label]);
  button.addEventListener("click", onClick);
  row.appendChild(button);
  container.appendChild(row);
}

function renderIntro(root, data, resourceIndex) {
  const info = el("div", { class: "kaihen-info" });

  info.appendChild(el("p", { class: "kaihen-intro" }, [data.intro]));

  info.appendChild(el("h3", { class: "kaihen-heading" }, ["What can you do with it?"]));
  const list = el("ul", { class: "result-list" });
  data.possibilities.forEach(function (item) {
    list.appendChild(el("li", {}, [item]));
  });
  info.appendChild(list);

  const warning = el("div", { class: "payload-status status-none" });
  warning.appendChild(el("span", { class: "status-label" }, ["Warning"]));
  warning.appendChild(el("span", {}, [data.warning]));
  info.appendChild(warning);

  renderResources(info, data.resources, resourceIndex);

  root.appendChild(info);
}

export async function initKaihen() {
  const [data, resourceGroups] = await Promise.all([
    fetchJSON("data/kaihen.json"),
    fetchJSON("data/resources.json")
  ]);
  const resourceIndex = buildResourceIndex(resourceGroups);
  const root = document.getElementById("kaihen-content");
  if (!root) return;

  renderIntro(root, data, resourceIndex);

  const flow = el("div", { class: "kaihen-flow" });
  root.appendChild(flow);

  const state = {
    step: "precheck",
    entrypoint: null
  };

  function renderFlow() {
    flow.innerHTML = "";

    if (state.step === "precheck") {
      flow.appendChild(el("h3", { class: "step-title" }, [data.precheckQuestion]));
      flow.appendChild(el("div", { class: "footnote" }, [data.precheckHint]));
      renderOptions(flow, [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" }
      ], function (value) {
        if (value === "yes") {
          state.step = "entrypoint";
        } else {
          state.step = "blocked";
        }
        renderFlow();
      });
      return;
    }

    if (state.step === "entrypoint") {
      flow.appendChild(el("h3", { class: "step-title" }, [data.entrypointQuestion]));
      flow.appendChild(el("div", { class: "footnote" }, [data.entrypointHint]));

      const options = data.entrypoints.map(function (entrypoint) {
        return { label: entrypoint.label, value: entrypoint.id };
      });
      options.push({ label: data.none.label, value: "none" });

      renderOptions(flow, options, function (value) {
        state.entrypoint = value;
        state.step = "result";
        renderFlow();
      });

      renderBack(flow, "<< Back", function () {
        state.step = "precheck";
        renderFlow();
      });
      return;
    }

    if (state.step === "blocked") {
      const box = el("div", { class: "result-box result-blocked" });
      box.appendChild(el("p", { class: "result-title" }, [
        el("span", { class: "badge badge-blocked" }, ["NOT YET"]),
        " " + data.blocked.title
      ]));
      box.appendChild(el("p", {}, [data.blocked.text]));
      renderResources(box, data.blocked.resources, resourceIndex);
      renderBack(box, "<< Start over", function () {
        state.step = "precheck";
        renderFlow();
      });
      flow.appendChild(box);
      return;
    }

    const entrypoint = data.entrypoints.find(function (item) {
      return item.id === state.entrypoint;
    });
    if (!entrypoint) {
      const none = data.none;
      const box = el("div", { class: "result-box result-blocked" });
      box.appendChild(el("p", { class: "result-title" }, [
        el("span", { class: "badge badge-blocked" }, ["NOT YET"]),
        " " + none.title
      ]));
      box.appendChild(el("p", {}, [none.text]));
      renderResources(box, none.resources, resourceIndex);
      renderBack(box, "<< Start over", function () {
        state.step = "precheck";
        renderFlow();
      });
      flow.appendChild(box);
      return;
    }

    const box = el("div", { class: "result-box result-success" });
    box.appendChild(el("p", { class: "result-title" }, [
      el("span", { class: "badge badge-success" }, ["READY"]),
      " " + entrypoint.title
    ]));
    box.appendChild(el("p", {}, [entrypoint.summary]));
    renderResources(box, entrypoint.resources, resourceIndex);
    renderBack(box, "<< Start over", function () {
      state.step = "precheck";
      state.entrypoint = null;
      renderFlow();
    });
    flow.appendChild(box);
  }

  renderFlow();
}
