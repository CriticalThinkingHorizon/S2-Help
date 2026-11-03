import { setHash } from "./utils.js";

const menuButtons = document.querySelectorAll("nav.menu button");

const sections = {
  quiz: document.getElementById("section-quiz"),
  faq: document.getElementById("section-faq"),
  resources: document.getElementById("section-resources")
};

export function showSection(name) {
  Object.keys(sections).forEach(function (key) {
    sections[key].classList.toggle("visible", key === name);
  });
  menuButtons.forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-section") === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function sectionExists(name) {
  return Boolean(sections[name]);
}

export function initNavigation() {
  menuButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const name = button.getAttribute("data-section");
      showSection(name);
      setHash(name);
    });
  });
}
