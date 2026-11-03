export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export function setHash(hash) {
  if (window.history && history.replaceState) {
    history.replaceState(null, "", "#" + hash);
  } else {
    location.hash = hash;
  }
}

export function getHash() {
  return decodeURIComponent(location.hash.replace(/^#/, ""));
}

export function legacyCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (error) {
    /* no-op */
  }
  document.body.removeChild(textarea);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () {
      legacyCopy(text);
    });
  }
  return Promise.resolve(legacyCopy(text));
}

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function (key) {
    if (key === "class") node.className = attrs[key];
    else if (key === "html") node.innerHTML = attrs[key];
    else node.setAttribute(key, attrs[key]);
  });
  (children || []).forEach(function (child) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  });
  return node;
}

export async function fetchJSON(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error("Failed to load " + path + " (" + response.status + ")");
  }
  return response.json();
}

export function buildResourceIndex(groups) {
  const index = new Map();
  (groups || []).forEach(function (group) {
    (group.items || []).forEach(function (item) {
      if (item && item.id) index.set(item.id, item);
    });
  });
  return index;
}

export function resolveResourceRef(entry, index) {
  if (typeof entry === "string") {
    return index.get(entry) || null;
  }
  if (!entry) return null;
  if (entry.url) return entry;
  const ref = entry.id ? index.get(entry.id) : null;
  if (!ref) return null;
  return Object.assign({}, ref, entry);
}
