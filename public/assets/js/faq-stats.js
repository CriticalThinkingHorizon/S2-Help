const FAQ_STATS_PORT = 4443;
const FAQ_UID_KEY = "s2ready_uid";

function getStatsOrigins() {
  if (window.__FAQ_STATS_ORIGIN__) return [window.__FAQ_STATS_ORIGIN__];
  const origins = [window.location.origin];
  const portOrigin = window.location.protocol + "//" + window.location.hostname + ":" + FAQ_STATS_PORT;
  if (origins.indexOf(portOrigin) === -1) origins.push(portOrigin);
  return origins;
}

function getFaqUserId() {
  let id = null;
  try {
    id = localStorage.getItem(FAQ_UID_KEY);
  } catch (error) {
    /* storage unavailable */
  }
  if (!id) {
    id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : "uid-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    try {
      localStorage.setItem(FAQ_UID_KEY, id);
    } catch (error) {
      /* storage unavailable */
    }
  }
  return id;
}

function loadSocketIOClient(origins, index, callback) {
  if (window.io) {
    callback(origins[index - 1] || origins[0]);
    return;
  }
  if (index >= origins.length) {
    console.warn("FAQ popularity tracking is unavailable (stats server unreachable).");
    return;
  }

  const origin = origins[index];
  const script = document.createElement("script");
  script.src = origin + "/socket.io/socket.io.js";
  script.onload = function () {
    if (window.io) {
      callback(origin);
      return;
    }
    script.remove();
    loadSocketIOClient(origins, index + 1, callback);
  };
  script.onerror = function () {
    script.remove();
    loadSocketIOClient(origins, index + 1, callback);
  };
  document.head.appendChild(script);
}

export function createFaqStats({ onStats }) {
  let socket = null;

  loadSocketIOClient(getStatsOrigins(), 0, function (origin) {
    socket = window.io(origin, { transports: ["websocket", "polling"] });

    let appliedInitialOrder = false;
    socket.on("faq:stats", function (stats) {
      if (appliedInitialOrder) return;
      appliedInitialOrder = true;
      onStats(stats || {});
    });
  });

  return {
    trackOpen(faqId) {
      if (socket && socket.connected) {
        socket.emit("faq:open", { userId: getFaqUserId(), faqId: faqId });
      }
    }
  };
}
