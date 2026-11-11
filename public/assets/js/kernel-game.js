import { el } from "./utils.js";

const CONFIG = {
  kernValue: 1,
  wordPenalty: 5,
  maxMisses: 10,
  maxProgress: 100,
  checkpointCount: 4,
  powerUpChance: 0.07,
  ethernetDuration: 10,
  ethernetWidthMultiplier: 1.4,
  immunityDuration: 8,
  baseFallSpeed: 275,
  fallSpeedPerPercent: 0.45,
  fallSpeedPerCheckpoint: 80,
  baseSpawnMs: 650,
  minSpawnMs: 210,
  spawnMsPerCheckpoint: 110,
  wordChanceBase: 0.2,
  wordChancePerCheckpoint: 0.05,
  wordChanceMax: 0.5,
  basketSpeed: 560,
  ninjaMinProgress: 76,
  ninjaMaxProgress: 98,
  ninjaPresses: 20,
  ninjaTimeLimit: 5
};

const DIFFICULTIES = [
  { id: "easy", label: "FS (EASY)", speedMultiplier: 1, spawnIntervalMultiplier: 1 },
  { id: "medium", label: "KERNEL (MEDIUM)", speedMultiplier: 3, spawnIntervalMultiplier: 0.85 },
  { id: "hard", label: "BOOTROM (HARD)", speedMultiplier: 7, spawnIntervalMultiplier: 0.7 }
];

const BAD_WORDS = [
  { text: "Vagueposting", penalty: 5 },
  { text: "Firmware Update", penalty: 10 },
  { text: "Telemetry", penalty: 5 },
  { text: "Token Limit", penalty: 5 },
  { text: "Email from the CEO", penalty: 5 },
  { text: "Ultranag", penalty: 10 },
  { text: "Civ Recalled", penalty: 10 },
  { text: "Shader Based Cheap Homebrews", penalty: 5 },
  { text: "Ban Wave", penalty: 10 },
  { text: "Bricked NAND", penalty: 10 },
  { text: "Fake Exploit", penalty: 10 }
];

const EVENT_TRIGGERS = [15, 38, 60, 80, 95];

