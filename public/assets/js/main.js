import { getHash } from "./utils.js";
import { initNavigation, showSection, sectionExists } from "./navigation.js?v=20261104h";
import { initQuiz } from "./quiz.js?v=20261104g";
import { initFaq } from "./faq.js";
import { initTutorials } from "./tutorials.js?v=20261104f";
import { initExploits } from "./exploits.js";
import { initResources } from "./resources.js";
import { initKernelGame } from "./kernel-game.js?v=20261104e";
import { createFaqStats } from "./faq-stats.js";

async function boot() {
  initNavigation();

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
}

boot().catch(function (error) {
  console.error("Failed to initialize the application:", error);
});
