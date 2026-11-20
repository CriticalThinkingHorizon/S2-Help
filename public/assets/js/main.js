import { getHash } from "./utils.js";
import { initNavigation, showSection, sectionExists } from "./navigation.js?v=20261104h";
import { initQuiz } from "./quiz.js?v=20261104h";
import { initKaihen } from "./kaihen.js?v=20261118e";
import { initBrickWall } from "./brick-wall.js?v=20261118i";
import { initFaq } from "./faq.js";
import { initTutorials } from "./tutorials.js?v=20261104f";
import { initExploits } from "./exploits.js";
import { initResources } from "./resources.js";
import { initKernelGame } from "./kernel-game.js?v=20261104l";
import { createFaqStats } from "./faq-stats.js";
import { initAlert } from "./alert.js";

function initLastUpdated() {
  const el = document.getElementById("last-updated-date");
  if (!el) return;

  const modified = new Date(document.lastModified);
  if (isNaN(modified.getTime())) return;

  el.setAttribute("datetime", modified.toISOString().slice(0, 10));
  el.textContent = modified.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

async function boot() {
  initAlert();
  initLastUpdated();
  initNavigation();

  let brickWallPromise = null;
  function ensureBrickWall() {
    if (!brickWallPromise) {
      brickWallPromise = initBrickWall().catch(function (error) {
        brickWallPromise = null;
        console.error("Failed to initialize the brick wall:", error);
      });
    }
    return brickWallPromise;
  }

  document.addEventListener("sectionchange", function (event) {
    if (event.detail && event.detail.name === "brickwall") ensureBrickWall();
  });

  const quiz = await initQuiz();

  let statsTracker = null;
  const faq = await initFaq({
    onOpen(faqId) {
      if (statsTracker) statsTracker.trackOpen(faqId);
    }
  });

  statsTracker = createFaqStats({
    onStats(stats) {
      faq.reorderByPopularity(stats);
    }
  });

  const tutorials = await initTutorials();
  await initKaihen();
  await initExploits();

  await initResources();
  initKernelGame();

  function applyHashState() {
    const hash = getHash();

    if (!hash) {
      showSection("quiz");
      return;
    }

    if (sectionExists(hash)) {
      showSection(hash);
      return;
    }

    if (hash.indexOf("tutorial-") === 0) {
      showSection("tutorials");
      tutorials.openById(hash);
      const target = document.getElementById(hash);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }

    if (hash.indexOf("faq-") === 0) {
      showSection("faq");
      faq.clearSearch();
      faq.openById(hash);
      const target = document.getElementById(hash);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return;
    }

    showSection("quiz");
  }

  window.addEventListener("popstate", function () {
    quiz.handlePopState();
    applyHashState();
  });
  window.addEventListener("hashchange", applyHashState);
  applyHashState();
  document.body.classList.remove("booting");
}

boot().catch(function (error) {
  document.body.classList.remove("booting");
  console.error("Failed to initialize the application:", error);
});
