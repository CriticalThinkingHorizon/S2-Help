import { el, setHash, fetchJSON, buildResourceIndex, resolveResourceRef } from "./utils.js";
import { showSection } from "./navigation.js";

export async function initQuiz() {
  const [data, gameResources, resourceGroups] = await Promise.all([
    fetchJSON("data/quiz.json"),
    fetchJSON("data/game-resources.json"),
    fetchJSON("data/resources.json")
  ]);
  const resourceIndex = buildResourceIndex(resourceGroups);

  const gameById = new Map(data.games.map(function (game) {
    return [game.id, game];
  }));

  const state = {
    step: "app",
    app: null,
    sub: null
  };
  let quizHistoryActive = false;

  const quizCard = document.getElementById("quiz-card");
  const progressEl = document.getElementById("progress");

  function resetQuiz() {
    state.step = "app";
    state.app = null;
    state.sub = null;
    render();
  }

  function pushQuizHistory() {
    if (quizHistoryActive) return;
    if (window.history && history.pushState) {
      history.pushState({ quizActive: true }, "", location.href);
      quizHistoryActive = true;
    }
  }

  function updateProgress(stepIndex) {
    const spans = progressEl.querySelectorAll("span");
    spans.forEach(function (span, index) {
      span.classList.toggle("active", index <= stepIndex);
    });
  }

  function possibilitiesList() {
    const list = el("ul", { class: "result-list" });
    data.possibilities.forEach(function (possibility) {
      list.appendChild(el("li", {}, [possibility]));
    });
    return list;
  }

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

  function renderBack(container) {
    const row = el("div", { class: "nav-row" });
    const backBtn = el("button", { class: "btn-secondary", type: "button" }, ["<< Start over"]);
    backBtn.addEventListener("click", function () {
      if (quizHistoryActive && window.history && history.back) {
        history.back();
      } else {
        resetQuiz();
      }
    });
    row.appendChild(backBtn);
    container.appendChild(row);
  }

  function renderReminder(container) {
    const box = el("div", { class: "reminder-box" });
    box.appendChild(el("span", {}, ["Don't forget to check our"]));
    const faqBtn = el("button", { class: "link-btn", type: "button" }, ["FAQs"]);
    faqBtn.addEventListener("click", function () {
      showSection("faq");
      setHash("faq");
    });
    const resBtn = el("button", { class: "link-btn", type: "button" }, ["Resources"]);
    resBtn.addEventListener("click", function () {
      showSection("resources");
      setHash("resources");
    });
    box.appendChild(faqBtn);
    box.appendChild(el("span", {}, ["and"]));
    box.appendChild(resBtn);
    container.appendChild(box);
  }

  function renderRelatedResources(container, app) {
    const entries = gameResources[app];
    if (!entries || !entries.length) return;

    const links = entries
      .map(function (entry) {
        return resolveResourceRef(entry, resourceIndex);
      })
      .filter(Boolean);
    if (!links.length) return;

    const box = el("div", { class: "related-resources" });
    box.appendChild(el("p", { class: "related-label" }, ["Related resources"]));
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

  function renderStepApp() {
    updateProgress(0);
    quizCard.innerHTML = "";
    quizCard.appendChild(el("h3", { class: "step-title" }, [data.stepTitle]));

    const options = data.games.map(function (game) {
      return { label: game.optionLabel, value: game.id };
    });

    renderOptions(quizCard, options, function (value) {
      pushQuizHistory();
      state.app = value;
      state.step = "sub";
      render();
    });

    quizCard.appendChild(el("div", { class: "footnote" }, [data.footnote]));
  }

  function renderStepSub() {
    updateProgress(1);
    quizCard.innerHTML = "";

    const game = gameById.get(state.app);

    if (state.app === "none") {
      renderResultBlocked(game.blockedTitle, [game.blockedText]);
      renderReminder(quizCard);
      renderBack(quizCard);
      return;
    }

    quizCard.appendChild(el("h3", { class: "step-title" }, [
      game.label + " — " + game.subQuestion
    ]));

    renderOptions(quizCard, [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" }
    ], function (value) {
      state.sub = value;
      state.step = "result";
      render();
    });

    renderBack(quizCard);
  }

  function renderPayloadStatus(container, game) {
    const info = game.payloadStatus;
    if (!info) return;
    const box = el("div", { class: "payload-status status-" + info.type });
    box.appendChild(el("span", { class: "status-label" }, [info.label || "Payload status"]));
    box.appendChild(el("span", {}, [info.text]));
    container.appendChild(box);
  }

  function renderResultSuccess(game) {
    const box = el("div", { class: "result-box result-success" });
    box.appendChild(el("p", { class: "result-title" }, [
      el("span", { class: "badge badge-success" }, ["READY"]),
      " You are ready to go"
    ]));
    renderPayloadStatus(box, game);
    box.appendChild(el("p", {}, ["You can already:"]));
    box.appendChild(possibilitiesList());
    box.appendChild(el("p", {}, [
      "Those are the only things you can currently do as a normal user without tinkering too much, and a lot of new stuff will be released in the future for you to take advantage of all the possibilities in your console (Probably)."
    ]));
    box.appendChild(el("p", {}, [
      "Just make sure you have a reliable network connection using Ethernet and you'll be there on a few tries."
    ]));
    renderRelatedResources(box, game.id);
    quizCard.appendChild(box);
  }

  function renderResultSuccessWait(game) {
    const box = el("div", { class: "result-box result-wait" });
    box.appendChild(el("p", { class: "result-title" }, [
      el("span", { class: "badge badge-wait" }, ["ALMOST READY"]),
      " Waiting for a payload"
    ]));
    renderPayloadStatus(box, game);
    box.appendChild(el("p", {}, [
      "You are almost ready to go, while is fully possible to run arbitrary code, you still need to wait for an official payload for permission escalation to be released/ported for your game, and do cool things"
    ]));
    box.appendChild(el("p", {}, ["In the future you might be able to:"]));
    box.appendChild(possibilitiesList());
    box.appendChild(el("p", {}, [
      "Those are the only things possible anyway as a normal user without tinkering too much, and a lot of new stuff will be released in the future for you to take advantage of all the possibilities in your console (Probably)."
    ]));
    renderRelatedResources(box, game.id);
    quizCard.appendChild(box);
  }

  function renderResultBlocked(title, paragraphs, app) {
    const box = el("div", { class: "result-box result-blocked" });
    box.appendChild(el("p", { class: "result-title" }, [
      el("span", { class: "badge badge-blocked" }, ["NOT YET"]),
      " " + title
    ]));
    paragraphs.forEach(function (paragraph) {
      box.appendChild(el("p", {}, [paragraph]));
    });
    renderRelatedResources(box, app);
    quizCard.appendChild(box);
  }

  function renderStepResult() {
    updateProgress(1);
    quizCard.innerHTML = "";

    const game = gameById.get(state.app);

    if (state.sub === "yes") {
      if (game.yesOutcome === "success") {
        renderResultSuccess(game);
      } else {
        renderResultSuccessWait(game);
      }
    } else {
      renderResultBlocked(game.missingTitle, [game.missingText], game.id);
    }

    renderReminder(quizCard);
    renderBack(quizCard);
  }

  function render() {
    if (state.step === "app") renderStepApp();
    else if (state.step === "sub") renderStepSub();
    else if (state.step === "result") renderStepResult();
  }

  function handlePopState() {
    if (quizHistoryActive) {
      quizHistoryActive = false;
      resetQuiz();
    }
  }

  render();

  return { reset: resetQuiz, handlePopState };
}
