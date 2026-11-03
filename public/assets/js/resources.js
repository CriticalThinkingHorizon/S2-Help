import { el, fetchJSON } from "./utils.js";

export async function initResources() {
  const resourceGroups = await fetchJSON("data/resources.json");
  const resourcesList = document.getElementById("resources-list");

  resourceGroups.forEach(function (group) {
    const groupEl = el("div", { class: "resource-group" });
    groupEl.appendChild(el("h3", {}, [group.title]));
    group.items.forEach(function (item) {
      const itemEl = el("div", { class: "resource-item" });
      itemEl.appendChild(el("span", { class: "resource-title" }, [item.title]));
      if (item.desc) {
        itemEl.appendChild(el("span", { class: "resource-desc" }, [item.desc]));
      }
      const link = el("a", {
        href: item.url,
        target: "_blank",
        rel: "noopener noreferrer"
      }, [item.url]);
      itemEl.appendChild(link);
      groupEl.appendChild(itemEl);
    });
    resourcesList.appendChild(groupEl);
  });
}
