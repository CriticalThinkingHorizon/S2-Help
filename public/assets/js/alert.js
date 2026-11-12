const STORAGE_KEY = "s2-alert-dismissed-forever";

export function initAlert() {
  const bar = document.getElementById("alert-bar");
  const dismiss = document.getElementById("alert-dismiss");
  const dismissForever = document.getElementById("alert-dismiss-forever");

  if (!bar || !dismiss || !dismissForever) return;

  let permanentlyDismissed = false;
  try {
    permanentlyDismissed = localStorage.getItem(STORAGE_KEY) === "1";
  } catch (error) {
    permanentlyDismissed = false;
  }

  if (permanentlyDismissed) return;

  const root = document.documentElement;

  function syncHeight() {
    root.style.setProperty("--alert-height", bar.offsetHeight + "px");
  }

  function hideBar() {
    bar.hidden = true;
    document.body.classList.remove("has-alert");
    root.style.removeProperty("--alert-height");
    window.removeEventListener("resize", syncHeight);
  }

  bar.hidden = false;
  document.body.classList.add("has-alert");
  syncHeight();
  window.addEventListener("resize", syncHeight);

  dismiss.addEventListener("click", hideBar);

  dismissForever.addEventListener("click", function () {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (error) {
      /* storage unavailable, just dismiss for this page load */
    }

    hideBar();
  });
}
