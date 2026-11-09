export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

const ALLOWED_TAGS = new Set([
  "A", "B", "BR", "CODE", "EM", "I", "KBD", "LI", "OL", "P", "SPAN", "STRONG", "UL"
]);
const ALLOWED_ATTRS = new Set(["class", "title", "aria-label", "href", "target", "rel"]);

export function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html == null ? "" : html);

  function clean(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      if (!ALLOWED_TAGS.has(child.tagName)) {
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
        return;
      }

      Array.prototype.slice.call(child.attributes).forEach(function (attr) {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name)) {
          child.removeAttribute(attr.name);
          return;
        }
        if (name === "href") {
          const value = attr.value.trim().toLowerCase();
          const safe =
            value.indexOf("http://") === 0 ||
            value.indexOf("https://") === 0 ||
            value.indexOf("mailto:") === 0 ||
            value.indexOf("#") === 0;
          if (!safe) child.removeAttribute(attr.name);
        }
        if (name === "target" && attr.value !== "_blank") {
          child.removeAttribute(attr.name);
        }
      });

      if (child.tagName === "A" && child.getAttribute("target") === "_blank") {
        child.setAttribute("rel", "noopener noreferrer");
      }

      clean(child);
    });
  }

  clean(template.content);
  return template.innerHTML;
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
    else if (key === "html") node.innerHTML = sanitizeHtml(attrs[key]);
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