const EVENTS = [
  {
    question:
      "A random guy on Discord says you should update, because he has an exploit for the newest firmware. Do you trust him?",
    choices: [
      {
        label: "Trust him",
        risk: 0.9,
        reward: 25,
        failText:
          "You updated on a stranger's word. The firmware patched everything. Game over."
      },
      {
        label: "Ignore him",
        risk: 0
      }
    ]
  },
  {
    question:
      "A YouTube video titled “FREE KERNEL EXPLOIT 2026 (100% WORKING)” has a download link in the description. Do you click it?",
    choices: [
      {
        label: "Download it",
        risk: 0.8,
        reward: 10,
        failText:
          "The download was a crypto miner. Your terminal melted. Game over."
      },
      {
        label: "Close the tab",
        risk: 0
      }
    ]
  },
  {
    question:
      "Someone DMs you “here is the decryption key, trust me”. Do you use it?",
    choices: [
      {
        label: "Use the key",
        risk: 0.95,
        reward: 15,
        failText:
          "The key was a brick. Your console is now a very expensive paperweight."
      },
      {
        label: "Delete the message",
        risk: 0
      }
    ]
  },
  {
    question:
      "A forum post says “just downgrade, it's easy, I did it once”. Do you follow the guide?",
    choices: [
      {
        label: "Follow the guide",
        risk: 0.7,
        reward: 20,
        failText:
          "The downgrade failed halfway through. The console no longer boots. Game over."
      },
      {
        label: "Wait for a verified guide",
        risk: 0
      }
    ]
  },
  {
    question:
      "A random tool says 90DNS slows you down and asks you to disable it “for better performance”. Do you turn it off?",
    choices: [
      {
        label: "Disable it",
        risk: 0.85,
        reward: 10,
        failText:
          "Nintendo's servers saw everything. Your console got banned. Game over."
      },
      {
        label: "Keep it enabled",
        risk: 0
      }
    ]
  }
];

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function initKernelGame() {
  const section = document.getElementById("section-game");
  const canvas = document.getElementById("kernel-canvas");
  if (!section || !canvas) return;

  const screen = canvas.closest(".kernel-screen");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("kernel-hud");
  const overlay = document.getElementById("kernel-overlay");
  const progressEl = document.getElementById("kernel-progress");
  const checkpointEl = document.getElementById("kernel-checkpoint");
  const missesEl = document.getElementById("kernel-misses");

  const state = {
    running: false,
    paused: false,
    over: false,
    started: false,
    difficulty: "easy",
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
    progress: 0,
    highestCheckpoint: 0,
    missed: 0,
    objects: [],
    particles: [],
    spawnTimer: 0,
    flash: null,
    ethernetTime: 0,
    immunityTime: 0,
    eventActive: false,
    ninjaActive: false,
    ninjaShown: false,
    ninjaPresses: 0,
    ninjaTimeLeft: CONFIG.ninjaTimeLimit,
    ninjaTimerId: null,
    ninjaTrigger: CONFIG.ninjaMinProgress,
    totalCaught: 0,
    nextEventIndex: 0,
    checkpointFlash: 0,
    lastCheckpointShown: 0
  };

  const basket = {
    x: 300,
    targetX: 300,
    y: 500,
    w: 96,
    h: 34,
    speed: CONFIG.basketSpeed
  };

  const keys = { left: false, right: false };
  let width = 600;
  let height = 600;
  let dpr = 1;
  let baseBasketWidth = basket.w;
  let rafId = null;
  let lastTime = 0;
  let shakeTimer = null;
  let ninjaUi = null;

  function isVisible() {
    return section.classList.contains("visible");
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const size = Math.round(rect.width);
    if (size < 60) return;

    width = size;
    height = size;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    baseBasketWidth = Math.max(72, Math.round(size * 0.18));
    basket.w = baseBasketWidth * (state.ethernetTime > 0 ? CONFIG.ethernetWidthMultiplier : 1);
    basket.h = Math.max(28, Math.round(size * 0.065));
    basket.y = height - basket.h - Math.max(16, Math.round(size * 0.06));
    basket.x = clamp(basket.x, basket.w / 2, width - basket.w / 2);
    basket.targetX = clamp(basket.targetX, basket.w / 2, width - basket.w / 2);
  }

  function updateHud() {
    progressEl.textContent = Math.max(0, state.progress).toFixed(1) + "%";
    checkpointEl.textContent = state.highestCheckpoint + "/" + CONFIG.checkpointCount;
    missesEl.textContent = state.missed + "/" + CONFIG.maxMisses;
  }

  function setOverlay(title, text, buttonLabel, onAction) {
    overlay.innerHTML = "";
    overlay.hidden = false;

    const panel = el("div", { class: "kernel-overlay-panel" });
    panel.appendChild(el("p", { class: "kernel-overlay-kicker" }, ["TERMINAL://KERNEL"]));
    panel.appendChild(el("h3", { class: "kernel-overlay-title" }, [title]));
    panel.appendChild(el("p", { class: "kernel-overlay-text" }, [text]));

    if (buttonLabel && onAction) {
      const button = el("button", { class: "kernel-btn", type: "button" }, [buttonLabel]);
      button.addEventListener("click", onAction);
      panel.appendChild(button);
    }

    overlay.appendChild(panel);
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = "";
  }

  function showStartOverlay() {
    overlay.innerHTML = "";
    overlay.hidden = false;

    const panel = el("div", { class: "kernel-overlay-panel" });
    panel.appendChild(el("p", { class: "kernel-overlay-kicker" }, ["TERMINAL://KERNEL"]));
    panel.appendChild(el("h3", { class: "kernel-overlay-title" }, ["KERNEL EXPLOIT"]));
    panel.appendChild(
      el("p", { class: "kernel-overlay-text" }, [
        "Catch falling vulnerabilities to gain 1% each. Grab Ethernet to widen your terminal and 90DNS for temporary immunity. Avoid the bad words; they cost 5% or more. Lose 10 vulnerabilities or drop below 0% and it is over. Choose a difficulty; higher difficulties make everything fall faster and more often."
      ])
    );

    const choices = el("div", { class: "kernel-overlay-choices" });
    DIFFICULTIES.forEach(function (difficulty) {
      const button = el("button", {
        class: "kernel-btn",
        type: "button"
      }, [difficulty.label + " · " + difficulty.speedMultiplier + "× SPEED"]);
      button.addEventListener("click", function () {
        startGame(difficulty.id);
      });
      choices.appendChild(button);
    });
    panel.appendChild(choices);
    overlay.appendChild(panel);
  }

  function showQuestion(event) {
    state.eventActive = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    overlay.innerHTML = "";
    overlay.hidden = false;

    const panel = el("div", { class: "kernel-overlay-panel" });
    panel.appendChild(el("p", { class: "kernel-overlay-kicker" }, ["TERMINAL://INCOMING"]));
    panel.appendChild(el("h3", { class: "kernel-overlay-title" }, ["Incoming transmission"]));
    panel.appendChild(el("p", { class: "kernel-overlay-text" }, [event.question]));

    const choices = el("div", { class: "kernel-overlay-choices" });
    event.choices.forEach(function (choice) {
      const button = el("button", { class: "kernel-btn", type: "button" }, [choice.label]);
      button.addEventListener("click", function () {
        resolveQuestion(choice);
      });
      choices.appendChild(button);
    });
    panel.appendChild(choices);
    overlay.appendChild(panel);
  }

  function resolveQuestion(choice) {
    if (!state.eventActive) return;
    state.eventActive = false;

    if (choice.risk > 0 && Math.random() < choice.risk) {
      finish(false, choice.failText);
      return;
    }

    if (choice.reward) {
      state.progress = Math.min(CONFIG.maxProgress, state.progress + choice.reward);
      state.flash = { color: "rgba(90, 255, 150, 0.16)", life: 0.3 };
      refreshCheckpoint();
      updateHud();
      if (state.progress >= CONFIG.maxProgress) {
        finish(true, "");
        return;
      }
    }

    hideOverlay();
    if (maybeTriggerNinja()) return;

    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  function maybeAskQuestion() {
    if (state.nextEventIndex >= EVENTS.length) return;
    if (state.totalCaught < EVENT_TRIGGERS[state.nextEventIndex]) return;
    const event = EVENTS[state.nextEventIndex];
    state.nextEventIndex += 1;
    showQuestion(event);
  }

  function clearNinjaTimer() {
    if (state.ninjaTimerId) {
      clearInterval(state.ninjaTimerId);
      state.ninjaTimerId = null;
    }
  }

  function updateNinjaUi() {
    if (!ninjaUi) return;
    ninjaUi.counter.textContent =
      state.ninjaPresses + " / " + CONFIG.ninjaPresses + " PRESSES";
    ninjaUi.timerLabel.textContent = Math.max(0, state.ninjaTimeLeft).toFixed(1) + "s";
    ninjaUi.pressBar.value = Math.min(state.ninjaPresses, CONFIG.ninjaPresses);
    ninjaUi.timeBar.value = Math.max(0, state.ninjaTimeLeft);
  }

  function registerNinjaPress() {
    if (!state.ninjaActive) return;
    state.ninjaPresses += 1;
    updateNinjaUi();
    if (state.ninjaPresses >= CONFIG.ninjaPresses) {
      finishNinja(true);
    }
  }

  function finishNinja(success) {
    if (!state.ninjaActive) return;
    state.ninjaActive = false;
    state.eventActive = false;
    clearNinjaTimer();
    ninjaUi = null;

    if (!success) {
      finish(false, "The ninjas cut your connection. Game over.");
      return;
    }

    state.flash = { color: "rgba(90, 255, 150, 0.16)", life: 0.25 };
    hideOverlay();
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  function showNinjaEvent() {
    state.eventActive = true;
    state.ninjaActive = true;
    state.ninjaPresses = 0;
    state.ninjaTimeLeft = CONFIG.ninjaTimeLimit;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    overlay.innerHTML = "";
    overlay.hidden = false;

    const panel = el("div", { class: "kernel-overlay-panel kernel-ninja-panel" });
    panel.appendChild(el("p", { class: "kernel-overlay-kicker" }, ["TERMINAL://BREACH"]));
    panel.appendChild(
      el("h3", { class: "kernel-overlay-title" }, ["The ninjas infiltrated your connection"])
    );
    panel.appendChild(
      el("p", { class: "kernel-overlay-text" }, [
        "Press the ESCAPE button as fast as you can until you break free."
      ])
    );

    const counter = el("p", { class: "kernel-ninja-counter" });
    const pressBar = el("progress", {
      class: "kernel-ninja-bar",
      max: CONFIG.ninjaPresses,
      value: 0
    });
    const timerRow = el("div", { class: "kernel-ninja-timer-row" });
    const timerLabel = el("span", { class: "kernel-ninja-timer-label" });
    const timeBar = el("progress", {
      class: "kernel-ninja-timer",
      max: CONFIG.ninjaTimeLimit,
      value: CONFIG.ninjaTimeLimit
    });
    timerRow.appendChild(timerLabel);
    timerRow.appendChild(timeBar);

    const button = el("button", {
      class: "kernel-btn kernel-escape-btn",
      type: "button"
    }, ["ESCAPE"]);
    button.addEventListener("click", registerNinjaPress);

    panel.appendChild(counter);
    panel.appendChild(pressBar);
    panel.appendChild(timerRow);
    panel.appendChild(button);
    overlay.appendChild(panel);

    ninjaUi = {
      counter: counter,
      pressBar: pressBar,
      timerLabel: timerLabel,
      timeBar: timeBar
    };
    updateNinjaUi();

    startNinjaClock();
  }

  function startNinjaClock() {
    if (state.ninjaTimerId || !state.ninjaActive) return;
    state.ninjaTimerId = setInterval(function () {
      if (!state.ninjaActive) return;
      state.ninjaTimeLeft = Math.max(0, state.ninjaTimeLeft - 0.1);
      updateNinjaUi();
      if (state.ninjaTimeLeft <= 0) {
        finishNinja(false);
      }
    }, 100);
  }

  function maybeTriggerNinja() {
    if (
      state.ninjaShown ||
      state.ninjaActive ||
      state.over ||
      !state.running ||
      state.eventActive
    ) {
      return false;
    }
    if (state.progress < CONFIG.ninjaMinProgress) return false;
    if (state.progress < state.ninjaTrigger) return false;

    state.ninjaShown = true;
    showNinjaEvent();
    return true;
  }

  function resetState() {
    state.running = true;
    state.paused = false;
    state.over = false;
    state.started = true;
    state.progress = 0;
    state.highestCheckpoint = 0;
    state.missed = 0;
    state.objects = [];
    state.particles = [];
    state.spawnTimer = 250;
    state.flash = null;
    state.ethernetTime = 0;
    state.immunityTime = 0;
    state.eventActive = false;
    state.ninjaActive = false;
    state.ninjaShown = false;
    state.ninjaPresses = 0;
    state.ninjaTimeLeft = CONFIG.ninjaTimeLimit;
    state.ninjaTrigger =
      CONFIG.ninjaMinProgress +
      Math.floor(Math.random() * (CONFIG.ninjaMaxProgress - CONFIG.ninjaMinProgress + 1));
    state.totalCaught = 0;
    state.nextEventIndex = 0;
    state.checkpointFlash = 0;
    clearNinjaTimer();
    ninjaUi = null;
    state.lastCheckpointShown = 0;
    keys.left = false;
    keys.right = false;
    basket.w = baseBasketWidth;
    basket.x = width / 2;
    basket.targetX = width / 2;
    if (shakeTimer) clearTimeout(shakeTimer);
    if (screen) screen.classList.remove("is-shaking");
    hud.hidden = false;
    updateHud();
  }

  function startGame(difficultyId) {
    const difficulty =
      DIFFICULTIES.find(function (item) { return item.id === difficultyId; }) ||
      DIFFICULTIES[0];
    state.difficulty = difficulty.id;
    state.speedMultiplier = difficulty.speedMultiplier;
    state.spawnIntervalMultiplier = difficulty.spawnIntervalMultiplier;

    resize();
    resetState();
    hideOverlay();
    draw();
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  function pauseGame() {
    if (!state.running || state.paused || state.over || state.eventActive) return;
    state.paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setOverlay("PAUSED", "The terminal is on standby. Resume when you are ready.", "Resume", resumeGame);
  }

  function resumeGame() {
    if (!state.running || state.over || state.eventActive) return;
    state.paused = false;
    hideOverlay();
    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  function finish(won, reason) {
    state.running = false;
    state.paused = false;
    state.over = true;
    state.eventActive = false;
    state.ninjaActive = false;
    clearNinjaTimer();
    ninjaUi = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    draw();
    updateHud();

    if (won) {
      setOverlay(
        "You found it",
        "You have the kernel exploit. It was always in your heart. I always believed in you.",
        "Play again",
        showStartOverlay
      );
    } else {
      setOverlay("GAME OVER", reason, "Try again", showStartOverlay);
    }
  }

  function nextSpawnDelay() {
    const base = Math.max(
      CONFIG.minSpawnMs,
      CONFIG.baseSpawnMs - state.highestCheckpoint * CONFIG.spawnMsPerCheckpoint
    );
    return base * state.spawnIntervalMultiplier * randomBetween(0.75, 1.2);
  }

  function wordChance() {
    return Math.min(
      CONFIG.wordChanceMax,
      CONFIG.wordChanceBase + state.highestCheckpoint * CONFIG.wordChancePerCheckpoint
    );
  }

  function spawnObject() {
    const fallSpeed =
      (CONFIG.baseFallSpeed +
        state.highestCheckpoint * CONFIG.fallSpeedPerCheckpoint +
        state.progress * CONFIG.fallSpeedPerPercent +
        randomBetween(-12, 22)) *
      state.speedMultiplier;

    if (Math.random() < CONFIG.powerUpChance) {
      const isEthernet = Math.random() < 0.5;
      const power = isEthernet ? "ethernet" : "90dns";
      const text = isEthernet ? "ETHERNET" : "90DNS";
      ctx.font = "700 11px " + MONO;
      const objectWidth = Math.max(80, Math.ceil(ctx.measureText(text).width) + 22);
      const objectHeight = 26;
      state.objects.push({
        type: "power",
        power: power,
        text: text,
        x: randomBetween(objectWidth / 2 + 8, width - objectWidth / 2 - 8),
        y: -objectHeight,
        w: objectWidth,
        h: objectHeight,
        vy: fallSpeed
      });
      return;
    }

    const isWord = Math.random() < wordChance();
    if (isWord) {
      const word = BAD_WORDS[Math.floor(Math.random() * BAD_WORDS.length)];
      ctx.font = "700 12px " + MONO;
      const objectWidth = Math.max(78, Math.ceil(ctx.measureText(word.text).width) + 22);
      const objectHeight = 26;
      state.objects.push({
        type: "word",
        text: word.text,
        penalty: word.penalty,
        x: randomBetween(objectWidth / 2 + 8, width - objectWidth / 2 - 8),
        y: -objectHeight,
        w: objectWidth,
        h: objectHeight,
        vy: fallSpeed
      });
      return;
    }

    const text = "VULNERABILITY";
    ctx.font = "700 10px " + MONO;
    const objectWidth = Math.max(96, Math.ceil(ctx.measureText(text).width) + 20);
    const objectHeight = 26;
    state.objects.push({
      type: "kern",
      text: text,
      x: randomBetween(objectWidth / 2 + 8, width - objectWidth / 2 - 8),
      y: -objectHeight,
      w: objectWidth,
      h: objectHeight,
      vy: fallSpeed
    });
  }

  function overlapsBasket(object) {
    const basketLeft = basket.x - basket.w / 2;
    const basketRight = basket.x + basket.w / 2;
    const objectLeft = object.x - object.w / 2;
    const objectRight = object.x + object.w / 2;
    return (
      object.y + object.h >= basket.y &&
      object.y < basket.y + basket.h &&
      objectRight > basketLeft &&
      objectLeft < basketRight
    );
  }

  function triggerShake() {
    if (!screen) return;
    screen.classList.remove("is-shaking");
    void screen.offsetWidth;
    screen.classList.add("is-shaking");
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(function () {
      screen.classList.remove("is-shaking");
    }, 420);
  }

  function spawnExplosion(x, y, palette) {
    const colors = palette || ["#ff5a70", "#ffb26b", "#ff8a5c"];
    for (let i = 0; i < 28; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(70, 270);
      const life = randomBetween(0.35, 0.85);
      state.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: life,
        maxLife: life,
        size: randomBetween(1.5, 4),
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function refreshCheckpoint() {
    const checkpoint = Math.min(
      CONFIG.checkpointCount,
      Math.floor(Math.max(0, state.progress) / 25)
    );
    if (checkpoint > state.highestCheckpoint) {
      state.highestCheckpoint = checkpoint;
      state.checkpointFlash = 1.4;
    }
  }

  function collect(object) {
    if (state.over || state.eventActive) return;
    if (object.type === "kern") {
      state.progress = Math.min(CONFIG.maxProgress, state.progress + CONFIG.kernValue);
      state.totalCaught += 1;
      state.flash = { color: "rgba(90, 255, 150, 0.16)", life: 0.22 };
    } else if (object.type === "power") {
      if (object.power === "ethernet") {
        state.ethernetTime = Math.max(state.ethernetTime, CONFIG.ethernetDuration);
        state.flash = { color: "rgba(110, 216, 255, 0.16)", life: 0.22 };
        spawnExplosion(basket.x, basket.y + basket.h / 2, ["#6fd8ff", "#b8f0ff", "#8ecbff"]);
      } else {
        state.immunityTime = Math.max(state.immunityTime, CONFIG.immunityDuration);
        state.flash = { color: "rgba(255, 209, 102, 0.16)", life: 0.22 };
        spawnExplosion(basket.x, basket.y + basket.h / 2, ["#ffd166", "#ffe6a1", "#ffb347"]);
      }
    } else if (state.immunityTime > 0) {
      state.flash = { color: "rgba(110, 216, 255, 0.14)", life: 0.2 };
      spawnExplosion(basket.x, basket.y + basket.h / 2, ["#6fd8ff", "#b8f0ff", "#ffd166"]);
    } else {
      state.progress -= object.penalty || CONFIG.wordPenalty;
      triggerShake();
      spawnExplosion(basket.x, basket.y + basket.h / 2);
    }

    refreshCheckpoint();
    updateHud();

    if (state.progress >= CONFIG.maxProgress) {
      finish(true, "");
    } else if (state.progress < 0) {
      finish(false, "The bad words dragged your progress below 0%. The kernel slipped away.");
    } else {
      maybeAskQuestion();
      if (!state.eventActive) maybeTriggerNinja();
    }
  }

  function miss(object) {
    if (state.over || state.eventActive || object.type !== "kern") return;
    state.missed += 1;
    updateHud();
    if (state.missed >= CONFIG.maxMisses) {
      finish(false, "You lost " + CONFIG.maxMisses + " vulnerabilities. The terminal went dark.");
    }
  }

  function update(dt) {
    if (state.paused || state.over || state.eventActive) return;

    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (direction !== 0) {
      basket.x += direction * basket.speed * dt;
      basket.targetX = basket.x;
    } else {
      basket.x += (basket.targetX - basket.x) * Math.min(1, dt * 14);
    }
    const targetBasketWidth =
      baseBasketWidth * (state.ethernetTime > 0 ? CONFIG.ethernetWidthMultiplier : 1);
    basket.w += (targetBasketWidth - basket.w) * Math.min(1, dt * 8);
    basket.x = clamp(basket.x, basket.w / 2, width - basket.w / 2);

    state.spawnTimer -= dt * 1000;
    if (state.spawnTimer <= 0) {
      spawnObject();
      state.spawnTimer = nextSpawnDelay();
    }

    state.objects.forEach(function (object) {
      if (state.over || state.eventActive) return;
      object.y += object.vy * dt;
      if (overlapsBasket(object)) {
        object.done = true;
        collect(object);
      } else if (object.y > height + 24) {
        object.done = true;
        miss(object);
      }
    });
    state.objects = state.objects.filter(function (object) {
      return !object.done;
    });

    if (state.flash) {
      state.flash.life -= dt;
      if (state.flash.life <= 0) state.flash = null;
    }
    state.particles.forEach(function (particle) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
      particle.vx *= 0.99;
    });
    state.particles = state.particles.filter(function (particle) {
      return particle.life > 0;
    });
    if (state.ethernetTime > 0) {
      state.ethernetTime = Math.max(0, state.ethernetTime - dt);
    }
    if (state.immunityTime > 0) {
      state.immunityTime = Math.max(0, state.immunityTime - dt);
    }
    if (state.checkpointFlash > 0) {
      state.checkpointFlash -= dt;
    }
  }

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#04140a");
    gradient.addColorStop(0.55, "#020b05");
    gradient.addColorStop(1, "#010603");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(80, 255, 150, 0.05)";
    ctx.lineWidth = 1;
    const grid = Math.max(34, Math.round(width / 16));
    for (let x = 0; x <= width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawKern(object) {
    const x = object.x - object.w / 2;
    ctx.save();
    ctx.shadowColor = "rgba(95, 255, 155, 0.65)";
    ctx.shadowBlur = 10;
    roundedRect(x, object.y, object.w, object.h, 5);
    ctx.fillStyle = "rgba(60, 255, 140, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "#78ffa8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#c5ffda";
    ctx.font = "700 10px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.text, object.x, object.y + object.h / 2 + 0.5);
    ctx.restore();
  }

  function drawWord(object) {
    const x = object.x - object.w / 2;
    ctx.save();
    ctx.shadowColor = "rgba(255, 80, 100, 0.5)";
    ctx.shadowBlur = 8;
    roundedRect(x, object.y, object.w, object.h, 5);
    ctx.fillStyle = "rgba(255, 70, 90, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "#ff5a70";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffb3bd";
    ctx.font = "700 12px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.text, object.x, object.y + object.h / 2 + 0.5);
    ctx.restore();
  }

  function drawPowerup(object) {
    const isEthernet = object.power === "ethernet";
    const color = isEthernet ? "#6fd8ff" : "#ffd166";
    const fill = isEthernet ? "rgba(90, 200, 255, 0.15)" : "rgba(255, 200, 90, 0.15)";
    const x = object.x - object.w / 2;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 11;
    roundedRect(x, object.y, object.w, object.h, 5);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = isEthernet ? "#c7f2ff" : "#fff0bd";
    ctx.font = "700 11px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(object.text, object.x, object.y + object.h / 2 + 0.5);
    ctx.restore();
  }

  function drawBasket() {
    const x = basket.x - basket.w / 2;
    ctx.save();
    ctx.shadowColor = "rgba(120, 255, 170, 0.75)";
    ctx.shadowBlur = 14;
    roundedRect(x, basket.y, basket.w, basket.h, 6);
    ctx.fillStyle = "rgba(50, 255, 130, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "#8dffb8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#c9ffdd";
    ctx.font = "700 18px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(">_", basket.x, basket.y + basket.h / 2 + 1);

    if (state.immunityTime > 0) {
      const pulse = 0.55 + Math.sin(performance.now() / 140) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(255, 209, 102, 0.8)";
      ctx.shadowBlur = 14;
      roundedRect(x - 6, basket.y - 6, basket.w + 12, basket.h + 12, 11);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    state.particles.forEach(function (particle) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawFlash() {
    if (state.flash) {
      ctx.fillStyle = state.flash.color;
      ctx.fillRect(0, 0, width, height);
    }
    if (state.checkpointFlash > 0) {
      const alpha = Math.min(1, state.checkpointFlash);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#baffd0";
      ctx.font = "700 18px " + MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(120, 255, 170, 0.8)";
      ctx.shadowBlur = 12;
      ctx.fillText(
        "CHECKPOINT " + state.highestCheckpoint + "/" + CONFIG.checkpointCount,
        width / 2,
        height * 0.42
      );
      ctx.restore();
    }
  }

  function drawEffects() {
    const labels = [];
    if (state.ethernetTime > 0) {
      labels.push("ETHERNET " + Math.ceil(state.ethernetTime) + "s");
    }
    if (state.immunityTime > 0) {
      labels.push("90DNS " + Math.ceil(state.immunityTime) + "s");
    }
    if (!labels.length) return;

    ctx.save();
    ctx.fillStyle = "#9fe8ff";
    ctx.font = "700 10px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(120, 200, 255, 0.8)";
    ctx.shadowBlur = 9;
    ctx.fillText(labels.join("  |  "), width / 2, 52);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    state.objects.forEach(function (object) {
      if (object.type === "kern") drawKern(object);
      else if (object.type === "word") drawWord(object);
      else drawPowerup(object);
    });
    drawBasket();
    drawParticles();
    drawFlash();
    drawEffects();
  }

  function loop(now) {
    if (!state.running || state.paused || state.eventActive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    draw();
    if (state.running && !state.paused && !state.eventActive) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function pointerToTarget(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    basket.targetX = clamp(x, basket.w / 2, width - basket.w / 2);
  }

  document.addEventListener("keydown", function (event) {
    if (!isVisible()) return;
    const key = event.key.toLowerCase();

    if (state.ninjaActive) {
      if ((key === "escape" || key === " ") && !event.repeat) {
        event.preventDefault();
        registerNinjaPress();
      }
      return;
    }

    if (state.eventActive) return;
    if (key === "arrowleft" || key === "a") {
      keys.left = true;
      if (state.running && !state.paused) event.preventDefault();
    } else if (key === "arrowright" || key === "d") {
      keys.right = true;
      if (state.running && !state.paused) event.preventDefault();
    } else if (key === "escape" && state.running) {
      event.preventDefault();
      if (state.paused) resumeGame();
      else pauseGame();
    }
  });

  document.addEventListener("keyup", function (event) {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.left = false;
    if (key === "arrowright" || key === "d") keys.right = false;
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!isVisible()) return;
    pointerToTarget(event);
  });

  canvas.addEventListener("pointerdown", function (event) {
    if (!isVisible()) return;
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        /* pointer capture unavailable */
      }
    }
    pointerToTarget(event);
  });

  document.addEventListener("sectionchange", function (event) {
    const name = event.detail && event.detail.name;
    if (name === "game") {
      resize();
      draw();
      if (!state.started) showStartOverlay();
      if (state.ninjaActive) startNinjaClock();
    } else if (state.ninjaActive) {
      clearNinjaTimer();
    } else if (state.running && !state.paused && !state.over && !state.eventActive) {
      pauseGame();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (state.ninjaActive) {
        clearNinjaTimer();
      } else if (state.running && !state.paused && !state.over && !state.eventActive) {
        pauseGame();
      }
    } else if (state.ninjaActive) {
      startNinjaClock();
    }
  });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(function () {
      resize();
      draw();
    });
    observer.observe(canvas);
  }
  window.addEventListener("resize", function () {
    resize();
    draw();
  });

  resize();
  draw();
  showStartOverlay();
}
