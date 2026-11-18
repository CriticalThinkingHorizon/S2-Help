import { el, fetchJSON } from "./utils.js";

const POLL_SLUG = "brick-wall";
const DEVICE_KEY = "s2-brick-wall-device-id";

function createDeviceId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.prototype.map.call(bytes, function (byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
    "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}

function getDeviceId() {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const generated = createDeviceId();
    localStorage.setItem(DEVICE_KEY, generated);
    return generated;
  } catch (error) {
    return createDeviceId();
  }
}

function questionByKey(config, key) {
  return config.questions.find(function (question) {
    return question.key === key;
  });
}

function optionLabel(question, key) {
  const option = question.options.find(function (item) {
    return item.key === key;
  });
  return option ? option.label : key;
}

function loadSocketIO() {
  return new Promise(function (resolve, reject) {
    if (window.io) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "socket.io/socket.io.js";
    script.onload = function () {
      if (window.io) resolve();
      else reject(new Error("Socket.IO client did not load"));
    };
    script.onerror = function () {
      reject(new Error("Socket.IO client failed to load"));
    };
    document.head.appendChild(script);
  });
}

function renderOptions(container, options, onPick) {
  const wrap = el("div", { class: "options" });
  options.forEach(function (option) {
    const button = el("button", { class: "option-btn", type: "button" }, [option.label]);
    button.addEventListener("click", function () {
      onPick(option.key);
    });
    wrap.appendChild(button);
  });
  container.appendChild(wrap);
}

function renderBack(container, label, onClick) {
  const row = el("div", { class: "nav-row" });
  const button = el("button", { class: "btn-secondary", type: "button" }, [label]);
  button.addEventListener("click", onClick);
  row.appendChild(button);
  container.appendChild(row);
}

function renderAnswerSummary(answers, config) {
  const brickedQuestion = questionByKey(config, "bricked");
  const entrypointQuestion = questionByKey(config, "entrypoint");
  const successQuestion = questionByKey(config, "success");
  const list = el("ul", { class: "result-list" });

  list.appendChild(el("li", {}, [
    brickedQuestion.prompt + " " + optionLabel(brickedQuestion, answers.bricked)
  ]));

  if (answers.entrypoint) {
    list.appendChild(el("li", {}, [
      entrypointQuestion.prompt + " " + optionLabel(entrypointQuestion, answers.entrypoint)
    ]));
  }
  if (answers.success) {
    list.appendChild(el("li", {}, [
      successQuestion.prompt + " " + optionLabel(successQuestion, answers.success)
    ]));
  }

  return list;
}

export async function initBrickWall() {
  const root = document.getElementById("brickwall-content");
  if (!root) return;

  let config;
  try {
    config = await fetchJSON("data/polls/brick-wall.json");
  } catch (error) {
    root.appendChild(el("p", { class: "brickwall-error" }, [
      "The brick wall is temporarily unavailable."
    ]));
    return;
  }

  const deviceId = getDeviceId();
  const state = {
    socket: null,
    connection: "connecting",
    stats: null,
    report: null,
    step: "bricked",
    bricked: null,
    entrypoint: null,
    success: null,
    submitting: false,
    error: null
  };

  const intro = el("div", { class: "brickwall-intro" });
  intro.appendChild(el("p", { class: "kaihen-intro" }, [config.description]));
  intro.appendChild(el("p", { class: "brickwall-privacy" }, [config.privacy]));
  root.appendChild(intro);

  const flow = el("div", { class: "brickwall-flow" });
  root.appendChild(flow);

  const statsPanel = el("div", { class: "brickwall-stats-panel" });
  root.appendChild(statsPanel);

  function renderStats() {
    statsPanel.innerHTML = "";
    const stats = state.stats;
    if (!stats) {
      statsPanel.appendChild(el("p", { class: "brickwall-loading" }, [
        state.error ? "Community stats are temporarily unavailable." : "Loading community stats..."
      ]));
      return;
    }

    const labels = config.labels || {};
    const cards = el("div", { class: "brickwall-stat-grid" });
    [
      { label: labels.bricked || "Bricked consoles", value: stats.bricked },
      { label: labels.success || "FS/kaiHEN working without a brick", value: stats.successWithoutBrick },
      { label: labels.total || "Total reports", value: stats.totalResponses }
    ].forEach(function (item) {
      const card = el("div", { class: "brickwall-stat" });
      card.appendChild(el("span", { class: "brickwall-stat-value" }, [String(item.value)]));
      card.appendChild(el("span", { class: "brickwall-stat-label" }, [item.label]));
      cards.appendChild(card);
    });
    statsPanel.appendChild(cards);

    const breakdown = el("div", { class: "brickwall-breakdown" });
    breakdown.appendChild(el("h4", {}, [labels.entrypoints || "Bricked by entrypoint"]));
    stats.brickedByEntrypoint.forEach(function (item) {
      const row = el("div", { class: "brickwall-bar-row" });
      const heading = el("div", { class: "brickwall-bar-heading" });
      heading.appendChild(el("span", {}, [item.label]));
      heading.appendChild(el("span", {}, [String(item.count)]));
      row.appendChild(heading);
      const progress = el("progress", { class: "brickwall-bar", max: "100", value: String(stats.bricked > 0 ? Math.round(item.count / stats.bricked * 100) : 0) });
      row.appendChild(progress);
      breakdown.appendChild(row);
    });
    statsPanel.appendChild(breakdown);

    const wallBox = el("div", { class: "brickwall-wall-box" });
    const wallHeading = el("div", { class: "brickwall-wall-heading" });
    wallHeading.appendChild(el("h4", {}, [labels.wall || "The Brick Wall"]));
    wallHeading.appendChild(el("span", {}, [String(stats.bricked) + " bricks"]));
    wallBox.appendChild(wallHeading);

    if (!stats.bricks.length) {
      wallBox.appendChild(el("p", { class: "brickwall-empty" }, [
        labels.wallEmpty || "No bricks yet. Keep it that way."
      ]));
    } else {
      const wall = el("div", { class: "brickwall-wall", role: "img", "aria-label": "Brick wall of reported bricked consoles" });
      stats.bricks.forEach(function (brick) {
        const date = new Date(brick.createdAt);
        const label = brick.entrypointLabel + " — " + (isNaN(date.getTime()) ? brick.createdAt : date.toLocaleDateString());
        wall.appendChild(el("span", {
          class: "brickwall-brick brickwall-brick-" + brick.entrypoint,
          title: label,
          "aria-label": label
        }));
      });
      wallBox.appendChild(wall);
      if (stats.bricked > stats.bricks.length) {
        wallBox.appendChild(el("p", { class: "brickwall-note" }, [
          "Showing the latest " + stats.bricks.length + " of " + stats.bricked + " bricks."
        ]));
      }
    }

    const legend = el("div", { class: "brickwall-legend" });
    stats.brickedByEntrypoint.forEach(function (item) {
      const entry = el("span", { class: "brickwall-legend-item" });
      entry.appendChild(el("span", { class: "brickwall-swatch brickwall-brick-" + item.key }));
      entry.appendChild(document.createTextNode(item.label + " (" + item.count + ")"));
      legend.appendChild(entry);
    });
    wallBox.appendChild(legend);
    statsPanel.appendChild(wallBox);
  }

  function renderConfirm() {
    const box = el("div", { class: "brickwall-confirm" });
    box.appendChild(el("h3", { class: "step-title" }, ["Ready to add your report?"]));
    const answers = { bricked: state.bricked };
    if (state.bricked === "yes") answers.entrypoint = state.entrypoint;
    else answers.success = state.success;
    box.appendChild(renderAnswerSummary(answers, config));

    const actions = el("div", { class: "brickwall-actions" });
    const submitAttrs = { class: "btn-primary", type: "button" };
    if (state.submitting) submitAttrs.disabled = "";
    const submit = el("button", submitAttrs, [
      state.submitting ? "Saving..." : "Submit report"
    ]);
    submit.addEventListener("click", submitReport);
    const back = el("button", { class: "btn-secondary", type: "button" }, ["<< Back"]);
    back.addEventListener("click", function () {
      state.step = state.bricked === "yes" ? "entrypoint" : "success";
      state.submitting = false;
      renderFlow();
    });
    actions.appendChild(submit);
    actions.appendChild(back);
    box.appendChild(actions);
    flow.appendChild(box);
  }

  function renderReport() {
    const box = el("div", { class: "result-box result-success" });
    box.appendChild(el("p", { class: "result-title" }, [
      el("span", { class: "badge badge-success" }, ["SAVED"]),
      " " + (config.labels.submitted || "Report saved")
    ]));
    box.appendChild(renderAnswerSummary(state.report.answers, config));
    box.appendChild(el("p", { class: "brickwall-note" }, [
      "You can undo this report at any time and remove your brick from the wall."
    ]));
    const actions = el("div", { class: "brickwall-actions" });
    const undo = el("button", { class: "btn-danger", type: "button" }, [
      config.labels.undo || "Undo and remove my brick"
    ]);
    undo.addEventListener("click", undoReport);
    actions.appendChild(undo);
    box.appendChild(actions);
    flow.appendChild(box);
  }

  function renderFlow() {
    flow.innerHTML = "";

    if (state.error) {
      flow.appendChild(el("p", { class: "brickwall-error" }, [state.error]));
      if (state.connection !== "ready") {
        renderBack(flow, "<< Retry", connect);
        return;
      }
    }

    if (state.connection === "connecting") {
      flow.appendChild(el("p", { class: "brickwall-loading" }, ["Connecting to the reporting service..."]));
      return;
    }

    if (state.report) {
      renderReport();
      return;
    }

    if (state.submitting) {
      flow.appendChild(el("p", { class: "brickwall-loading" }, ["Saving your report..."]));
      return;
    }

    if (state.step === "confirm") {
      renderConfirm();
      return;
    }

    const brickedQuestion = questionByKey(config, "bricked");
    const entrypointQuestion = questionByKey(config, "entrypoint");
    const successQuestion = questionByKey(config, "success");

    if (state.step === "bricked") {
      flow.appendChild(el("h3", { class: "step-title" }, [brickedQuestion.prompt]));
      renderOptions(flow, brickedQuestion.options, function (value) {
        state.error = null;
        state.bricked = value;
        state.entrypoint = null;
        state.success = null;
        state.step = value === "yes" ? "entrypoint" : "success";
        renderFlow();
      });
      return;
    }

    if (state.step === "entrypoint") {
      flow.appendChild(el("h3", { class: "step-title" }, [entrypointQuestion.prompt]));
      renderOptions(flow, entrypointQuestion.options, function (value) {
        state.error = null;
        state.entrypoint = value;
        state.step = "confirm";
        renderFlow();
      });
      renderBack(flow, "<< Back", function () {
        state.error = null;
        state.step = "bricked";
        renderFlow();
      });
      return;
    }

    flow.appendChild(el("h3", { class: "step-title" }, [successQuestion.prompt]));
    renderOptions(flow, successQuestion.options, function (value) {
      state.error = null;
      state.success = value;
      state.step = "confirm";
      renderFlow();
    });
    renderBack(flow, "<< Back", function () {
      state.error = null;
      state.step = "bricked";
      renderFlow();
    });
  }

  function submitReport() {
    if (!state.socket || !state.socket.connected || state.submitting) return;
    const answers = { bricked: state.bricked };
    if (state.bricked === "yes") answers.entrypoint = state.entrypoint;
    else answers.success = state.success;

    state.submitting = true;
    state.error = null;
    renderFlow();

    state.socket.emit("poll:submit", { slug: POLL_SLUG, deviceId: deviceId, answers: answers }, function (response) {
      state.submitting = false;
      if (!response || !response.ok) {
        state.error = response && response.error ? response.error : "Could not save your report.";
        renderFlow();
        return;
      }
      state.report = response.report;
      if (response.stats) state.stats = response.stats;
      state.step = "bricked";
      renderFlow();
      renderStats();
    });
  }

  function undoReport() {
    if (!state.socket || !state.socket.connected) return;
    state.socket.emit("poll:undo", { slug: POLL_SLUG, deviceId: deviceId }, function (response) {
      if (!response || !response.ok) {
        state.error = response && response.error ? response.error : "Could not undo your report.";
        renderFlow();
        return;
      }
      state.report = null;
      state.bricked = null;
      state.entrypoint = null;
      state.success = null;
      state.step = "bricked";
      state.error = null;
      if (response.stats) state.stats = response.stats;
      renderFlow();
      renderStats();
    });
  }

  async function connect() {
    if (state.socket) {
      state.socket.disconnect();
      state.socket = null;
    }
    state.connection = "connecting";
    state.error = null;
    renderFlow();

    try {
      const sessionResponse = await fetch("poll-session", {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!sessionResponse.ok) throw new Error("Session unavailable");
      const session = await sessionResponse.json();
      await loadSocketIO();

      const socket = window.io("/polls", {
        transports: ["websocket", "polling"],
        auth: { csrfToken: session.csrfToken }
      });
      state.socket = socket;

      socket.on("connect", function () {
        socket.emit("poll:status", { slug: POLL_SLUG, deviceId: deviceId }, function (response) {
          if (!response || !response.ok) {
            state.connection = "error";
            state.error = response && response.error ? response.error : "Reporting is temporarily unavailable.";
            renderFlow();
            renderStats();
            return;
          }
          state.report = response.report;
          state.stats = response.stats;
          state.connection = "ready";
          state.error = null;
          renderFlow();
          renderStats();
        });
      });

      socket.on("poll:stats", function (payload) {
        if (!payload || payload.slug !== POLL_SLUG) return;
        state.stats = payload.stats;
        renderStats();
      });

      socket.on("connect_error", function () {
        state.connection = "error";
        state.error = "Reporting is temporarily unavailable.";
        renderFlow();
        renderStats();
      });

      socket.on("disconnect", function () {
        if (state.report) return;
        state.connection = "error";
        state.error = "Connection lost. Retry to report or undo.";
        renderFlow();
        renderStats();
      });
    } catch (error) {
      state.connection = "error";
      state.error = "Reporting is temporarily unavailable.";
      renderFlow();
      renderStats();
    }
  }

  try {
    const statsResponse = await fetch("polls/" + POLL_SLUG + "/stats", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (statsResponse.ok) {
      state.stats = await statsResponse.json();
      renderStats();
    }
  } catch (error) {
    /* Socket status will retry the stats load. */
  }

  renderFlow();
  renderStats();
  connect();
}
