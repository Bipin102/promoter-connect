import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uploadImage } from "./storage.js";
import { escapeHTML, safeUrl, openModal } from "./ui.js";

// Past events Promoter Connect has run, added by admins and shown publicly.

export async function listShowcase(max = 24) {
  const snap = await getDocs(query(collection(db, "showcase"), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((item) => safeUrl(item.imageURL));
}

export async function addShowcaseItem({ file, brand, eventName, city }) {
  const imageURL = await uploadImage(`showcase/${Date.now()}.jpg`, file, { maxSize: 1800 });
  await addDoc(collection(db, "showcase"), { imageURL, brand, eventName, city, createdAt: serverTimestamp() });
}

export async function removeShowcaseItem(id) {
  await deleteDoc(doc(db, "showcase", id));
}

const caption = (item) => [item.eventName, item.city].filter(Boolean).map(escapeHTML).join(" · ");

/** Photo tiles; layout "grid" for the homepage, "strip" for dashboards. */
export function showcaseHTML(items, { layout = "grid" } = {}) {
  return `<div class="showcase showcase--${layout}">${items.map((item, i) => `
    <button type="button" class="showcase-item" data-index="${i}" aria-label="View photo: ${escapeHTML(item.brand)}, ${escapeHTML(item.eventName)}">
      <img src="${safeUrl(item.imageURL)}" alt="" loading="lazy" />
      <span class="showcase-caption"><strong>${escapeHTML(item.brand)}</strong><span>${caption(item)}</span></span>
    </button>`).join("")}</div>`;
}

export function brandsHTML(items) {
  const brands = [...new Set(items.map((i) => (i.brand || "").trim()).filter(Boolean))];
  return brands.length ? `<ul class="brand-list">${brands.map((b) => `<li>${escapeHTML(b)}</li>`).join("")}</ul>` : "";
}

/** Opens a tapped photo full size. */
export function bindShowcase(host, items) {
  host.addEventListener("click", (e) => {
    const tile = e.target.closest(".showcase-item");
    if (!tile) return;
    const item = items[Number(tile.dataset.index)];
    openModal(`
      <img class="showcase-full" src="${safeUrl(item.imageURL)}" alt="${escapeHTML(`${item.brand} ${item.eventName}`)}" />
      <h2 class="mt-16">${escapeHTML(item.brand)}</h2>
      <p class="text-dim">${caption(item)}</p>
      <div class="pc-modal-actions"><button class="btn btn-secondary" data-close>Close</button></div>`);
  });
}

/** Fills host with the showcase, or hides section if there's nothing to show. */
export async function mountShowcase(host, section, { layout = "grid", withBrands = null } = {}) {
  try {
    const items = await listShowcase(layout === "strip" ? 12 : 24);
    if (!items.length) return section.classList.add("hidden");
    host.innerHTML = showcaseHTML(items, { layout });
    if (withBrands) withBrands.innerHTML = brandsHTML(items);
    bindShowcase(host, items);
    section.classList.remove("hidden");
  } catch {
    section.classList.add("hidden");
  }
}
